import { Router } from 'express';
import Settings from '../models/Settings.js';
import Person from '../models/Person.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../audit.js';
import { isId, SECTIONS } from '../util.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', async (_req, res) => {
  const s = (await Settings.findOne({ key: 'main' })) || {};
  res.json({ attendanceGoal: s.attendanceGoal || 0 });
});

router.put('/', requireRole('admin'), async (req, res) => {
  const goal = Math.max(0, Number(req.body.attendanceGoal) || 0);
  await Settings.updateOne({ key: 'main' }, { $set: { attendanceGoal: goal } }, { upsert: true });
  await audit(req, { category: 'ajustes', action: 'settings.goal', summary: `cambió la meta de asistencia a ${goal}` });
  res.json({ attendanceGoal: goal });
});

// ---------- default leaders of each section ----------

const nameOf = (p) => `${p.firstName} ${p.lastName}`;

// Always one entry per section (1 to 5), with the people's names. Deleted people are left out.
async function leadersView() {
  const s = await Settings.findOne({ key: 'main' }).lean();
  const ids = [...new Set((s?.sectionLeaders || []).flatMap((x) => x.people.map(String)))];
  const people = await Person.find({ _id: { $in: ids } }).select('firstName lastName').lean();
  const byId = new Map(people.map((p) => [String(p._id), p]));
  return SECTIONS.map((section) => ({
    section,
    people: (s?.sectionLeaders?.find((x) => x.section === section)?.people || []).map((id) => byId.get(String(id))).filter(Boolean),
  }));
}

router.get('/section-leaders', async (_req, res) => res.json(await leadersView()));

// Body: { people: [personId, ...] } (up to 2, in order: Líder first, then Co-líder).
router.put('/section-leaders/:section', async (req, res) => {
  const section = Number(req.params.section);
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Sección inválida' });
  const ids = Array.isArray(req.body.people) ? [...new Set(req.body.people.filter(isId))] : [];
  if (ids.length > 2) return res.status(400).json({ error: 'Cada sección tiene máximo 2 líderes' });
  const found = await Person.find({ _id: { $in: ids } }).select('firstName lastName').lean();
  if (found.length !== ids.length) return res.status(400).json({ error: 'Alguna de esas personas ya no existe' });

  const s = await Settings.findOne({ key: 'main' }).lean();
  const others = (s?.sectionLeaders || []).filter((x) => x.section !== section);
  const next = ids.length ? [...others, { section, people: ids }] : others;
  await Settings.updateOne({ key: 'main' }, { $set: { sectionLeaders: next } }, { upsert: true });

  const byId = new Map(found.map((p) => [String(p._id), p]));
  await audit(req, {
    category: 'ajustes', action: 'settings.section-leaders',
    summary: `cambió los líderes de la Sección ${section}: ${ids.map((id) => nameOf(byId.get(id))).join(' y ') || 'ninguno'}`,
  });
  res.json(await leadersView());
});

export default router;
