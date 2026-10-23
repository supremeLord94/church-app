// Usage: npm run create-user -- "Nombre" correo@ejemplo.com contraseña admin
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

const [name, email, password, role = 'user'] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('Uso: npm run create-user -- "Nombre" correo contraseña [admin|user|teacher]');
  process.exit(1);
}
await mongoose.connect(process.env.MONGO_URI);
// mustChangePassword: the password typed here sits in your shell history, so it must be replaced on first login
await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true });
console.log(`Usuario creado: ${email} (${role})`);
await mongoose.disconnect();
