import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { escapeRegex, isDate } from '../util.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/activity?category=&actor=&q=&from=2026-10-01&to=2026-10-31&page=1
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const { category, actor, q, from, to } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (actor) filter.actor = actor;
  if (isDate(from) || isDate(to)) {
    filter.at = {};
    if (isDate(from)) filter.at.$gte = new Date(`${from}T00:00:00`); // server's local time (TZ)
    if (isDate(to)) filter.at.$lte = new Date(`${to}T23:59:59.999`);
  }
  if (q?.trim()) {
    const r = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ summary: r }, { targetLabel: r }, { actorName: r }, { ip: r }];
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).select('-sessionKey -__v').lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
});

export default router;
