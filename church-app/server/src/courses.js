// Escuela de Vida courses, in the order students take them.
export const COURSES = ['abc', 'n1', 'n2', 'n3'];
export const COURSE_ORDER = Object.fromEntries(COURSES.map((c, i) => [c, i]));

export const COURSE_LABELS = { abc: 'ABC', n1: 'Nivel 1', n2: 'Nivel 2', n3: 'Nivel 3' };
