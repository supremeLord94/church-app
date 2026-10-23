import { useEffect, useMemo, useState } from 'react';
import { api, formatDate, fullName } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';

// Critical: 4+ missed services in the last 6 weeks. Low: 2 or 3. One missed service gets no tag.
const FILTERS = [['all', 'Todos'], ['critical', 'Crítico'], ['low', 'Baja'], ['one', '1 falta']];
const levelOf = (p) => p.level || 'one';

export default function Missing() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => { api('/stats/missing').then(setData).catch((e) => setError(e.message)); }, []);

  const shown = useMemo(() => (data ? data.people.filter((p) => filter === 'all' || levelOf(p) === filter) : []), [data, filter]);
  const countOf = (k) => (!data ? 0 : k === 'all' ? data.people.length : data.counts[k]);

  const bySection = [1, 2, 3, 4, 5, null].map((s) => {
    const mine = (data?.people || []).filter((p) => (p.section ?? null) === s);
    return { section: s, critical: mine.filter((p) => p.level === 'critical').length, low: mine.filter((p) => p.level === 'low').length };
  }).filter((s) => s.section !== null || s.critical + s.low > 0);
  const maxN = Math.max(1, ...bySection.map((s) => s.critical + s.low));
  const day = (iso) => formatDate(iso, { day: 'numeric', month: 'short' });

  return (
    <div className="stack">
      <PageHeader
        title="Ausentes"
        sub={data?.latestService
          ? `Miembros que faltaron a algún servicio en las últimas ${data.weeks} semanas (del ${day(data.windowStart)} al ${day(data.latestService)}). Cada falta cuenta, aunque no sea seguida.`
          : 'Miembros que faltaron a algún servicio en las últimas 6 semanas.'}
      />

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Cargando…</p>}
      {data && !data.latestService && <p className="muted">Todavía no hay domingos registrados. Toma asistencia para empezar.</p>}
      {data?.latestService && data.people.length === 0 && (
        <p className="card">Todos los miembros asistieron a todos los servicios de las últimas {data.weeks} semanas.</p>
      )}

      {data && data.people.length > 0 && (
        <>
          <div className="row between wrap">
            <div className="seg" role="group" aria-label="Filtrar por nivel">
              {FILTERS.map(([k, label]) => (
                <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{label} ({countOf(k)})</button>
              ))}
            </div>
            <p className="muted small">
              <span className="pill pink solid">Crítico</span> 4 o más faltas · <span className="pill amber">Baja</span> 2 o 3 faltas · 1 falta: sin etiqueta
            </p>
          </div>

          <div className="split miss-split">
            <div className="card flush scroll-x">
              <table className="table cards-sm">
                <thead><tr><th>Persona</th><th>Faltas</th><th>Asistencia</th><th>Estado</th><th>Última vez</th><th>Sección</th><th /></tr></thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p._id}>
                      <td className="first"><strong>{fullName(p)}</strong></td>
                      <td data-label="Faltas"><strong>{p.missed}</strong> {p.missed === 1 ? 'falta' : 'faltas'}</td>
                      <td data-label="Asistencia">Asistió {p.attended} de {p.eligible}</td>
                      <td data-label="Estado">
                        {p.level === 'critical' ? <span className="pill pink solid">Crítico</span>
                          : p.level === 'low' ? <span className="pill amber">Baja</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td data-label="Última vez" className="muted">{p.lastSeen ? day(p.lastSeen) : 'Sin asistencia reciente'}</td>
                      <td data-label="Sección">{p.section ? `Sección ${p.section}` : '—'}</td>
                      <td className="actions">{p.phone && <a className="pill action" href={`tel:${p.phone}`}>Llamar</a>}</td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan="7" className="muted pad">No hay personas en este grupo.</td></tr>}
                </tbody>
              </table>
            </div>

            <aside className="side-panel card">
              <h2>Por sección</h2>
              <p className="muted small">Personas con nivel crítico o baja asistencia</p>
              <ul className="sections">
                {bySection.map((s) => (
                  <li key={s.section ?? 'none'}>
                    <span className="sec-name">{s.section ? `Sección ${s.section}` : 'Sin sección'}</span>
                    <span className="meter pink"><span style={{ width: `${((s.critical + s.low) / maxN) * 100}%` }} /></span>
                    <span className="sec-num">{s.critical + s.low}</span>
                  </li>
                ))}
              </ul>
              <p className="muted small">Crítico: {data.counts.critical} · Baja: {data.counts.low}</p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
