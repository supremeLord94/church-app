import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ROLE_LABEL } from '../roles.js';
import PageHeader from '../components/PageHeader.jsx';

const CATEGORIES = {
  sesion: 'Sesión',
  cuenta: 'Cuenta',
  usuarios: 'Usuarios',
  personas: 'Personas',
  asistencia: 'Asistencia',
  escuela: 'Escuela de Vida',
  ajustes: 'Ajustes',
};
// Orange = routine, pink = things worth a second look (account/user changes, failed sign-ins).
const pillClass = (a) => (a.action === 'login.fail' || a.action === 'login.blocked' ? 'pink solid' : ['usuarios', 'cuenta'].includes(a.category) ? 'pink' : a.category === 'sesion' ? '' : 'orange');

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ipLabel = (ip) => (['::1', '127.0.0.1'].includes(ip) ? 'Este equipo (local)' : ip || '—');
const fmtTime = (at) => new Date(at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

export default function Activity() {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ q: '', category: '', actor: '', from: '', to: '' });
  const [q, setQ] = useState(''); // debounced copy of filters.q
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/users').then(setUsers).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => { setQ(filters.q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => {
    const params = new URLSearchParams({ page });
    if (q) params.set('q', q);
    ['category', 'actor', 'from', 'to'].forEach((k) => filters[k] && params.set(k, filters[k]));
    api(`/activity?${params}`).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
  }, [page, q, filters.category, filters.actor, filters.from, filters.to]); // eslint-disable-line

  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };
  const range = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFilters((f) => ({ ...f, from: days === null ? '' : iso(from), to: days === null ? '' : iso(to) }));
    setPage(1);
  };
  const clear = () => { setFilters({ q: '', category: '', actor: '', from: '', to: '' }); setQ(''); setPage(1); };
  const filtered = Object.values(filters).some(Boolean);

  const first = data ? (data.page - 1) * data.limit + 1 : 0;
  const last = data ? Math.min(data.page * data.limit, data.total) : 0;

  return (
    <div className="stack">
      <PageHeader title="Registro de actividad" sub="Quién hizo qué, cuándo y desde qué dispositivo. Las contraseñas nunca se guardan: solo queda anotado que alguien la cambió.">
        <div className="seg" role="group" aria-label="Período">
          <button onClick={() => range(0)}>Hoy</button>
          <button onClick={() => range(7)}>7 días</button>
          <button onClick={() => range(30)}>30 días</button>
          <button onClick={() => range(null)}>Todo</button>
        </div>
      </PageHeader>

      <div className="toolbar">
        <input type="search" placeholder="Buscar persona, acción o IP" value={filters.q} onChange={set('q')} />
        <select value={filters.actor} onChange={set('actor')} aria-label="Usuario">
          <option value="">Todos los usuarios</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </select>
        <select value={filters.category} onChange={set('category')} aria-label="Tipo de actividad">
          <option value="">Todo tipo de actividad</option>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="inline">Desde<input type="date" value={filters.from} onChange={set('from')} /></label>
        <label className="inline">Hasta<input type="date" value={filters.to} onChange={set('to')} /></label>
        {filtered && <button className="link" onClick={clear}>Limpiar filtros</button>}
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Cargando…</p>}

      {data && data.items.length === 0 && (
        <p className="card muted">{filtered ? 'No hay actividad con estos filtros.' : 'Todavía no hay actividad registrada.'}</p>
      )}

      {data && data.items.length > 0 && (
        <>
          {/* Wide screens: table */}
          <div className="card flush scroll-x act-table-wrap">
            <table className="table">
              <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué hizo</th><th>Dispositivo</th><th>IP</th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a._id}>
                    <td className="nowrap">{fmtTime(a.at)}</td>
                    <td className="nowrap">
                      <strong>{a.actorName}</strong>
                      {a.actorRole && <div className="muted small">{ROLE_LABEL[a.actorRole] || a.actorRole}</div>}
                    </td>
                    <td>
                      <span className={`pill ${pillClass(a)} tight-right`}>{CATEGORIES[a.category]}</span>
                      {a.summary}
                      {a.details?.length > 0 && <div className="muted small">{a.details.join(' · ')}</div>}
                    </td>
                    <td className="nowrap" title={a.device?.ua}>
                      {a.device?.label || '—'}
                      {a.device?.type && <div className="muted small">{a.device.type}</div>}
                    </td>
                    <td className="muted nowrap" title={a.ip}>{ipLabel(a.ip)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one short card per entry, nothing cut off and no sideways scrolling */}
          <ul className="act-cards">
            {data.items.map((a) => (
              <li key={a._id} className="card act-card">
                <div className="act-top">
                  <span className={`pill ${pillClass(a)}`}>{CATEGORIES[a.category]}</span>
                  <span className="muted small">{fmtTime(a.at)}</span>
                </div>
                <p><strong>{a.actorName}</strong> {a.summary}</p>
                {a.details?.length > 0 && <p className="muted small">{a.details.join(' · ')}</p>}
                <p className="muted small">{a.device?.label || '—'} · {ipLabel(a.ip)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {data && data.total > 0 && (
        <div className="row between wrap">
          <span className="muted small">Mostrando {first}–{last} de {data.total}</span>
          <div className="row">
            <button className="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <span className="muted small">Página {data.page} de {data.pages}</span>
            <button className="ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
