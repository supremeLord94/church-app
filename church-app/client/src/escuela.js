export const COURSES = [
  { id: 'abc', label: 'ABC' },
  { id: 'n1', label: 'Nivel 1' },
  { id: 'n2', label: 'Nivel 2' },
  { id: 'n3', label: 'Nivel 3' },
];
export const courseLabel = (id) => COURSES.find((c) => c.id === id)?.label || '—';

export const STAGES = {
  graduated: { label: 'Terminó la escuela', cls: 'orange' },
  in_progress: { label: 'En curso', cls: 'ink' },
  stalled: { label: 'Se detuvo', cls: 'amber' },
  not_started: { label: 'No ha empezado', cls: 'grey' },
};
export const STAGE_ORDER = ['stalled', 'in_progress', 'not_started', 'graduated'];

export const ENROLLMENT_STATUS = { active: 'Activo', completed: 'Completó', dropped: 'Se retiró' };

// A student is flagged after this many classes in a row without attending, or without homework.
export const RISK = 3;
