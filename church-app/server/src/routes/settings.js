import { Router } from 'express';
import Settings from '../models/Settings.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../audit.js';

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

export default router;
