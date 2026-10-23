// Turns a browser's User-Agent into something a person can read: "iPhone · Safari".
// `touchHint` comes from the app (navigator.maxTouchPoints): iPads in desktop mode report as Macs.
export function parseDevice(ua = '', touchHint = false) {
  const u = String(ua);
  let os = 'Sistema desconocido';
  let type = 'Computadora';
  let model = null;

  if (/iPhone/.test(u)) { os = 'iOS'; type = 'Teléfono'; model = 'iPhone'; }
  else if (/iPad/.test(u) || (/Macintosh/.test(u) && touchHint)) { os = 'iPadOS'; type = 'Tablet'; model = 'iPad'; }
  else if (/Android/.test(u)) { os = 'Android'; type = /Mobile/.test(u) ? 'Teléfono' : 'Tablet'; model = 'Android'; }
  else if (/Windows/.test(u)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(u)) os = 'macOS';
  else if (/CrOS/.test(u)) os = 'ChromeOS';
  else if (/Linux/.test(u)) os = 'Linux';

  let browser = 'Navegador desconocido';
  if (/Edg(?:e|A|iOS)?\//.test(u)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(u)) browser = 'Opera';
  else if (/SamsungBrowser/.test(u)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS/.test(u)) browser = 'Firefox';
  else if (/Chrome\/|CriOS/.test(u)) browser = 'Chrome';
  else if (/Safari\//.test(u)) browser = 'Safari';

  return { type, os, browser, label: `${model || os} · ${browser}`, ua: u.slice(0, 250) };
}
