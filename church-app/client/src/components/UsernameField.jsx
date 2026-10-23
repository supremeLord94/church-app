import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Username input that checks, while typing, whether the name is free.
// exceptId: the user being edited, so their own current username doesn't count as taken.
export default function UsernameField({ value, onChange, exceptId, label = 'Nombre de usuario (opcional)' }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (value.length < 6) { setStatus(null); return undefined; } // only check once it could be valid
    let stale = false;
    const t = setTimeout(() => {
      const q = `username=${encodeURIComponent(value)}${exceptId ? `&exceptId=${exceptId}` : ''}`;
      api(`/auth/username-available?${q}`).then((s) => !stale && setStatus(s)).catch(() => !stale && setStatus(null));
    }, 350);
    return () => { stale = true; clearTimeout(t); };
  }, [value, exceptId]);

  return (
    <label>{label}
      <input
        value={value}
        maxLength={30}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
      />
      {status && <span className={`small ${status.available ? 'ok' : 'error'}`}>{status.message}</span>}
      {!status && <span className="small muted">{value && value.length < 6 ? `Faltan ${6 - value.length} caracteres (mínimo 6)` : 'Con él también se puede entrar a la aplicación. De 6 a 30 letras y números, sin símbolos.'}</span>}
    </label>
  );
}
