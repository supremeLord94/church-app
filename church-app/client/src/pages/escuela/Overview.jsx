import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatDate, fullName, todayISO } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import EscuelaTabs from '../../components/EscuelaTabs.jsx';
import { COURSES, courseLabel } from '../../escuela.js';

function CohortCards({ cohorts, empty, showStatus }) {
  return (
    <>
      {cohorts.length === 0 && <p className="muted">{empty}</p>}
      <ul className="cohort-list">
        {cohorts.map((c) => (
          <li key={c._id}>
            <Link to={`/escuela/grupos/${c._id}`}>
              <strong>{courseLabel(c.course)} · {c.name}{showStatus && c.status === 'completed' && <span className="pill grey tight">Terminado</span>}</strong>
              <span className="muted small">
                Clase {c.held} de {c.totalClasses} · {c.enrolled} alumnos{c.attendancePct !== null && ` · ${c.attendancePct}% asistencia`}
              </span>
              <span className="meter"><span style={{ width: `${Math.round((c.held / c.totalClasses) * 100)}%` }} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function AtRiskTable({ rows, threshold }) {
  if (rows.length === 0) {
    return <p className="pad muted">Nadie ha faltado {threshold} clases seguidas ni dejado de entregar {threshold} tareas seguidas.</p>;
  }
  return (
    <table className="table stack">
      <thead><tr><th>Alumno</th><th>Curso</th><th>Faltas seguidas</th><th>Sin tarea seguidas</th><th>Última asistencia</th><th /></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.personId}>
            <td className="first"><strong>{fullName(r)}</strong></td>
            <td data-label="Curso">{courseLabel(r.currentCourse)}{r.cohortId && <> · <Link to={`/escuela/grupos/${r.cohortId}`}>ver grupo</Link></>}</td>
            <td data-label="Faltas seguidas"><span className={`pill ${r.consecutiveMissed >= threshold ? 'pink solid' : ''}`}>{r.consecutiveMissed}</span></td>
            <td data-label="Sin tarea seguidas"><span className={`pill ${r.consecutiveNoHomework >= threshold ? 'pink solid' : ''}`}>{r.consecutiveNoHomework}</span></td>
            <td className="muted" data-label="Última asistencia">{r.lastAttended ? formatDate(r.lastAttended, { day: 'numeric', month: 'short' }) : 'Nunca ha asistido'}</td>
            <td className="actions">{r.phone && <a className="pill action" href={`tel:${r.phone}`}>Llamar</a>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ course: 'abc', name: '', startDate: todayISO(), totalClasses: 12 });

  useEffect(() => { api('/escuela/overview').then(setData).catch((e) => setError(e.message)); }, []);

  async function createCohort(e) {
    e.preventDefault();
    setError('');
    try {
      const c = await api('/escuela/cohorts', { method: 'POST', body: form });
      navigate(`/escuela/grupos/${c._id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;

  const riskNote = `Faltaron ${data.threshold} clases seguidas, o no entregaron ${data.threshold} tareas seguidas`;

  // Teacher: only their groups and the at-risk students inside them.
  if (data.scoped) {
    return (
      <div className="stack">
        <PageHeader title="Mis grupos" sub="Los grupos de Escuela de Vida que tienes asignados." />
        <div className="dash-grid">
          <section className="card">
            <h2>Grupos</h2>
            <CohortCards cohorts={data.cohorts} showStatus empty="Todavía no tienes grupos asignados. Un administrador te asignará uno." />
          </section>
          <section className="card flush">
            <div className="card-head"><h2>Alumnos en riesgo</h2><span className="muted small">{riskNote}</span></div>
            <AtRiskTable rows={data.atRisk} threshold={data.threshold} />
          </section>
        </div>
      </div>
    );
  }

  const pct = (n) => (data.total ? Math.round((n / data.total) * 100) : 0);

  return (
    <div className="stack">
      <PageHeader title="Escuela de Vida" sub="Quién va avanzando, quién se está quedando atrás y quién ya terminó.">
        {isAdmin && <button className="primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancelar' : 'Nuevo grupo'}</button>}
      </PageHeader>
      <EscuelaTabs />

      {adding && (
        <form className="card form-row" onSubmit={createCohort}>
          <label>Curso
            <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
              {COURSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>Nombre del grupo<input placeholder="Ej. Domingos por la tarde" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></label>
          <label>Primera clase<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label>Número de clases<input type="number" min="1" max="30" value={form.totalClasses} onChange={(e) => setForm({ ...form, totalClasses: e.target.value })} /></label>
          <button className="primary">Crear grupo</button>
          {error && <p className="error full">{error}</p>}
        </form>
      )}

      <section className="stats four">
        <div className="stat big"><strong>{data.graduated}</strong><span>terminaron los 4 cursos</span><em>{pct(data.graduated)}% de {data.total} personas</em></div>
        <div className="stat"><strong>{data.inProgress}</strong><span>estudiando ahora</span></div>
        <div className="stat"><strong className={data.stalled ? 'warn' : ''}>{data.stalled}</strong><span>se detuvieron</span></div>
        <div className="stat"><strong>{data.notStarted}</strong><span>miembros sin empezar</span></div>
      </section>

      <div className="dash-grid">
        <section className="card flush">
          <div className="card-head">
            <h2>En riesgo de abandonar</h2>
            <span className="muted small">{riskNote}</span>
          </div>
          <AtRiskTable rows={data.atRisk} threshold={data.threshold} />
        </section>

        <div className="stack">
          <section className="card">
            <h2>Grupos activos</h2>
            <CohortCards cohorts={data.cohorts} empty="No hay grupos activos. Crea uno con “Nuevo grupo”." />
          </section>

          <section className="card">
            <h2>Cursos completados</h2>
            <ul className="sections">
              {COURSES.map((c) => (
                <li key={c.id}>
                  <span className="sec-name">{c.label}</span>
                  <span className="meter"><span style={{ width: `${pct(data.completedByCourse[c.id])}%` }} /></span>
                  <span className="sec-num">{data.completedByCourse[c.id]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {data.stalledList.length > 0 && (
        <section className="card flush">
          <div className="card-head">
            <h2>Se detuvieron</h2>
            <span className="muted small">Empezaron la escuela pero ya no están en ningún curso</span>
          </div>
          <table className="table stack">
            <thead><tr><th>Persona</th><th>Último curso</th><th>Última asistencia</th><th>Sección</th><th /></tr></thead>
            <tbody>
              {data.stalledList.slice(0, 15).map((r) => (
                <tr key={r.personId}>
                  <td className="first"><strong>{fullName(r)}</strong></td>
                  <td data-label="Último curso">{courseLabel(r.lastCourse)} <span className="muted small">({r.lastCourseStatus === 'completed' ? 'completado' : 'se retiró'})</span></td>
                  <td className="muted" data-label="Última asistencia">{r.lastActivity ? formatDate(r.lastActivity, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td data-label="Sección">{r.section ? `Sección ${r.section}` : '—'}</td>
                  <td className="actions">{r.phone && <a className="pill action" href={`tel:${r.phone}`}>Llamar</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.stalledList.length > 15 && <p className="pad muted small">Y {data.stalledList.length - 15} más. Míralos en la pestaña Alumnos.</p>}
        </section>
      )}
    </div>
  );
}
