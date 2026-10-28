import { useEffect, useState } from 'react';
import { api, formatDate } from '../api.js';

const SECTION_STATUS = {
  none: { label: 'Sin casas de paz', cls: 'pink solid' },
  behind: { label: 'Atrasada', cls: 'amber' },
  ok: { label: 'Al día', cls: 'green' },
};
const day = (iso) => formatDate(iso, { day: 'numeric', month: 'short' });

// Reuniones numbers for the admin Dashboard: this week, and the last 4 weeks by section and by leader.
export default function GatheringMetrics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/gatherings/summary').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return null;
  const { week } = data;

  return (
    <>
      <section className="card">
        <div className="row between wrap">
          <h2>Reuniones de esta semana</h2>
          <span className="muted small">{day(week.start)} al {day(week.end)} · de lunes a domingo</span>
        </div>
        <div className="week-stats">
          <div className="stat"><strong>{week.celulas.count}</strong><span>{week.celulas.count === 1 ? 'célula' : 'células'} · {week.celulas.people} personas</span></div>
          <div className="stat"><strong>{week.casas.count}</strong><span>{week.casas.count === 1 ? 'casa de paz' : 'casas de paz'} · {week.casas.people} personas</span></div>
        </div>
        <div className="scroll-x">
          <table className="table cards-sm">
            <thead><tr><th>Sección</th><th>Células</th><th>Casas de Paz</th><th>Personas</th></tr></thead>
            <tbody>
              {week.sections.map((s) => (
                <tr key={s.section}>
                  <td className="first"><strong>Sección {s.section}</strong></td>
                  <td data-label="Células">{s.celulas}</td>
                  <td data-label="Casas de Paz">{s.casas}</td>
                  <td data-label="Personas">{s.people}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dash-grid even">
        <section className="card flush">
          <div className="card-head">
            <h2>Casas de Paz por sección</h2>
            <span className="muted small">Últimas {data.weeks} semanas</span>
          </div>
          <table className="table cards-sm">
            <thead><tr><th>Sección</th><th>Casas de Paz</th><th>Células</th><th>Última casa de paz</th><th>Estado</th></tr></thead>
            <tbody>
              {data.sections.map((s) => (
                <tr key={s.section}>
                  <td className="first"><strong>Sección {s.section}</strong></td>
                  <td data-label="Casas de Paz"><strong>{s.casas}</strong></td>
                  <td data-label="Células">{s.celulas}</td>
                  <td data-label="Última casa de paz" className="muted">{s.lastCasa ? day(s.lastCasa) : '—'}</td>
                  <td data-label="Estado"><span className={`pill ${SECTION_STATUS[s.status].cls}`}>{SECTION_STATUS[s.status].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pad muted small">“Atrasada”: menos de la mitad de las casas de paz de la sección que más hizo.</p>
        </section>

        <section className="card flush">
          <div className="card-head">
            <h2>Quién dirige reuniones</h2>
            <span className="muted small">Últimas {data.weeks} semanas</span>
          </div>
          {data.leaders.length === 0 ? (
            <p className="pad muted">Todavía no hay reuniones en este período.</p>
          ) : (
            <table className="table cards-sm">
              <thead><tr><th>Líder</th><th>Sección</th><th>Casas de Paz</th><th>Células</th></tr></thead>
              <tbody>
                {data.leaders.map((l) => (
                  <tr key={l.personId}>
                    <td className="first"><strong>{l.name}</strong></td>
                    <td data-label="Sección">{l.section ? `Sección ${l.section}` : '—'}</td>
                    <td data-label="Casas de Paz"><strong>{l.casas}</strong></td>
                    <td data-label="Células">{l.celulas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
