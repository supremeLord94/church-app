import 'dotenv/config';

// Anyone who knows JWT_SECRET can forge a login for any user, so refuse to start with a weak one.
if ((process.env.JWT_SECRET || '').length < 32 || /change-me/i.test(process.env.JWT_SECRET)) {
  console.error('JWT_SECRET falta o es muy corto. Genera uno largo con:\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\ny pégalo en server/.env');
  process.exit(1);
}
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import peopleRoutes from './routes/people.js';
import attendanceRoutes from './routes/attendance.js';
import statsRoutes from './routes/stats.js';
import settingsRoutes from './routes/settings.js';
import usersRoutes from './routes/users.js';
import escuelaRoutes from './routes/escuela.js';
import User from './models/User.js';
import activityRoutes from './routes/activity.js';

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
  next();
});
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());
// Real visitor IP (req.ip) when a proxy sits in front of the API.
// Default 'loopback': trust X-Forwarded-For only from a proxy on this same machine (the Vite dev server).
// Hosted behind Render/Railway/nginx, set TRUST_PROXY=1 instead.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : 'loopback');

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/escuela', escuelaRoutes);
app.use('/api/activity', activityRoutes);

app.use((err, _req, res, _next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ error: `Datos inválidos: ${err.message}` });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Identificador inválido' });
  if (err.code === 11000) return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

const port = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => User.updateMany({ role: 'secretary' }, { $set: { role: 'user' } })) // old role name
  .then(() => app.listen(port, () => console.log(`API en http://localhost:${port}`)))
  .catch((e) => {
    console.error('No se pudo conectar a MongoDB', e);
    process.exit(1);
  });
