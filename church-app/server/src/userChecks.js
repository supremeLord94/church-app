import User from './models/User.js';

export const USERNAME_RE = /^[a-z0-9]{6,30}$/;
export const USERNAME_HELP = 'Usa de 6 a 30 letras y números, sin espacios ni símbolos';
export const normUsername = (u) => String(u ?? '').trim().toLowerCase();
export const normEmail = (e) => String(e ?? '').trim().toLowerCase();

// Returns an error message, or null when the username is valid and free.
export async function usernameProblem(username, exceptId) {
  if (!USERNAME_RE.test(username)) return USERNAME_HELP;
  const q = { username };
  if (exceptId) q._id = { $ne: exceptId };
  return (await User.exists(q)) ? 'Ese nombre de usuario ya está en uso' : null;
}

export async function emailProblem(email, exceptId) {
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Escribe un correo válido';
  const q = { email };
  if (exceptId) q._id = { $ne: exceptId };
  return (await User.exists(q)) ? 'Ya existe un usuario con ese correo' : null;
}
