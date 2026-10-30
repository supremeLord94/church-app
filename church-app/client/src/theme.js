const RE = /(?:^|; )theme=(light|dark|auto)/;
const dark = (t) => t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

export const getTheme = () => document.cookie.match(RE)?.[1] || 'light';

export function applyTheme(t) {
  document.documentElement.dataset.theme = dark(t) ? 'dark' : 'light';
}

export function setTheme(t) {
  document.cookie = `theme=${t}; max-age=31536000; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  applyTheme(t);
}

// Call once at startup. "auto" follows the device if it switches while the app is open.
export function initTheme() {
  applyTheme(getTheme());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'auto') applyTheme('auto');
  });
}
