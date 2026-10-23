// Login protection that needs no database: the rules, the messages, and trackers for
// unknown usernames and for IP addresses. (Real accounts keep their counters on the User record.)
export const MAX_ATTEMPTS = 6;          // failed attempts that lock the account
export const WARN_AT = 4;               // from this many failures, warn that the account may be locked
export const LOCK_MS = 10 * 60 * 1000;  // lock duration

export const lockMessage = (untilMs, now = Date.now()) => {
  const mins = Math.max(1, Math.ceil((untilMs - now) / 60000));
  return `Demasiados intentos fallidos. Esta cuenta está bloqueada por ${mins} ${mins === 1 ? 'minuto' : 'minutos'}. Un administrador puede restablecer tu contraseña para desbloquearla antes.`;
};

export const failMessage = (count) => {
  if (count < WARN_AT) return 'Usuario o contraseña incorrectos';
  const left = MAX_ATTEMPTS - count;
  return `Usuario o contraseña incorrectos. Tu cuenta está en riesgo de bloquearse: ${left === 1 ? 'te queda 1 intento' : `te quedan ${left} intentos`} antes de bloquearla por 10 minutos.`;
};

// Names that don't exist get the same warnings and "locks" as real accounts, so the messages
// can't be used to find out which usernames exist. Kept in memory (cleared on restart).
const unknown = new Map();
const prune = (now) => {
  for (const [k, v] of unknown) if (!v.lockedUntil || v.lockedUntil <= now) unknown.delete(k);
  if (unknown.size > 5000) unknown.clear();
};
export function unknownState(id, now = Date.now()) {
  const s = unknown.get(id);
  if (!s) return { count: 0, lockedUntil: null };
  if (s.lockedUntil && s.lockedUntil <= now) { unknown.delete(id); return { count: 0, lockedUntil: null }; }
  return s;
}
export function unknownFail(id, now = Date.now()) {
  if (unknown.size > 2000) prune(now);
  const count = unknownState(id, now).count + 1;
  const next = { count, lockedUntil: count >= MAX_ATTEMPTS ? now + LOCK_MS : null };
  unknown.set(id, next);
  return next;
}

// Extra brake per connection: many failed sign-ins from one address (guessing across many accounts).
const IP_MAX = 30;
const IP_WINDOW_MS = 15 * 60 * 1000;
const ips = new Map();
export function ipBlocked(ip, now = Date.now()) {
  const s = ips.get(ip);
  return !!s && s.resetAt > now && s.count >= IP_MAX;
}
export function ipFail(ip, now = Date.now()) {
  if (ips.size > 5000) ips.clear();
  const s = ips.get(ip);
  if (!s || s.resetAt <= now) ips.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
  else s.count += 1;
}
