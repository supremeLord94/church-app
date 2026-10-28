import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Person from '../models/Person.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });
  let id, iat;
  try {
    ({ id, iat } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }));
  } catch {
    return res.status(401).json({ error: 'Sesión vencida. Inicia sesión de nuevo' });
  }
  const u = await User.findById(id).select('name email username role active mustChangePassword passwordChangedAt person').lean();
  if (!u || !u.active) return res.status(401).json({ error: 'Tu cuenta está desactivada. Habla con un administrador' });
  if (u.passwordChangedAt && iat < Math.floor(u.passwordChangedAt.getTime() / 1000)) {
    return res.status(401).json({ error: 'Tu contraseña cambió. Inicia sesión de nuevo' });
  }
  req.user = {
    id: String(u._id), name: u.name, email: u.email, username: u.username || '',
    role: u.role, mustChangePassword: !!u.mustChangePassword,
  };
  if (u.role === 'leader') {
    req.user.person = u.person ? String(u.person) : null;
    req.user.section = u.person ? (await Person.findById(u.person).select('section').lean())?.section ?? null : null;
  }
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para hacer esto' });
