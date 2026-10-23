import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../audit.js';
import { ROLE_LABEL } from '../util.js';
import { emailProblem, normEmail, normUsername, usernameProblem } from '../userChecks.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const ROLES = ['admin', 'user', 'teacher'];
const view = (u) => ({
  _id: u._id, name: u.name, email: u.email, username: u.username || '', role: u.role, active: u.active,
  mustChangePassword: !!u.mustChangePassword, createdAt: u.createdAt,
  lockedUntil: u.lockedUntil && u.lockedUntil > new Date() ? u.lockedUntil : null,
});
const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 128;
const PW_ERROR = 'La contraseña debe tener entre 8 y 128 caracteres';

router.get('/', async (_req, res) => {
  const users = await User.find().sort({ name: 1 }).lean();
  res.json(users.map(view));
});

// Create a login. The admin sets the first password; the user must change it on first login.
router.post('/', async (req, res) => {
  const { name, password, role } = req.body;
  const email = normEmail(req.body.email);
  const username = normUsername(req.body.username);
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  const emailErr = await emailProblem(email);
  if (emailErr) return res.status(409).json({ error: emailErr });
  if (username) {
    const p = await usernameProblem(username);
    if (p) return res.status(409).json({ error: p });
  }
  if (!validPassword(password)) return res.status(400).json({ error: PW_ERROR });

  const user = await User.create({
    name, email, username: username || undefined, role: ROLES.includes(role) ? role : 'user',
    passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true,
  });
  await audit(req, {
    category: 'usuarios', action: 'user.create', summary: `creó la cuenta de ${user.name} (${ROLE_LABEL[user.role]})`,
    target: { type: 'usuario', id: user._id, label: user.name },
  });
  res.status(201).json(view(user));
});

// Edit name, username, email, role, or deactivate/reactivate.
// Deactivated users are logged out on their next request.
router.put('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const { name, role, active } = req.body;
  const before = { name: user.name, email: user.email, username: user.username || '', role: user.role, active: user.active };

  const newRole = ROLES.includes(role) ? role : user.role;
  const newActive = active ?? user.active;
  const losesAdmin = user.role === 'admin' && user.active && (newRole !== 'admin' || !newActive);
  if (losesAdmin) {
    if (String(user._id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes quitarte tu propio acceso de administrador ni desactivarte' });
    }
    const others = await User.countDocuments({ _id: { $ne: user._id }, role: 'admin', active: true });
    if (!others) return res.status(400).json({ error: 'Debe quedar al menos un administrador activo' });
  }

  if (req.body.email !== undefined) {
    const email = normEmail(req.body.email);
    if (email !== user.email) {
      const p = await emailProblem(email, user._id);
      if (p) return res.status(409).json({ error: p });
      user.email = email;
    }
  }
  if (req.body.username !== undefined) {
    const username = normUsername(req.body.username);
    if (username && username !== user.username) {
      const p = await usernameProblem(username, user._id);
      if (p) return res.status(409).json({ error: p });
    }
    user.username = username || undefined;
  }
  if (name?.trim()) user.name = name.trim();
  user.role = newRole;
  user.active = !!newActive;
  await user.save();

  const target = { type: 'usuario', id: user._id, label: user.name };
  const log = (action, summary, details) => audit(req, { category: 'usuarios', action, summary, details, target });
  if (before.role !== user.role) await log('user.role', `cambió el rol de ${user.name} de ${ROLE_LABEL[before.role]} a ${ROLE_LABEL[user.role]}`);
  if (before.active !== user.active) await log(user.active ? 'user.activate' : 'user.deactivate', `${user.active ? 'reactivó' : 'desactivó'} la cuenta de ${user.name}`);
  const fields = [];
  if (before.name !== user.name) fields.push('nombre');
  if (before.email !== user.email) fields.push('correo');
  if (before.username !== (user.username || '')) fields.push('nombre de usuario');
  if (fields.length) await log('user.update', `editó los datos de ${user.name}`, fields);
  res.json(view(user));
});

// Set a new password for someone (forgotten password). They must change it on next login.
router.post('/:id/reset-password', async (req, res) => {
  if (!validPassword(req.body.password)) return res.status(400).json({ error: PW_ERROR });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const wasLocked = !!user.lockedUntil && user.lockedUntil > new Date();
  user.passwordHash = await bcrypt.hash(req.body.password, 10);
  user.mustChangePassword = true;
  user.passwordChangedAt = new Date(); // ends the person's existing sessions
  user.failedLogins = 0;               // lifts any lock
  user.lockedUntil = undefined;
  await user.save();
  // The new password is never logged.
  await audit(req, {
    category: 'usuarios', action: 'user.reset-password',
    summary: `restableció la contraseña de ${user.name}${wasLocked ? ' y levantó el bloqueo de su cuenta' : ''}`,
    target: { type: 'usuario', id: user._id, label: user.name },
  });
  res.json({ ok: true });
});

export default router;
