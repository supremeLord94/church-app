import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../audit.js';
import { MAX_ATTEMPTS, WARN_AT, LOCK_MS, failMessage, lockMessage, ipBlocked, ipFail, unknownFail, unknownState } from '../loginGuard.js';
import { emailProblem, normEmail, normUsername, usernameProblem } from '../userChecks.js';

const router = Router();

const publicUser = (u) => ({
  id: String(u._id), name: u.name, email: u.email, username: u.username || '',
  role: u.role, mustChangePassword: !!u.mustChangePassword,
});
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '14d' });

// Used when the account doesn't exist, so the response takes as long as a real password check.
const DUMMY_HASH = bcrypt.hashSync('contraseña-que-no-existe', 10);

// Log in with email or username (`identifier`).
// 4+ failures: warning. 6 failures: account locked for 10 minutes. An admin password reset lifts the lock.
router.post('/login', async (req, res) => {
  const id = String(req.body.identifier ?? req.body.email ?? '').trim().toLowerCase().slice(0, 100);
  const password = String(req.body.password ?? '').slice(0, 200);
  const ip = String(req.ip || '');
  const now = Date.now();

  if (ipBlocked(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos desde esta conexión. Espera unos minutos e inténtalo de nuevo.' });
  }
  let user = id ? await User.findOne(id.includes('@') ? { email: id } : { username: id }) : null;
  const who = user && { id: String(user._id), name: user.name, role: user.role };

  // An expired lock starts the count again.
  if (user?.lockedUntil && user.lockedUntil.getTime() <= now) {
    user = await User.findByIdAndUpdate(user._id, { $set: { failedLogins: 0 }, $unset: { lockedUntil: '' } }, { new: true });
  }
  // Locked: refuse without even checking the password (so a correct guess reveals nothing).
  const lockedUntil = user ? user.lockedUntil?.getTime() : unknownState(id, now).lockedUntil;
  if (lockedUntil && lockedUntil > now) {
    ipFail(ip, now);
    return res.status(423).json({ error: lockMessage(lockedUntil, now) });
  }

  const valid = (await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)) && !!user;
  if (!valid) {
    ipFail(ip, now);
    let count;
    let lockUntil = null;
    if (user) {
      const upd = await User.findByIdAndUpdate(user._id, { $inc: { failedLogins: 1 } }, { new: true });
      count = upd.failedLogins;
      if (count >= MAX_ATTEMPTS) {
        lockUntil = now + LOCK_MS;
        await User.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(lockUntil) } });
      }
    } else {
      const st = unknownFail(id, now);
      count = st.count;
      lockUntil = st.lockedUntil;
    }
    // What was typed is NOT stored (it could be a password typed in the wrong box).
    if (lockUntil) {
      if (user) await audit(req, { category: 'sesion', action: 'login.locked', actor: who, summary: `se bloqueó la cuenta por ${LOCK_MS / 60000} minutos tras ${MAX_ATTEMPTS} intentos fallidos` });
      return res.status(423).json({ error: lockMessage(lockUntil, now) });
    }
    await audit(req, {
      category: 'sesion', action: 'login.fail', actor: who,
      summary: user ? 'intentó iniciar sesión con una contraseña incorrecta' : 'intentó iniciar sesión con un usuario que no existe',
      details: user && count >= WARN_AT ? [`${count} intentos fallidos seguidos`] : undefined,
    });
    return res.status(401).json({ error: failMessage(count) });
  }

  if (!user.active) {
    await audit(req, { category: 'sesion', action: 'login.blocked', actor: who, summary: 'intentó iniciar sesión con la cuenta desactivada' });
    return res.status(403).json({ error: 'Tu cuenta está desactivada. Habla con un administrador' });
  }
  if (user.failedLogins) await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0 }, $unset: { lockedUntil: '' } });
  await audit(req, { category: 'sesion', action: 'login', actor: who, summary: 'inició sesión' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

// Only used so the activity log can show when someone signed out.
router.post('/logout', requireAuth, async (req, res) => {
  await audit(req, { category: 'sesion', action: 'logout', summary: 'cerró sesión' });
  res.json({ ok: true });
});

// Live check used while typing a username. Admins can pass exceptId (the user being edited);
// everyone else is always compared against the others, never against themselves.
router.get('/username-available', requireAuth, async (req, res) => {
  const username = normUsername(req.query.username);
  const except = req.user.role === 'admin' ? req.query.exceptId || null : req.user.id;
  const problem = await usernameProblem(username, except);
  res.json(problem ? { available: false, message: problem } : { available: true, message: 'Disponible' });
});

// Change your own name, username or email. Requires the current password.
router.put('/profile', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!(await bcrypt.compare(String(req.body.currentPassword ?? ''), user.passwordHash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  const name = String(req.body.name ?? '').trim();
  const email = normEmail(req.body.email);
  const username = normUsername(req.body.username);
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  if (email !== user.email) {
    const p = await emailProblem(email, user._id);
    if (p) return res.status(409).json({ error: p });
  }
  if (username && username !== user.username) {
    const p = await usernameProblem(username, user._id);
    if (p) return res.status(409).json({ error: p });
  }
  const changed = [];
  if (name !== user.name) changed.push('nombre');
  if ((username || '') !== (user.username || '')) changed.push('nombre de usuario');
  if (email !== user.email) changed.push('correo');
  user.name = name;
  user.email = email;
  user.username = username || undefined; // undefined removes it
  await user.save();
  if (changed.length) {
    await audit(req, {
      category: 'cuenta', action: 'profile.update', summary: `cambió sus propios datos: ${changed.join(', ')}`,
      target: { type: 'usuario', id: user._id, label: user.name },
    });
  }
  res.json({ user: publicUser(user) });
});

// Any logged-in user can change their own password.
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener entre 8 y 128 caracteres' });
  }
  const user = await User.findById(req.user.id);
  if (!(await bcrypt.compare(String(currentPassword ?? ''), user.passwordHash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date(); // signs out every other session of this account
  await user.save();
  // Only the fact is logged, never the password itself.
  await audit(req, {
    category: 'cuenta', action: 'password.change', summary: 'cambió su contraseña',
    target: { type: 'usuario', id: user._id, label: user.name },
  });
  res.json({ ok: true, token: sign(user) }); // this device stays signed in
});

export default router;
