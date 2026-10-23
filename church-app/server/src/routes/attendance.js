import { Router } from 'express';
import Attendance from '../models/Attendance.js';
import Service from '../models/Service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditSession } from '../audit.js';
import { longDate } from '../util.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'user'));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (req, res, next) =>
  DATE.test(req.params.date) ? next() : res.status(400).json({ error: 'Fecha inválida (AAAA-MM-DD)' });

// GET /api/attendance/2026-10-18 -> ids of people marked present that day
router.get('/:date', validDate, async (req, res) => {
  const rows = await Attendance.find({ date: req.params.date }).select('person').lean();
  res.json({ date: req.params.date, presentIds: rows.map((r) => String(r.person)) });
});

// PUT /api/attendance/2026-10-18/:personId  { present: true|false }
// One person per request, so several people can take attendance at once without overwriting each other.
router.put('/:date/:personId', validDate, async (req, res) => {
  const { date, personId } = req.params;
  if (req.body.present) {
    await Service.updateOne({ date }, { $setOnInsert: { date } }, { upsert: true });
    await Attendance.updateOne(
      { date, person: personId },
      { $setOnInsert: { date, person: personId, recordedBy: req.user.id } },
      { upsert: true }
    );
  } else {
    await Attendance.deleteOne({ date, person: personId });
  }
  // One log entry per person per session, not one per tap.
  await auditSession(req, {
    category: 'asistencia', action: 'attendance.session', targetType: 'domingo', targetId: date, targetLabel: longDate(date),
    counters: [req.body.present ? 'present' : 'absent'],
    summarize: (m) =>
      `tomó asistencia del ${longDate(date)}: ${m.present || 0} marcados presentes${m.absent ? `, ${m.absent} quitados` : ''}`,
  });
  res.json({ ok: true });
});

export default router;
