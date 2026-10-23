import { useEffect, useMemo, useState } from 'react';
import { api, formatDate, fullName } from '../../api.js';
import PageHeader from '../../components/PageHeader.jsx';
import EscuelaTabs from '../../components/EscuelaTabs.jsx';
import { COURSES, RISK, STAGES, STAGE_ORDER, courseLabel } from '../../escuela.js';

const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : null);

export default function Students() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [section, setSection] = useState('');
  const [past, setPast] = useState(null); // row for the "past course" dialog
  const [pastCourse, setPastCourse] = useState('abc');

  const load = () => api('/escuela/students').then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return rows
      .filter((r) => !stage || r.stage === stage)
      .filter((r) => (section === '' ? true : section === 'none' ? !r.section : r.section === Number(section)))
      .filter((r) => terms.every((t) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(t)))
      .sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) ||
          Math.max(b.consecutiveMissed, b.consecutiveNoHomework) - Math.max(a.consecutiveMissed, a.consecutiveNoHomework) ||
          a.lastName.localeCompare(b.lastName)
      );
  }, [rows, search, stage, section]);

  async function savePast(e) {
    e.preventDefault();
    try {
      await api('/escuela/completions', { method: 'POST', body: { personId: past.personId, course: pastCourse } });
      setPast(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Escuela de Vida" sub="Progreso de cada persona en los cuatro cursos." />
      <EscuelaTabs />

      <div className="toolbar wide">
        <input type="search" placeholder="Buscar nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="seg" role="group" aria-label="Etapa">
          <button className={stage === '' ? 'active' : ''} onClick={() => setStage('')}>Todos</button>
          {STAGE_ORDER.map((s) => (
            <button key={s} className={stage === s ? 'active' : ''} onClick={() => setStage(s)}>{STAGES[s].label}</button>
          ))}
        </div>
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Sección">
          <option value="">Todas las secciones</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
          <option value="none">Sin sección</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="card flush scroll-x">
        <table className="table cards-sm">
          <thead>
            <tr><th>Persona</th><th>Etapa</th><th>Cursos completados</th><th>Último curso</th><th>Asistencia</th><th>Tareas</th><th>Última asistencia</th><th>Sección</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const att = pctOf(r.attended, r.held);
              const hw = pctOf(r.homework, r.held);
              return (
                <tr key={r.personId}>
                  <td className="first"><strong>{fullName(r)}</strong></td>
                  <td data-label="Etapa"><span className={`pill ${STAGES[r.stage].cls}`}>{STAGES[r.stage].label}</span></td>
                  <td data-label="Cursos completados">{r.completedCourses.length ? r.completedCourses.map(courseLabel).join(', ') : <span className="muted">Ninguno</span>}</td>
                  <td data-label="Último curso">
                    {r.lastCourse ? <>{courseLabel(r.lastCourse)} <span className="muted small">({{ active: 'en curso', completed: 'completado', dropped: 'se retiró' }[r.lastCourseStatus]})</span></> : <span className="muted">—</span>}
                  </td>
                  <td data-label="Asistencia">
                    {att === null ? <span className="muted">—</span> : (
                      <>
                        {r.attended}/{r.held} <span className="muted small">({att}%)</span>
                        {r.stage === 'in_progress' && r.consecutiveMissed >= RISK && <span className="pill pink solid tight">{r.consecutiveMissed} faltas seguidas</span>}
                      </>
                    )}
                  </td>
                  <td data-label="Tareas">
                    {hw === null ? <span className="muted">—</span> : (
                      <>
                        {r.homework}/{r.held} <span className="muted small">({hw}%)</span>
                        {r.stage === 'in_progress' && r.consecutiveNoHomework >= RISK && <span className="pill pink solid tight">{r.consecutiveNoHomework} sin tarea</span>}
                      </>
                    )}
                  </td>
                  <td className="muted" data-label="Última asistencia">{r.lastActivity ? formatDate(r.lastActivity, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td data-label="Sección">{r.section ? `Sección ${r.section}` : '—'}</td>
                  <td className="actions">
                    <button className="link" onClick={() => { setPast(r); setPastCourse(COURSES.find((c) => !r.completedCourses.includes(c.id))?.id || 'abc'); }}>Registrar curso previo</button>
                    {r.phone && <a className="pill action" href={`tel:${r.phone}`}>Llamar</a>}
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan="9" className="muted pad">No hay personas con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small">Se muestran los miembros y cualquier persona inscrita en la escuela. Asistencia y tareas son del curso actual, o del último que tomó.</p>

      {past && (
        <div className="drawer centered" role="dialog" aria-modal="true">
          <form className="sheet narrow" onSubmit={savePast}>
            <div className="sheet-head"><h2>Curso que ya terminó</h2><button type="button" className="link" onClick={() => setPast(null)}>Cerrar</button></div>
            <p className="muted">Para registrar un curso que {fullName(past)} completó antes de usar la aplicación.</p>
            <label>Curso completado
              <select value={pastCourse} onChange={(e) => setPastCourse(e.target.value)}>
                {COURSES.map((c) => <option key={c.id} value={c.id} disabled={past.completedCourses.includes(c.id)}>{c.label}{past.completedCourses.includes(c.id) ? ' (ya registrado)' : ''}</option>)}
              </select>
            </label>
            <div className="sheet-actions"><span style={{ flex: 1 }} /><button type="button" className="ghost" onClick={() => setPast(null)}>Cancelar</button><button className="primary">Guardar</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
