// Accent- and case-insensitive text for searching ("jose" finds "José")
export const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
