// YYYY-MM-DD in the server's local timezone (set TZ=America/Los_Angeles in .env/host if needed).
export const today = () => new Date().toLocaleDateString('en-CA');
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const ROLE_LABEL = { admin: 'Administrador', user: 'Usuario', teacher: 'Profesor', leader: 'Líder' };
// "domingo, 18 de octubre" for a YYYY-MM-DD string
export const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
};
export const isId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
export const SECTIONS = [1, 2, 3, 4, 5];
export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
};
// "18 oct" for a YYYY-MM-DD string
export const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
};
// accent- and case-insensitive text for searching ("jose" finds "José")
export const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
