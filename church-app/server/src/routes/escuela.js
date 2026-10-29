import { Router } from 'express';
import Person from '../models/Person.js';
import User from '../models/User.js';
import Cohort from '../models/Cohort.js';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';
import ClassRecord from '../models/ClassRecord.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { COURSES, COURSE_LABELS } from '../courses.js';
import { audit, auditSession } from '../audit.js';
import { buildRows, summarize } from '../escuelaStats.js';
import { today, isDate, isId } from '../util.js';

const router = Router();
// Admins see everything. Teachers only reach the groups they are assigned to (see cohortAccess).
router.use(requireAuth, requireRole('admin', 'teacher'));
const adminOnly = requireRole('admin');

const ENR_LABEL = { active: 'Activo', completed: 'Completó', dropped: 'Se retiró' };
const cohortLabel = (c) => `${COURSE_LABELS[c.course]} · ${c.name}`;
const personLabel = (p) => `${p.firstName} ${p.lastName}`;
const cohortTarget = (c) => ({ type: 'grupo', id: c._id, label: cohortLabel(c) });
const log = (req, action, summary, extra = {}) => audit(req, { category: 'escuela', action, summary, ...extra });

// Student is "at risk" after this many classes in a row without attending, or without homework.
const RISK = 3;

// Teachers may only touch their own groups. Used on every route with a group id.
async function cohortAccess(req, res, next) {
  if (req.user.role === 'admin') return next();
  const mine = await Cohort.exists({ _id: req.params.id, teachers: req.user.id });
  return mine ? next() : res.status(403).json({ error: 'No tienes acceso a este grupo' });
}

const loadRows = async () => {
  const [people, enrollments, lessons, records] = await Promise.all([
    Person.find({ status: { $ne: 'inactive' } }).select('firstName lastName phone section status').lean(),
    Enrollment.find().lean(),
    Lesson.find().lean(),
    ClassRecord.find().select('cohort number person present homework').lean(),
  ]);
  return buildRows({ people, enrollments, lessons, records });
};

async function cohortSummaries(filter = {}) {
  const cohorts = await Cohort.find(filter).sort({ startDate: -1, createdAt: -1 }).lean();
  const ids = cohorts.map((c) => c._id);
  const [enr, lessons, presents] = await Promise.all([
    Enrollment.find({ cohort: { $in: ids } }).select('cohort status').lean(),
    Lesson.find({ cohort: { $in: ids } }).select('cohort').lean(),
    ClassRecord.aggregate([{ $match: { cohort: { $in: ids }, present: true } }, { $group: { _id: '$cohort', n: { $sum: 1 } } }]),
  ]);
  return cohorts.map((c) => {
    const k = String(c._id);
    const mine = enr.filter((e) => String(e.cohort) === k);
    const roster = mine.filter((e) => e.status !== 'dropped').length;
    const held = lessons.filter((l) => String(l.cohort) === k).length;
    const present = presents.find((p) => String(p._id) === k)?.n || 0;
    return {
      ...c,
      held,
      enrolled: mine.filter((e) => e.status === 'active').length,
      completed: mine.filter((e) => e.status === 'completed').length,
      dropped: mine.filter((e) => e.status === 'dropped').length,
      attendancePct: held && roster ? Math.round((present / (held * roster)) * 100) : null,
    };
  });
}

// ---------- overview / students ----------

const byName = (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
const worstStreak = (r) => Math.max(r.consecutiveMissed, r.consecutiveNoHomework);

// Admin: school-wide numbers, groups in progress, students at risk, and people who stopped.
// Teacher: only their own groups and the at-risk students inside them.
router.get('/overview', async (req, res) => {
  const threshold = Math.max(1, Number(req.query.threshold) || RISK);
  const rows = await loadRows();
  const atRisk = (r) => r.stage === 'in_progress' && worstStreak(r) >= threshold;
  const sortRisk = (a, b) => worstStreak(b) - worstStreak(a) || byName(a, b);

  if (req.user.role === 'teacher') {
    const cohorts = await cohortSummaries({ teachers: req.user.id });
    const mine = new Set(cohorts.map((c) => String(c._id)));
    return res.json({
      scoped: true,
      threshold,
      cohorts,
      atRisk: rows.filter((r) => atRisk(r) && mine.has(r.cohortId)).sort(sortRisk),
    });
  }
  res.json({
    ...summarize(rows),
    threshold,
    cohorts: await cohortSummaries({ status: 'active' }),
    atRisk: rows.filter(atRisk).sort(sortRisk),
    stalledList: rows
      .filter((r) => r.stage === 'stalled')
      .sort((a, b) => String(b.lastActivity || '').localeCompare(String(a.lastActivity || '')) || byName(a, b)),
  });
});

router.get('/students', adminOnly, async (_req, res) => res.json(await loadRows()));

// Record a course finished in the past, without a group (e.g. someone who took ABC years ago).
router.post('/completions', adminOnly, async (req, res) => {
  const { personId, course } = req.body;
  if (!isId(personId)) return res.status(400).json({ error: 'Persona inválida' });
  if (!COURSES.includes(course)) return res.status(400).json({ error: 'Curso inválido' });
  const person = await Person.findById(personId).select('firstName lastName').lean();
  if (!person) return res.status(404).json({ error: 'Persona no encontrada' });
  const existing = await Enrollment.findOne({ person: personId, course, status: 'completed' });
  if (existing) return res.json(existing);
  const e = await Enrollment.create({ person: personId, course, status: 'completed', completedAt: today() });
  await log(req, 'escuela.completion', `registró que ${personLabel(person)} ya completó ${COURSE_LABELS[course]}`, {
    target: { type: 'persona', id: person._id, label: personLabel(person) },
  });
  res.status(201).json(e);
});

// Undo a course registered by hand (no group). Courses finished inside a group are changed from the group page.
router.delete('/completions', adminOnly, async (req, res) => {
  const { personId, course } = req.body;
  if (!isId(personId) || !COURSES.includes(course)) return res.status(400).json({ error: 'Datos inválidos' });
  const person = await Person.findById(personId).select('firstName lastName').lean();
  if (!person) return res.status(404).json({ error: 'Persona no encontrada' });
  const r = await Enrollment.deleteMany({ person: personId, course, status: 'completed', cohort: null });
  if (!r.deletedCount) return res.status(404).json({ error: 'Ese curso no fue registrado a mano' });
  await log(req, 'escuela.completion-undo', `quitó el curso previo ${COURSE_LABELS[course]} de ${personLabel(person)}`, {
    target: { type: 'persona', id: person._id, label: personLabel(person) },
  });
  res.json({ ok: true });
});
// ---------- groups ----------

router.get('/cohorts', async (req, res) => {
  const filter = req.user.role === 'teacher' ? { teachers: req.user.id } : {};
  if (req.query.status) filter.status = req.query.status;
  res.json(await cohortSummaries(filter));
});

router.post('/cohorts', adminOnly, async (req, res) => {
  const { course, name, startDate, totalClasses } = req.body;
  if (!COURSES.includes(course)) return res.status(400).json({ error: 'Elige un curso' });
  if (!name?.trim()) return res.status(400).json({ error: 'Ponle un nombre al grupo' });
  const cohort = await Cohort.create({
    course, name, startDate: isDate(startDate) ? startDate : today(), totalClasses: Number(totalClasses) || 12,
  });
  await log(req, 'cohort.create', `creó el grupo ${cohortLabel(cohort)}`, { target: cohortTarget(cohort) });
  res.status(201).json(cohort);
});

// Everything the group page needs in one request.
router.get('/cohorts/:id', cohortAccess, async (req, res) => {
  const cohort = await Cohort.findById(req.params.id).populate('teachers', 'name username').lean();
  if (!cohort) return res.status(404).json({ error: 'Grupo no encontrado' });
  const [enrollments, lessons, records] = await Promise.all([
    Enrollment.find({ cohort: cohort._id }).populate('person', 'firstName lastName phone section').sort({ createdAt: 1 }).lean(),
    Lesson.find({ cohort: cohort._id }).select('number date -_id').sort({ number: 1 }).lean(),
    ClassRecord.find({ cohort: cohort._id }).select('number person present homework -_id').lean(),
  ]);
  res.json({ cohort, enrollments: enrollments.filter((e) => e.person), lessons, records });
});

// Admin: edit the group and assign its teachers.
router.put('/cohorts/:id', adminOnly, async (req, res) => {
  const { name, startDate, totalClasses, status, teachers } = req.body;
  const set = {};
  if (name?.trim()) set.name = name.trim();
  if (isDate(startDate)) set.startDate = startDate;
  if (totalClasses) set.totalClasses = Number(totalClasses);
  if (['active', 'completed'].includes(status)) set.status = status;
  if (Array.isArray(teachers)) {
    const valid = await User.find({ _id: { $in: teachers.filter(isId) }, role: 'teacher' }).select('_id').lean();
    set.teachers = valid.map((u) => u._id);
  }
  const before = await Cohort.findById(req.params.id).lean();
  const cohort = await Cohort.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true });
  if (!cohort || !before) return res.status(404).json({ error: 'Grupo no encontrado' });

  const changed = [];
  if (before.name !== cohort.name) changed.push('nombre');
  if (before.startDate !== cohort.startDate) changed.push('fecha de inicio');
  if (before.totalClasses !== cohort.totalClasses) changed.push('número de clases');
  if (before.status !== cohort.status) changed.push(`estado: ${before.status === 'active' ? 'activo' : 'terminado'} → ${cohort.status === 'active' ? 'activo' : 'terminado'}`);
  if (changed.length) await log(req, 'cohort.update', `editó el grupo ${cohortLabel(cohort)}`, { details: changed, target: cohortTarget(cohort) });

  const was = new Set((before.teachers || []).map(String));
  const now = new Set((cohort.teachers || []).map(String));
  const added = [...now].filter((id) => !was.has(id));
  const removed = [...was].filter((id) => !now.has(id));
  if (added.length || removed.length) {
    const names = new Map((await User.find({ _id: { $in: [...added, ...removed] } }).select('name').lean()).map((u) => [String(u._id), u.name]));
    for (const id of added) await log(req, 'cohort.teacher-add', `asignó a ${names.get(id) || 'un profesor'} como profesor de ${cohortLabel(cohort)}`, { target: cohortTarget(cohort) });
    for (const id of removed) await log(req, 'cohort.teacher-remove', `quitó a ${names.get(id) || 'un profesor'} como profesor de ${cohortLabel(cohort)}`, { target: cohortTarget(cohort) });
  }
  res.json(cohort);
});

// Close the group: everyone still active is marked as having completed the course.
router.post('/cohorts/:id/finish', adminOnly, async (req, res) => {
  const cohort = await Cohort.findById(req.params.id).lean();
  if (!cohort) return res.status(404).json({ error: 'Grupo no encontrado' });
  const r = await Enrollment.updateMany(
    { cohort: req.params.id, status: 'active' },
    { $set: { status: 'completed', completedAt: today() } }
  );
  await Cohort.updateOne({ _id: req.params.id }, { $set: { status: 'completed' } });
  await log(req, 'cohort.finish', `terminó el grupo ${cohortLabel(cohort)}: ${r.modifiedCount} alumnos marcados como completados`, { target: cohortTarget(cohort) });
  res.json({ ok: true });
});

router.delete('/cohorts/:id', adminOnly, async (req, res) => {
  const cohort = await Cohort.findById(req.params.id).lean();
  await Promise.all([
    Lesson.deleteMany({ cohort: req.params.id }),
    ClassRecord.deleteMany({ cohort: req.params.id }),
    Enrollment.deleteMany({ cohort: req.params.id }),
  ]);
  await Cohort.findByIdAndDelete(req.params.id);
  if (cohort) await log(req, 'cohort.delete', `borró el grupo ${cohortLabel(cohort)} con todas sus clases y registros`, { target: { type: 'grupo', label: cohortLabel(cohort) } });
  res.json({ ok: true });
});

// ---------- enrollments ----------

// People who could still be added to this group: names, section and status only
// (no phone, address or birthday), so teachers can find who to enroll without browsing everyone's details.
router.get('/cohorts/:id/candidates', cohortAccess, async (req, res) => {
  const enrolled = await Enrollment.find({ cohort: req.params.id }).select('person').lean();
  const people = await Person.find({ status: { $ne: 'inactive' }, _id: { $nin: enrolled.map((e) => e.person) } })
    .select('firstName lastName section status').sort({ lastName: 1, firstName: 1 }).lean();
  res.json(people);
});

// Admin or the group's teacher: add an existing person to the group.
router.post('/cohorts/:id/enrollments', cohortAccess, async (req, res) => {
  const cohort = await Cohort.findById(req.params.id);
  if (!cohort) return res.status(404).json({ error: 'Grupo no encontrado' });
  if (!isId(req.body.personId)) return res.status(400).json({ error: 'Persona inválida' });
  const person = await Person.findById(req.body.personId).select('firstName lastName status').lean();
  if (!person) return res.status(404).json({ error: 'Esa persona no está en la base de datos. Regístrala primero en Personas' });
  if (person.status === 'inactive') return res.status(400).json({ error: 'Esa persona está marcada como inactiva' });
  if (await Enrollment.exists({ cohort: cohort._id, person: req.body.personId })) {
    return res.status(409).json({ error: 'Esa persona ya está en este grupo' });
  }
  const e = await Enrollment.create({ person: req.body.personId, cohort: cohort._id, course: cohort.course });
  await log(req, 'enrollment.create', `inscribió a ${personLabel(person)} en ${cohortLabel(cohort)}`, { target: { type: 'persona', id: person._id, label: personLabel(person) } });
  res.status(201).json(e);
});

// Admin or the group's teacher: decide whether the student is still going, completed, or left.
router.put('/enrollments/:id', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'completed', 'dropped'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const existing = await Enrollment.findById(req.params.id).lean();
  if (!existing) return res.status(404).json({ error: 'Inscripción no encontrada' });
  if (req.user.role !== 'admin') {
    const mine = existing.cohort && (await Cohort.exists({ _id: existing.cohort, teachers: req.user.id }));
    if (!mine) return res.status(403).json({ error: 'No tienes acceso a este grupo' });
  }
  const e = await Enrollment.findByIdAndUpdate(
    req.params.id,
    status === 'completed' ? { $set: { status, completedAt: today() } } : { $set: { status }, $unset: { completedAt: '' } },
    { new: true }
  );
  if (existing.status !== status) {
    const [person, cohort] = await Promise.all([
      Person.findById(existing.person).select('firstName lastName').lean(),
      existing.cohort ? Cohort.findById(existing.cohort).lean() : null,
    ]);
    if (person) {
      await log(req, 'enrollment.status', `marcó a ${personLabel(person)} como “${ENR_LABEL[status]}” en ${cohort ? cohortLabel(cohort) : COURSE_LABELS[existing.course]}`, {
        target: { type: 'persona', id: person._id, label: personLabel(person) },
      });
    }
  }
  res.json(e);
});

// Remove a mistaken enrollment (also removes that person's records in the group).
router.delete('/enrollments/:id', adminOnly, async (req, res) => {
  const e = await Enrollment.findByIdAndDelete(req.params.id);
  if (e?.cohort) await ClassRecord.deleteMany({ cohort: e.cohort, person: e.person });
  if (e) {
    const [person, cohort] = await Promise.all([
      Person.findById(e.person).select('firstName lastName').lean(),
      e.cohort ? Cohort.findById(e.cohort).lean() : null,
    ]);
    if (person) await log(req, 'enrollment.delete', `quitó a ${personLabel(person)} de ${cohort ? cohortLabel(cohort) : COURSE_LABELS[e.course]}`, { target: { type: 'persona', id: person._id, label: personLabel(person) } });
  }
  res.json({ ok: true });
});

// ---------- classes and records ----------

async function classOr400(req, res) {
  const cohort = await Cohort.findById(req.params.id).lean();
  if (!cohort) return res.status(404).json({ error: 'Grupo no encontrado' }) && null;
  const number = Number(req.params.number);
  if (!Number.isInteger(number) || number < 1 || number > cohort.totalClasses) {
    return res.status(400).json({ error: `La clase debe ser entre 1 y ${cohort.totalClasses}` }) && null;
  }
  return { cohort, number };
}

// Change the date of a class that was already held.
router.put('/cohorts/:id/classes/:number', cohortAccess, async (req, res) => {
  const c = await classOr400(req, res);
  if (!c) return;
  if (!isDate(req.body.date)) return res.status(400).json({ error: 'Fecha inválida (AAAA-MM-DD)' });
  await Lesson.updateOne({ cohort: c.cohort._id, number: c.number }, { $set: { date: req.body.date } }, { upsert: true });
  await log(req, 'class.date', `cambió la fecha de la clase ${c.number} de ${cohortLabel(c.cohort)} a ${req.body.date}`, { target: cohortTarget(c.cohort) });
  res.json({ ok: true });
});

// One student, one class. Send present and/or homework; the class is created on first use.
router.put('/cohorts/:id/classes/:number/records/:personId', cohortAccess, async (req, res) => {
  const c = await classOr400(req, res);
  if (!c) return;
  const { present, homework, date } = req.body;
  const set = {};
  if (typeof present === 'boolean') set.present = present;
  if (typeof homework === 'boolean') set.homework = homework;
  if (!Object.keys(set).length) return res.status(400).json({ error: 'Indica asistencia o tarea' });
  // Only people enrolled in this group can be recorded.
  if (!(await Enrollment.exists({ cohort: c.cohort._id, person: req.params.personId }))) {
    return res.status(400).json({ error: 'Esa persona no está inscrita en este grupo' });
  }

  await Lesson.updateOne(
    { cohort: c.cohort._id, number: c.number },
    { $setOnInsert: { date: isDate(date) ? date : today() } },
    { upsert: true }
  );
  await ClassRecord.updateOne(
    { cohort: c.cohort._id, number: c.number, person: req.params.personId },
    { $set: set },
    { upsert: true }
  );
  const counters = [];
  if ('present' in set) counters.push(set.present ? 'presentOn' : 'presentOff');
  if ('homework' in set) counters.push(set.homework ? 'hwOn' : 'hwOff');
  await auditSession(req, {
    category: 'escuela', action: 'class.session', targetType: 'clase', targetId: `${c.cohort._id}:${c.number}`,
    targetLabel: `Clase ${c.number} · ${cohortLabel(c.cohort)}`, counters,
    summarize: (m) => {
      const parts = [];
      if (m.presentOn) parts.push(`${m.presentOn} asistencias`);
      if (m.presentOff) parts.push(`${m.presentOff} asistencias quitadas`);
      if (m.hwOn) parts.push(`${m.hwOn} tareas`);
      if (m.hwOff) parts.push(`${m.hwOff} tareas quitadas`);
      return `registró la clase ${c.number} de ${cohortLabel(c.cohort)}: ${parts.join(', ')}`;
    },
  });
  res.json({ ok: true });
});

export default router;
