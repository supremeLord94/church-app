// Usage: npm run unlock -- correo@ejemplo.com   (or the username)
// For when the locked account is the only admin, so nobody can reset the password from the app.
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const id = String(process.argv[2] || '').trim().toLowerCase();
if (!id) {
  console.error('Uso: npm run unlock -- correo-o-usuario');
  process.exit(1);
}
await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOneAndUpdate(
  id.includes('@') ? { email: id } : { username: id },
  { $set: { failedLogins: 0 }, $unset: { lockedUntil: '' } }
);
console.log(user ? `Cuenta desbloqueada: ${user.email}` : 'No se encontró ese usuario');
await mongoose.disconnect();
