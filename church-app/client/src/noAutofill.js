// Props that stop browsers and password managers from offering to fill a field
// (used for first name and phone on the new-person forms).
export const noAutofill = (name) => ({
  name: `persona-${name}`,
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
});
