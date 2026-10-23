const TOKEN_KEY = 'church_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(navigator.maxTouchPoints > 1 ? { 'X-Touch': '1' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && getToken()) {
    setToken(null);
    window.location.assign('/login');
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Algo salió mal. Intenta de nuevo.');
    err.status = res.status;
    err.data = data; // e.g. { duplicate: true }
    throw err;
  }
  return data;
}

// ---- date helpers (dates are plain YYYY-MM-DD strings, no timezones) ----
const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function lastSunday(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - d.getDay());
  return toISO(d);
}

export function formatDate(iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', opts);
}

export const fullName = (p) => (p ? `${p.firstName} ${p.lastName}` : '');

export const todayISO = () => toISO(new Date());
