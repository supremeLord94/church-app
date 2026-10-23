import { Router } from 'express';
import Person from '../models/Person.js';
import Attendance from '../models/Attendance.js';
import Service from '../models/Service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);
const staff = requireRole('admin', 'user'); // browse and edit people
const canRegister = requireRole('admin', 'user', 'teacher'); // add a new person

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { today } from '../util.js';

const FIELD_LABELS = {
  firstName: 'nombre', lastName: 'apellido', phone: 'teléfono', address: 'dirección', birthday: 'cumpleaños',
  section: 'sección', invitedBy: 'invitado por', relatives: 'familiares', status: 'estado',
  joinedAt: 'primer domingo contado', notes: 'notas',
};
const STATUS_ES = { visitor: 'Visita', member: 'Miembro', inactive: 'Inactivo' };
const norm = (k, v) =>
  k === 'address' ? ['street', 'city', 'state', 'zip'].map((f) => v?.[f] || '').join('|')
  : k === 'relatives' ? (v || []).map((r) => `${r.person}:${r.relationship || ''}`).join(',')
  : String(v ?? '');

// Which fields changed, as readable labels. Values are only included for status and section.
function diffPerson(before, after) {
  if (!before) return [];
  const out = [];
  for (const k of Object.keys(FIELD_LABELS)) {
    if (norm(k, before[k]) === norm(k, after[k])) continue;
    if (k === 'status') out.push(`estado: ${STATUS_ES[before.status]} → ${STATUS_ES[after.status]}`);
    else if (k === 'section') out.push(`sección: ${before.section || 'ninguna'} → ${after.section || 'ninguna'}`);
    else out.push(FIELD_LABELS[k]);
  }
  return out;
}

// Only these fields can be set from the client.
const pick = (b) => {
  const out = {};
  for (const k of ['firstName', 'lastName', 'phone', 'address', 'birthday', 'section', 'invitedBy', 'relatives', 'status', 'joinedAt', 'notes']) {
    if (b[k] !== undefined) out[k] = b[k] === '' ? undefined : b[k];
  }
  return out;
};

// GET /api/people?search=&section=&status=
router.get('/', staff, async (req, res) => {
  const { search, section, status } = req.query;
  const q = {};
  if (section === 'none') q.section = { $exists: false };
  else if (section) q.section = Number(section);
  if (status) q.status = status;
  if (search) {
    const terms = String(search).trim().split(/\s+/).map((t) => new RegExp(escapeRegex(t), 'i'));
    q.$and = terms.map((r) => ({ $or: [{ firstName: r }, { lastName: r }, { phone: r }] }));
  }
  const people = await Person.find(q).sort({ lastName: 1, firstName: 1 }).limit(1000).lean();
  res.json(people);
});

router.post('/', canRegister, async (req, res) => {
  const data = pick(req.body);
  data.joinedAt = data.joinedAt || today();
  // Same first + last name (ignoring capitals and accents): ask before creating a twin.
  if (req.body.allowDuplicate !== true && typeof data.firstName === 'string' && typeof data.lastName === 'string') {
    const dup = await Person.findOne({ firstName: data.firstName.trim(), lastName: data.lastName.trim() })
      .collation({ locale: 'es', strength: 1 }).select('firstName lastName').lean();
    if (dup) return res.status(409).json({ duplicate: true, error: `Ya hay una persona registrada como ${dup.firstName} ${dup.lastName}.` });
  }
  const person = await Person.create(data);
  await audit(req, {
    category: 'personas', action: 'person.create', summary: `registró a ${person.firstName} ${person.lastName}`,
    target: { type: 'persona', id: person._id, label: `${person.firstName} ${person.lastName}` },
  });
  res.status(201).json(person);
});

router.get('/:id', staff, async (req, res) => {
  const person = await Person.findById(req.params.id)
    .populate('invitedBy', 'firstName lastName')
    .populate('relatives.person', 'firstName lastName')
    .lean();
  if (!person) return res.status(404).json({ error: 'Persona no encontrada' });
  res.json(person);
});

// Last 12 services with present/absent for this person (only since they joined).
router.get('/:id/attendance', staff, async (req, res) => {
  const person = await Person.findById(req.params.id).lean();
  if (!person) return res.status(404).json({ error: 'Persona no encontrada' });
  const services = await Service.find({ date: { $gte: person.joinedAt || '0000-00-00' } })
    .sort({ date: -1 })
    .limit(12)
    .lean();
  const present = new Set(
    (await Attendance.find({ person: person._id, date: { $in: services.map((s) => s.date) } }).lean()).map((a) => a.date)
  );
  res.json(services.map((s) => ({ date: s.date, present: present.has(s.date) })));
});

router.put('/:id', staff, async (req, res) => {
  const data = pick(req.body);
  const unset = {};
  for (const k of ['phone', 'birthday', 'section', 'invitedBy', 'notes']) {
    if (req.body[k] === '' || req.body[k] === null) unset[k] = '';
  }
  const before = await Person.findById(req.params.id).lean();
  const person = await Person.findByIdAndUpdate(
    req.params.id,
    { $set: data, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true, runValidators: true }
  );
  if (!person) return res.status(404).json({ error: 'Persona no encontrada' });
  const changed = diffPerson(before, person.toObject());
  if (changed.length) {
    // Field names only (and status/section, which aren't private). Phone and address values are never stored.
    await audit(req, {
      category: 'personas', action: 'person.update', summary: `editó a ${person.firstName} ${person.lastName}`, details: changed,
      target: { type: 'persona', id: person._id, label: `${person.firstName} ${person.lastName}` },
    });
  }
  res.json(person);
});

// Prefer marking someone "inactive". Deleting also removes their attendance history.
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const person = await Person.findById(req.params.id).lean();
  await Attendance.deleteMany({ person: req.params.id });
  await Person.findByIdAndDelete(req.params.id);
  if (person) {
    await audit(req, {
      category: 'personas', action: 'person.delete', summary: `borró a ${person.firstName} ${person.lastName} y su historial`,
      target: { type: 'persona', label: `${person.firstName} ${person.lastName}` },
    });
  }
  res.json({ ok: true });
});

export default router;
