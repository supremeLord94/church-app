import { Router } from 'express';
import Person from '../models/Person.js';
import Service from '../models/Service.js';
import Attendance from '../models/Attendance.js';
import Settings from '../models/Settings.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upcomingBirthdays } from '../birthdays.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/stats/overview?weeks=12
// Trend of recent Sundays, the latest Sunday in detail, and a per-section breakdown.
router.get('/overview', async (req, res) => {
  const weeks = Math.min(Number(req.query.weeks) || 12, 52);
  const services = await Service.find().sort({ date: -1 }).limit(weeks).lean();
  const settings = await Settings.findOne({ key: 'main' }).lean();
  const goal = settings?.attendanceGoal || 0;
  const birthdayPeople = await Person.find({ birthday: { $exists: true, $nin: [null, ''] }, status: { $ne: 'inactive' } })
    .select('firstName lastName phone section status birthday').lean();
  const birthdays = upcomingBirthdays(birthdayPeople); // next 4 weeks
  if (!services.length) return res.json({ goal, trend: [], latest: null, sections: [], birthdays });

  const dates = services.map((s) => s.date);
  const rows = await Attendance.find({ date: { $in: dates } }).populate('person', 'status section joinedAt').lean();

  const byDate = Object.fromEntries(dates.map((d) => [d, { date: d, members: 0, visitors: 0, newPeople: 0 }]));
  for (const r of rows) {
    if (!r.person) continue;
    const row = byDate[r.date];
    if (r.person.status === 'visitor') row.visitors++;
    else row.members++;
    if (r.person.joinedAt === r.date) row.newPeople++;
  }
  const trend = dates
    .map((d) => ({ ...byDate[d], total: byDate[d].members + byDate[d].visitors }))
    .reverse(); // oldest -> newest for charts

  const latestDate = dates[0];
  const members = await Person.find({ status: 'member', joinedAt: { $lte: latestDate } }).select('section').lean();
  const presentToday = new Set(rows.filter((r) => r.date === latestDate && r.person).map((r) => String(r.person._id)));
  const membersPresent = members.filter((m) => presentToday.has(String(m._id)));

  const sections = [1, 2, 3, 4, 5, null].map((sec) => {
    const total = members.filter((m) => (m.section ?? null) === sec).length;
    const present = membersPresent.filter((m) => (m.section ?? null) === sec).length;
    return { section: sec, total, present, missing: total - present };
  }).filter((s) => s.section !== null || s.total > 0);

  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const recent = trend.slice(-4);

  res.json({
    goal,
    birthdays,
    trend,
    latest: {
      ...last,
      membersTotal: members.length,
      membersPresent: membersPresent.length,
      membersMissing: members.length - membersPresent.length,
      deltaVsPrevious: prev ? last.total - prev.total : null,
      averageLast4: Math.round(recent.reduce((n, t) => n + t.total, 0) / recent.length),
    },
    sections,
  });
});

// GET /api/stats/missing?threshold=3
// Members who missed the last N (or more) services in a row, since they joined.
router.get('/missing', async (req, res) => {
  const threshold = Math.max(1, Number(req.query.threshold) || 3);
  const services = await Service.find().sort({ date: -1 }).limit(26).lean(); // newest first
  if (!services.length) return res.json({ threshold, servicesChecked: 0, people: [] });

  const dates = services.map((s) => s.date);
  const rows = await Attendance.find({ date: { $in: dates } }).select('date person').lean();
  const presentBy = {};
  for (const r of rows) (presentBy[r.date] ||= new Set()).add(String(r.person));

  const members = await Person.find({ status: 'member' }).lean();
  const people = [];
  for (const m of members) {
    const eligible = services.filter((s) => s.date >= (m.joinedAt || '0000-00-00'));
    let consecutive = 0;
    for (const s of eligible) {
      if (presentBy[s.date]?.has(String(m._id))) break;
      consecutive++;
    }
    if (consecutive < threshold) continue;
    const lastSeen = eligible.find((s) => presentBy[s.date]?.has(String(m._id)))?.date || null;
    const last8 = eligible.slice(0, 8);
    people.push({
      _id: m._id,
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone,
      section: m.section,
      consecutiveMissed: consecutive,
      lastSeen, // null = not seen in the last 26 services (or since joining)
      missedOfLast8: last8.filter((s) => !presentBy[s.date]?.has(String(m._id))).length,
      checkedLast8: last8.length,
    });
  }
  people.sort((a, b) => b.consecutiveMissed - a.consecutiveMissed || a.lastName.localeCompare(b.lastName));
  res.json({ threshold, servicesChecked: services.length, people });
});

export default router;
