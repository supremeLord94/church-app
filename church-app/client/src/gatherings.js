export const TYPE_LABEL = { celula: 'Célula', casa_de_paz: 'Casa de Paz' };
export const typeTitle = (g) => (g.type === 'casa_de_paz' ? `Casa de Paz · clase ${g.classNumber}` : 'Célula');
export const typePill = (g) => (g.type === 'casa_de_paz' ? 'cyan' : 'orange');

// Tags a person can have in one reunión. single: only one person can hold it (tagging someone else moves it).
// Células use all of them; casas de paz only leader, coleader and host. Keep in step with server/src/gatheringRoles.js.
export const ROLES = [
  { key: 'leader', label: 'Líder', single: true, types: ['celula', 'casa_de_paz'], pill: 'orange' },
  { key: 'coleader', label: 'Co-líder', single: false, types: ['celula', 'casa_de_paz'], pill: 'orange' },
  { key: 'subleader', label: 'Sublíder', single: true, types: ['celula'], pill: 'orange' },
  { key: 'host', label: 'Anfitrión', single: true, types: ['celula', 'casa_de_paz'], pill: 'cyan' },
  { key: 'word', label: 'Palabra', single: true, types: ['celula'], pill: 'cyan' },
  { key: 'praise', label: 'Alabanzas', single: true, types: ['celula'], pill: 'cyan' },
  { key: 'prayer', label: 'Oración', single: false, types: ['celula'], pill: 'cyan' },
  { key: 'offering', label: 'Ofrendas', single: false, types: ['celula'], pill: 'cyan' },
];
export const roleOf = Object.fromEntries(ROLES.map((r) => [r.key, r]));
export const rolesFor = (type) => ROLES.filter((r) => r.types.includes(type));
