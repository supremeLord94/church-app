import { useEffect, useState } from 'react';
import { api, formatDate } from '../api.js';
import { useAuth } from '../auth.jsx';
import PageHeader from '../components/PageHeader.jsx';

function TrendChart({ trend, goal }) {
  const W = 640, H = 200, P = { l: 34, r: 12, t: 14, b: 28 };
  const max = Math.max(goal, ...trend.map((t) => t.total), 10);
  const top = Math.ceil(max / 10) * 10;
  const bw = (W - P.l - P.r) / trend.length;
  const y = (v) => H - P.b - (v / top) * (H - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Asistencia por domingo" className="chart">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={y(top * f)} y2={y(top * f)} className="grid-line" />
          <text x={P.l - 6} y={y(top * f) + 4} textAnchor="end" className="axis">{Math.round(top * f)}</text>
        </g>
      ))}
      {trend.map((t, i) => {
        const x = P.l + i * bw + bw * 0.18;
        const w = bw * 0.64;
        return (
          <g key={t.date}>
            <rect x={x} y={y(t.members)} width={w} height={H - P.b - y(t.members)} className="bar-members" />
            <rect x={x} y={y(t.total)} width={w} height={y(t.members) - y(t.total)} className="bar-visitors" />
            <text x={x + w / 2} y={y(t.total) - 4} textAnchor="middle" className="axis">{t.total}</text>
            <text x={x + w / 2} y={H - 10} textAnchor="middle" className="axis">{formatDate(t.date, { day: 'numeric', month: 'numeric' })}</text>
          </g>
        );
      })}
      {goal > 0 && (
        <g>
          <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} className="goal-line" />
          <text x={W - P.r} y={y(goal) - 5} textAnchor="end" className="goal-label">Meta {goal}</text>
        </g>
      )}
    </svg>
  );
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function Birthdays({ list }) {
  const when = (b) =>
    b.daysUntil === 0 ? 'Hoy' : b.daysUntil === 1 ? 'Mañana' : `${formatDate(b.date, { weekday: 'long' })}, en ${b.daysUntil} días`;
  return (
    <section className="card">
      <div className="row between wrap">
        <h2>Próximos cumpleaños</h2>
        <span className="muted small">Próximas 4 semanas · {list.length} {list.length === 1 ? 'persona' : 'personas'}</span>
      </div>
      {list.length === 0 ? (
        <p className="muted">Nadie cumple años en las próximas 4 semanas. Solo aparecen personas con fecha de cumpleaños registrada.</p>
      ) : (
        <ul className="bday-list">
          {list.map((b) => (
            <li key={b._id} className={b.daysUntil === 0 ? 'today' : ''}>
              <span className="bday-date"><strong>{b.day}</strong><span>{MONTHS[b.month - 1]}</span></span>
              <span className="bday-text">
                <strong>{b.firstName} {b.lastName}</strong>
                <span className="muted small">
                  {when(b)}{b.turning ? ` · cumple ${b.turning}` : ''}{b.section ? ` · Sección ${b.section}` : ''}
                </span>
              </span>
              {b.phone && <a className="pill action" href={`tel:${b.phone}`}>Llamar</a>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [goalInput, setGoalInput] = useState('');

  const load = () =>
    api('/stats/overview?weeks=12').then((d) => { setData(d); setGoalInput(d.goal || ''); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function saveGoal(e) {
    e.preventDefault();
    await api('/settings', { method: 'PUT', body: { attendanceGoal: Number(goalInput) || 0 } });
    load();
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;
  if (!data.latest) return (
    <div className="stack">
      <PageHeader title="Resumen" />
      <p className="card">Todavía no hay domingos registrados. Agrega a tu gente en Personas y luego toma asistencia.</p>
      <Birthdays list={data.birthdays || []} />
    </div>
  );

  const { latest, goal, trend, sections } = data;
  const delta = latest.deltaVsPrevious;

  return (
    <div className="stack">
      <PageHeader title="Resumen" sub={`Último domingo registrado: ${formatDate(latest.date)}`}>
        {user.role === 'admin' && (
          <form className="inline-form" onSubmit={saveGoal}>
            <label className="inline">Meta de asistencia
              <input type="number" min="0" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} style={{ width: 90 }} />
            </label>
            <button className="ghost">Guardar meta</button>
          </form>
        )}
      </PageHeader>

      <section className="stats">
        <div className="stat big">
          <strong>{latest.total}</strong>
          <span>asistieron{goal > 0 ? ` · meta ${goal}` : ''}</span>
          {delta !== null && <em className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : ''}{delta} vs. domingo anterior</em>}
        </div>
        <div className="stat"><strong>{latest.membersPresent}</strong><span>de {latest.membersTotal} miembros</span></div>
        <div className="stat"><strong className={latest.membersMissing ? 'warn' : ''}>{latest.membersMissing}</strong><span>miembros faltaron</span></div>
        <div className="stat"><strong>{latest.visitors}</strong><span>visitas</span></div>
        <div className="stat"><strong>{latest.newPeople}</strong><span>personas nuevas</span></div>
        <div className="stat"><strong>{latest.averageLast4}</strong><span>promedio, 4 domingos</span></div>
      </section>

      <div className="dash-grid even">
      <section className="card">
        <h2>Últimos {trend.length} domingos</h2>
        <TrendChart trend={trend} goal={goal} />
        <p className="legend"><span className="sw members" /> Miembros <span className="sw visitors" /> Visitas</p>
      </section>

      <section className="card">
        <h2>Miembros por sección, último domingo</h2>
        <ul className="sections">
          {sections.map((s) => {
            const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
            return (
              <li key={s.section ?? 'none'}>
                <span className="sec-name">{s.section ? `Sección ${s.section}` : 'Sin sección'}</span>
                <span className="meter"><span style={{ width: `${pct}%` }} /></span>
                <span className="sec-num">{s.present}/{s.total} <span className="muted">({pct}%)</span></span>
              </li>
            );
          })}
        </ul>
      </section>
      </div>
      <Birthdays list={data.birthdays || []} />
    </div>
  );
}
