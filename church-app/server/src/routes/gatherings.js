import { Router } from 'express';
import Gathering from '../models/Gathering.js';
import Person from '../models/Person.js';
import Settings from '../models/Settings.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit, auditSession } from '../audit.js';
import { summarizeGatherings, summarizeWeek, weekBounds } from '../gatheringStats.js';
import { ROLES, applyRole, rolesFor } from '../gatheringRoles.js';
import { daysAgo, isDate, isId, plain, shortDate, SECTIONS, today } from '../util.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'leader'));

// A leader needs a person record (the leader tag) with a section (they only work with their own section).
router.use((req, res, next) => {
  if (req.user.role !== 'leader') return next();
  if (!req.user.person) return res.status(400).json({ error: 'Tu cuenta aún no está vinculada a una ficha de persona. Pide a un administrador que la vincule' });
  if (!req.user.section) return res.status(400).json({ error: 'Tu ficha de persona no tiene sección. Pide a un administrador que la complete en Personas' });
  next();
});

const TYPES = ['celula', 'casa_de_paz'];
const label = (g) =>
  `${g.type === 'casa_de_paz' ? `Casa de Paz, clase ${g.classNumber}` : 'Célula'} del ${shortDate(g.date)} (Sección ${g.section})`;
const nameOf = (p) => (p ? `${p.firstName} ${p.lastName}` : '');
const target = (g) => ({ type: 'reunión', id: g._id, label: label(g) });

const populated = (q) =>
  q.populate('participants.person', 'firstName lastName section status').populate('createdBy', 'name');

// Leaders only work with their own section; admins with all of them.
async function load(req, res) {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Reunión inválida' }) && null;
  const g = await Gathering.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Reunión no encontrada' }) && null;
  if (req.user.role === 'leader' && g.section !== req.user.section) {
    return res.status(403).json({ error: 'Esta reunión es de otra sección' }) && null;
  }
  return g;
}
const detail = async (id) => populated(Gathering.findById(id)).lean();

const named = (g, role) => g.participants.filter((p) => p.roles?.includes(role) && p.person).map((p) => nameOf(p.person));
const brief = (g) => ({
  _id: g._id, type: g.type, classNumber: g.classNumber, date: g.date, time: g.time, place: g.place, section: g.section,
  count: g.participants.length,
  leaders: [...named(g, 'leader'), ...named(g, 'coleader')], // the couple: Líder first, then Co-líder
  hosts: named(g, 'host'),
  createdBy: g.createdBy?.name || '',
});

// The default leaders of a section (set by an admin in Settings), without people who are inactive or deleted.
async function sectionDefaults(section) {
  const s = await Settings.findOne({ key: 'main' }).select('sectionLeaders').lean();
  const ids = s?.sectionLeaders?.find((x) => x.section === section)?.people || [];
  if (!ids.length) return [];
  const ok = new Set((await Person.find({ _id: { $in: ids }, status: { $ne: 'inactive' } }).select('_id').lean()).map((p) => String(p._id)));
  return ids.filter((id) => ok.has(String(id)));
}

// GET /api/gatherings?type=&section=&weeks=
router.get('/', async (req, res) => {
  const q = {};
  if (req.user.role === 'leader') q.section = req.user.section;
  else if (SECTIONS.includes(Number(req.query.section))) q.section = Number(req.query.section);
  if (TYPES.includes(req.query.type)) q.type = req.query.type;
  const weeks = Number(req.query.weeks);
  if (weeks > 0) q.date = { $gte: daysAgo(weeks * 7) };
  const items = await populated(Gathering.find(q).sort({ date: -1, createdAt: -1 }).limit(300)).lean();
  res.json(items.map(brief));
});

// Admin dashboard: this week's reuniones, plus casas de paz and células per section and per leader in the last 4 weeks.
router.get('/summary', requireRole('admin'), async (_req, res) => {
  const weeks = 4;
  const since = daysAgo(weeks * 7);
  const items = await Gathering.find({ date: { $gte: since } }).populate('participants.person', 'firstName lastName section').lean();
  res.json({ weeks, since, ...summarizeGatherings(items), week: summarizeWeek(items, weekBounds()) });
});

// People to add to a gathering: search by name and/or filter by section. Names, section and status only.
router.get('/people', async (req, res) => {
  const { q, section, gathering } = req.query;
  const filter = { status: { $ne: 'inactive' } };
  if (SECTIONS.includes(Number(section))) filter.section = Number(section);
  else if (section === 'none') filter.section = { $exists: false };
  const people = await Person.find(filter).select('firstName lastName section status').sort({ lastName: 1, firstName: 1 }).limit(3000).lean();

  let already = new Set();
  if (isId(gathering)) {
    const g = await Gathering.findById(gathering).select('section participants.person').lean();
    if (g && (req.user.role === 'admin' || g.section === req.user.section)) already = new Set(g.participants.map((p) => String(p.person)));
  }
  const terms = plain(q).split(/\s+/).filter(Boolean);
  const matches = people.filter((p) => !already.has(String(p._id)) && terms.every((t) => plain(`${p.firstName} ${p.lastName}`).includes(t)));
  res.json({ total: matches.length, people: matches.slice(0, 50) });
});

router.post('/', async (req, res) => {
  const { type, classNumber, date, time, place } = req.body;
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'Elige si es célula o casa de paz' });
  let lesson;
  if (type === 'casa_de_paz') {
    lesson = Number(classNumber);
    if (!Number.isInteger(lesson) || lesson < 1 || lesson > 9) return res.status(400).json({ error: 'La clase debe ser un número del 1 al 9' });
  }
  // The leader is whoever creates it (their own record). An admin picks someone, or just the section:
  // then the first default leader of that section is the Líder.
  let leaderId, section;
  if (req.user.role === 'leader') {
    leaderId = req.user.person;
    section = req.user.section;
  } else {
    const chosen = SECTIONS.includes(Number(req.body.section)) ? Number(req.body.section) : null;
    leaderId = req.body.leaderId;
    let lp = isId(leaderId) ? await Person.findById(leaderId).select('section').lean() : null;
    if (!lp && chosen) {
      const first = (await sectionDefaults(chosen))[0];
      if (first) {
        leaderId = String(first);
        lp = await Person.findById(first).select('section').lean();
      }
    }
    if (!lp) return res.status(400).json({ error: 'Elige quién dirige la reunión, o una sección que ya tenga líderes asignados' });
    section = chosen || lp.section;
    if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Elige la sección de la reunión' });
  }
  // Líder = the person above; the rest of the section's default leaders (the partner) join as Co-líder.
  const participants = [{ person: leaderId, roles: ['leader'] }];
  for (const id of await sectionDefaults(section)) {
    if (String(id) !== String(leaderId)) participants.push({ person: id, roles: ['coleader'] });
  }
  const g = await Gathering.create({
    type, classNumber: lesson, date: isDate(date) ? date : today(),
    time: /^\d{2}:\d{2}$/.test(time || '') ? time : undefined,
    place: String(place || '').trim().slice(0, 120) || undefined,
    section, createdBy: req.user.id,
    participants,
  });
  await audit(req, { category: 'reuniones', action: 'gathering.create', summary: `creó la reunión: ${label(g)}`, target: target(g) });
  res.status(201).json(await detail(g._id));
});

router.get('/:id', async (req, res) => {
  const g = await load(req, res);
  if (g) res.json(await detail(g._id));
});

// Edit date, time, place and class number (admins can also move it to another section).
router.put('/:id', async (req, res) => {
  const g = await load(req, res);
  if (!g) return;
  const changed = [];
  if (isDate(req.body.date) && req.body.date !== g.date) { g.date = req.body.date; changed.push('fecha'); }
  if (req.body.time !== undefined) {
    const t = /^\d{2}:\d{2}$/.test(req.body.time || '') ? req.body.time : undefined;
    if (t !== g.time) { g.time = t; changed.push('hora'); }
  }
  if (req.body.place !== undefined) {
    const p = String(req.body.place || '').trim().slice(0, 120) || undefined;
    if (p !== g.place) { g.place = p; changed.push('lugar'); }
  }
  if (g.type === 'casa_de_paz' && req.body.classNumber !== undefined) {
    const n = Number(req.body.classNumber);
    if (!Number.isInteger(n) || n < 1 || n > 9) return res.status(400).json({ error: 'La clase debe ser un número del 1 al 9' });
    if (n !== g.classNumber) { g.classNumber = n; changed.push('clase'); }
  }
  if (req.user.role === 'admin' && SECTIONS.includes(Number(req.body.section)) && Number(req.body.section) !== g.section) {
    g.section = Number(req.body.section); changed.push('sección');
  }
  if (changed.length) {
    await g.save();
    await audit(req, { category: 'reuniones', action: 'gathering.update', summary: `editó la reunión: ${label(g)}`, details: changed, target: target(g) });
  }
  res.json(await detail(g._id));
});

router.delete('/:id', async (req, res) => {
  const g = await load(req, res);
  if (!g) return;
  if (req.user.role !== 'admin' && String(g.createdBy) !== req.user.id) {
    return res.status(403).json({ error: 'Solo quien creó la reunión o un administrador puede borrarla' });
  }
  await Gathering.deleteOne({ _id: g._id });
  await audit(req, { category: 'reuniones', action: 'gathering.delete', summary: `borró la reunión: ${label(g)}`, target: { type: 'reunión', label: label(g) } });
  res.json({ ok: true });
});

// ---------- people in a gathering ----------

router.post('/:id/participants', async (req, res) => {
  const g = await load(req, res);
  if (!g) return;
  if (!isId(req.body.personId)) return res.status(400).json({ error: 'Persona inválida' });
  const person = await Person.findById(req.body.personId).select('firstName lastName status').lean();
  if (!person) return res.status(404).json({ error: 'Esa persona no está en la base de datos. Regístrala primero' });
  if (person.status === 'inactive') return res.status(400).json({ error: 'Esa persona está marcada como inactiva' });
  if (g.participants.some((p) => String(p.person) === String(person._id))) return res.status(409).json({ error: 'Ya está en esta reunión' });

  g.participants.push({ person: person._id });
  await g.save();
  await auditSession(req, {
    category: 'reuniones', action: 'gathering.people', targetType: 'reunión', targetId: g._id, targetLabel: label(g), counters: ['added'],
    summarize: (m) => `agregó ${m.added} ${m.added === 1 ? 'persona' : 'personas'} a la reunión: ${label(g)}`,
  });
  res.status(201).json(await detail(g._id));
});

// Tags for this gathering only. Body: { role, on }.
// Some tags are held by one person only: tagging someone else moves it. A reunión always keeps its leader.
router.put('/:id/participants/:personId', async (req, res) => {
  const g = await load(req, res);
  if (!g) return;
  const { role, on } = req.body;
  if (!rolesFor(g.type).includes(role)) return res.status(400).json({ error: 'Esa etiqueta no existe para este tipo de reunión' });
  if (typeof on !== 'boolean') return res.status(400).json({ error: 'Indica si se pone o se quita la etiqueta' });
  const p = g.participants.find((x) => String(x.person) === req.params.personId);
  if (!p) return res.status(404).json({ error: 'Esa persona no está en esta reunión' });
  const def = ROLES[role];
  const result = applyRole(g.participants, req.params.personId, role, on);
  if (result.unchanged) return res.json(await detail(g._id));
  if (result.error === 'leader-required') {
    return res.status(400).json({ error: 'La reunión necesita un líder. Marca a otra persona como líder y la etiqueta se mueve sola' });
  }
  if (result.error === 'already-leader') {
    return res.status(400).json({ error: 'Esa persona ya es la líder de la reunión, no puede ser también co-líder' });
  }
  const person = await Person.findById(p.person).select('firstName lastName').lean();
  const previous = result.previous ? await Person.findById(result.previous).select('firstName lastName').lean() : null;
  await g.save();
  await audit(req, {
    category: 'reuniones', action: 'gathering.tag',
    summary: `${on ? 'marcó a' : 'quitó la etiqueta de ' + def.label + ' a'} ${nameOf(person)}${on ? ' como ' + def.label : ''} en la reunión: ${label(g)}`,
    details: previous ? [`antes la tenía ${nameOf(previous)}`] : undefined, target: target(g),
  });
  res.json(await detail(g._id));
});

router.delete('/:id/participants/:personId', async (req, res) => {
  const g = await load(req, res);
  if (!g) return;
  const p = g.participants.find((x) => String(x.person) === req.params.personId);
  if (!p) return res.status(404).json({ error: 'Esa persona no está en esta reunión' });
  if (p.roles.includes('leader')) {
    return res.status(400).json({ error: 'No se puede quitar al líder. Marca primero a otra persona como líder' });
  }
  const person = await Person.findById(p.person).select('firstName lastName').lean();
  g.participants = g.participants.filter((x) => String(x.person) !== req.params.personId);
  await g.save();
  await audit(req, { category: 'reuniones', action: 'gathering.remove', summary: `quitó a ${nameOf(person)} de la reunión: ${label(g)}`, target: target(g) });
  res.json(await detail(g._id));
});

export default router;
