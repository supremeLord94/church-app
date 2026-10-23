export const ROLE_LABEL = { admin: 'Administrador', user: 'Usuario', teacher: 'Profesor' };
// Where each role lands after login (and when they open a page they can't use).
export const homeFor = (role) => (role === 'teacher' ? '/escuela' : role === 'user' ? '/asistencia' : '/');
