import { useEffect, useState } from 'react';
import { api, formatDate } from '../api.js';

const day = (iso) => formatDate(iso, { day: 'numeric', month: 'short' });

// This week's reuniones for the admin Dashboard.
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

    </>
  );
}
