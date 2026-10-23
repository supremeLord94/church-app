import { useEffect, useState } from 'react';
import { api, formatDate, fullName } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';

export default function Missing() {
  const [threshold, setThreshold] = useState(3);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/stats/missing?threshold=${threshold}`).then(setData).catch((e) => setError(e.message));
  }, [threshold]);

  const bySection = [1, 2, 3, 4, 5, null].map((s) => ({
    section: s,
    n: data?.people.filter((p) => (p.section ?? null) === s).length || 0,
  })).filter((s) => s.section !== null || s.n > 0);
  const maxN = Math.max(1, ...bySection.map((s) => s.n));

  return (
    <div className="stack">
      <PageHeader title="Ausentes" sub="Miembros que faltaron varios domingos seguidos. Llámalos o visítalos.">
        <label className="inline">Faltaron al menos
          <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            {[2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n} domingos seguidos</option>)}
          </select>
        </label>
      </PageHeader>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Cargando…</p>}
      {data && data.servicesChecked === 0 && <p className="muted">Todavía no hay domingos registrados. Toma asistencia para empezar.</p>}
      {data && data.servicesChecked > 0 && data.people.length === 0 && (
        <p className="card">Nadie ha faltado {threshold} domingos seguidos.</p>
      )}

      {data && data.people.length > 0 && (
        <div className="split miss-split">
          <div className="card flush scroll-x">
            <table className="table stack">
              <thead><tr><th>Persona</th><th>Seguidos</th><th>Última vez</th><th>Últimos 8 domingos</th><th>Sección</th><th /></tr></thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p._id}>
                    <td className="first"><strong>{fullName(p)}</strong></td>
                    <td data-label="Seguidos"><span className={`pill ${p.consecutiveMissed >= 6 ? 'pink solid' : 'pink'}`}>{p.consecutiveMissed}</span></td>
                    <td className="muted" data-label="Última vez">{p.lastSeen ? formatDate(p.lastSeen, { day: 'numeric', month: 'short' }) : 'Sin asistencia reciente'}</td>
                    <td data-label="Últimos 8 domingos">Faltó {p.missedOfLast8} de {p.checkedLast8}</td>
                    <td data-label="Sección">{p.section ? `Sección ${p.section}` : '—'}</td>
                    <td className="actions">{p.phone && <a className="pill action" href={`tel:${p.phone}`}>Llamar</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="side-panel card">
            <h2>Por sección</h2>
            <p className="muted small">{data.people.length} {data.people.length === 1 ? 'persona' : 'personas'} con {threshold}+ faltas seguidas</p>
            <ul className="sections">
              {bySection.map((s) => (
                <li key={s.section ?? 'none'}>
                  <span className="sec-name">{s.section ? `Sección ${s.section}` : 'Sin sección'}</span>
                  <span className="meter pink"><span style={{ width: `${(s.n / maxN) * 100}%` }} /></span>
                  <span className="sec-num">{s.n}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
