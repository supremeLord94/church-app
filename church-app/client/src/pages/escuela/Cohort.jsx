import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, fullName, todayISO } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import PersonPicker from '../../components/PersonPicker.jsx';
import PersonForm from '../../components/PersonForm.jsx';
import { courseLabel, ENROLLMENT_STATUS } from '../../escuela.js';

export default function Cohort() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [people, setPeople] = useState([]);
  const [cls, setCls] = useState(1);
  const [date, setDate] = useState(todayISO());
  const [adder, setAdder] = useState('');
  const [candidates, setCandidates] = useState([]); // people who can still be added to this group
  const [registering, setRegistering] = useState(false);
  const [teacherUsers, setTeacherUsers] = useState([]);
  const [teacherPick, setTeacherPick] = useState('');
  const isAdmin = user.role === 'admin';
  const [error, setError] = useState('');
  const initialized = useRef(false);

  const loadCandidates = useCallback(() => api(`/escuela/cohorts/${id}/candidates`).then(setCandidates).catch(() => {}), [id]);

  const load = useCallback(
    () =>
      api(`/escuela/cohorts/${id}`)
        .then((d) => {
          setData(d);
          loadCandidates();
          if (!initialized.current) {
            // Open on today's class if it was already started, otherwise on the next one.
            initialized.current = true;
            const last = d.lessons[d.lessons.length - 1];
            setCls(!last ? 1 : last.date === todayISO() ? last.number : Math.min(last.number + 1, d.cohort.totalClasses));
          }
        })
        .catch((e) => setError(e.message)),
    [id, loadCandidates]
  );

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAdmin) return;
    api('/people').then((p) => setPeople(p.filter((x) => x.status !== 'inactive'))).catch(() => {});
    api('/users').then((u) => setTeacherUsers(u.filter((x) => x.role === 'teacher' && x.active))).catch(() => {});
  }, [isAdmin]);

  const lessonMap = useMemo(() => new Map((data?.lessons || []).map((l) => [l.number, l])), [data]);
  const recMap = useMemo(() => new Map((data?.records || []).map((r) => [`${r.number}:${r.person}`, r])), [data]);

  // Show the saved date of the selected class, or today's date if it hasn't been held yet.
  useEffect(() => {
    if (data) setDate(lessonMap.get(cls)?.date || todayISO());
  }, [cls, lessonMap, data]);

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Cargando…</p>;

  const { cohort, enrollments } = data;
  const numbers = Array.from({ length: cohort.totalClasses }, (_, i) => i + 1);
  const active = enrollments.filter((e) => e.status === 'active');
  const available = candidates;
  const rec = (n, pid) => recMap.get(`${n}:${pid}`);
  const presentNow = active.filter((e) => rec(cls, e.person._id)?.present).length;
  const homeworkNow = active.filter((e) => rec(cls, e.person._id)?.homework).length;
  const base = `/escuela/cohorts/${id}`;

  function applyLocal(personId, patch) {
    setData((d) => {
      const records = [...d.records];
      const i = records.findIndex((r) => r.number === cls && r.person === personId);
      if (i >= 0) records[i] = { ...records[i], ...patch };
      else records.push({ number: cls, person: personId, present: false, homework: false, ...patch });
      const lessons = d.lessons.some((l) => l.number === cls) ? d.lessons : [...d.lessons, { number: cls, date }].sort((a, b) => a.number - b.number);
      return { ...d, records, lessons };
    });
  }

  async function mark(personId, field, value) {
    applyLocal(personId, { [field]: value });
    try {
      await api(`${base}/classes/${cls}/records/${personId}`, { method: 'PUT', body: { [field]: value, date } });
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  async function changeDate(v) {
    setDate(v);
    if (!v || !lessonMap.has(cls)) return; // not held yet: the date is saved with the first mark
    try {
      await api(`${base}/classes/${cls}`, { method: 'PUT', body: { date: v } });
      setData((d) => ({ ...d, lessons: d.lessons.map((l) => (l.number === cls ? { ...l, date: v } : l)) }));
    } catch (e) {
      setError(e.message);
    }
  }

  const run = async (fn) => {
    setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  };
  const setTeachers = (ids) => run(() => api(base, { method: 'PUT', body: { teachers: ids } }));
  const markAll = () => Promise.all(active.filter((e) => !rec(cls, e.person._id)?.present).map((e) => mark(e.person._id, 'present', true)));
  const enroll = () => adder && run(async () => { await api(`${base}/enrollments`, { method: 'POST', body: { personId: adder } }); setAdder(''); });
  const setStatus = (e, status) => run(() => api(`/escuela/enrollments/${e._id}`, { method: 'PUT', body: { status } }));
  const removeEnr = (e) => window.confirm(`¿Quitar a ${fullName(e.person)} de este grupo? Se borran sus asistencias y tareas aquí.`) && run(() => api(`/escuela/enrollments/${e._id}`, { method: 'DELETE' }));
  const finish = () => window.confirm('¿Terminar el grupo? Todos los alumnos activos se marcarán como que completaron el curso.') && run(() => api(`${base}/finish`, { method: 'POST' }));
  const deleteCohort = async () => {
    if (!window.confirm('¿Borrar este grupo con todas sus clases, asistencias y tareas? No se puede deshacer.')) return;
    await api(base, { method: 'DELETE' });
    navigate('/escuela');
  };

  return (
    <div className="stack">
      <PageHeader
        back={<Link className="back" to="/escuela">← Escuela de Vida</Link>}
        title={`${courseLabel(cohort.course)} · ${cohort.name}`}
        sub={`Empezó el ${formatDate(cohort.startDate, { day: 'numeric', month: 'long', year: 'numeric' })} · ${data.lessons.length} de ${cohort.totalClasses} clases dadas${cohort.status === 'completed' ? ' · Grupo terminado' : ''}`}
      >
        {isAdmin && cohort.status === 'active' && <button className="ghost" onClick={finish}>Terminar grupo</button>}
        {isAdmin && <button className="danger" onClick={deleteCohort}>Borrar grupo</button>}
      </PageHeader>
      {error && <p className="error">{error}</p>}

      <div className="split cohort-split">
        <div className="stack">
          <section className="card flush">
            <div className="card-head">
              <h2>Progreso del grupo</h2>
              <p className="legend">
                <span className="cell full" /> asistió y entregó tarea
                <span className="cell half" /> asistió sin tarea
                <span className="cell miss" /> faltó
                <span className="cell none" /> clase aún no dada
              </p>
            </div>
            <div className="scroll-x">
              <table className="matrix">
                <thead>
                  <tr>
                    <th className="sticky">Alumno</th>
                    {numbers.map((n) => (
                      <th key={n}>
                        <button className={`cnum ${n === cls ? 'current' : ''} ${lessonMap.has(n) ? 'held' : ''}`} onClick={() => setCls(n)} title={lessonMap.has(n) ? `Clase ${n}: ${formatDate(lessonMap.get(n).date, { day: 'numeric', month: 'short' })}` : `Clase ${n}: aún no dada`}>{n}</button>
                      </th>
                    ))}
                    <th>Asistencia</th><th>Tareas</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const pid = e.person._id;
                    let att = 0, hw = 0;
                    const states = numbers.map((n) => {
                      if (!lessonMap.has(n)) return 'none';
                      const r = rec(n, pid);
                      if (r?.present) att++;
                      if (r?.homework) hw++;
                      return r?.present ? (r.homework ? 'full' : 'half') : 'miss';
                    });
                    const held = data.lessons.length;
                    return (
                      <tr key={e._id} className={e.status !== 'active' ? 'faded' : ''}>
                        <td className="sticky"><strong>{fullName(e.person)}</strong></td>
                        {states.map((s, i) => <td key={i}><span className={`cell ${s}`} /></td>)}
                        <td className="nowrap">{att}/{held}</td>
                        <td className="nowrap">{hw}/{held}</td>
                        <td className="nowrap">
                          <select className="mini" value={e.status} onChange={(ev) => setStatus(e, ev.target.value)} aria-label={`Estado de ${fullName(e.person)}`}>
                            {Object.entries(ENROLLMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          {isAdmin && <button className="link" onClick={() => removeEnr(e)}>Quitar</button>}
                        </td>
                      </tr>
                    );
                  })}
                  {!enrollments.length && <tr><td className="muted pad" colSpan={numbers.length + 4}>Todavía no hay alumnos en este grupo. Inscribe al primero abajo.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Agregar alumno</h2>
            <div className="row wrap">
              <div className="grow"><PersonPicker people={available} value={adder} onChange={setAdder} placeholder="Escribe el nombre de la persona" noResults="Nadie con ese nombre. Solo se puede agregar a personas ya registradas. Usa “Registrar persona nueva”." /></div>
              <button className="primary" onClick={enroll} disabled={!adder}>Agregar al grupo</button>
            </div>
            <div className="row between wrap" style={{ marginTop: 12 }}>
              <span className="muted small">¿No está en la lista? Regístrala y se agrega a este grupo automáticamente.</span>
              <button className="ghost" onClick={() => setRegistering(true)}>Registrar persona nueva</button>
            </div>
          </section>

          {isAdmin && (
            <section className="card">
              <h2>Profesores de este grupo</h2>
              {cohort.teachers.length === 0 && <p className="muted">Sin profesor asignado. Ningún profesor puede ver este grupo todavía.</p>}
              <ul className="rec-list">
                {cohort.teachers.map((t) => (
                  <li key={t._id}>
                    <span className="name">{t.name}{t.username && <span className="muted small"> · {t.username}</span>}</span>
                    <button className="link" onClick={() => setTeachers(cohort.teachers.filter((x) => x._id !== t._id).map((x) => x._id))}>Quitar</button>
                  </li>
                ))}
              </ul>
              <div className="row" style={{ marginTop: 10 }}>
                <select value={teacherPick} onChange={(e) => setTeacherPick(e.target.value)} aria-label="Agregar profesor">
                  <option value="">Agregar profesor…</option>
                  {teacherUsers.filter((t) => !cohort.teachers.some((x) => x._id === t._id)).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <button className="primary" disabled={!teacherPick} onClick={() => { setTeachers([...cohort.teachers.map((x) => x._id), teacherPick]); setTeacherPick(''); }}>Asignar</button>
              </div>
              {teacherUsers.length === 0 && <p className="muted small" style={{ marginTop: 8 }}>Primero crea un usuario con rol Profesor en Usuarios.</p>}
            </section>
          )}
        </div>

        <aside className="side-panel card">
          <h2>Registrar clase</h2>
          <div className="grid2">
            <label>Clase
              <select value={cls} onChange={(e) => setCls(Number(e.target.value))}>
                {numbers.map((n) => <option key={n} value={n}>Clase {n}{lessonMap.has(n) ? ' ✓' : ''}</option>)}
              </select>
            </label>
            <label>Fecha<input type="date" value={date} onChange={(e) => changeDate(e.target.value)} /></label>
          </div>
          <div className="counter"><strong>{presentNow}</strong> de {active.length} presentes<span className="muted"> · {homeworkNow} con tarea</span></div>
          <button className="ghost" onClick={markAll} disabled={!active.length}>Marcar a todos presentes</button>
          <ul className="rec-list">
            {active.map((e) => {
              const r = rec(cls, e.person._id);
              return (
                <li key={e._id}>
                  <span className="name">{fullName(e.person)}</span>
                  <span className="tgls">
                    <button className={`tgl ${r?.present ? 'on' : ''}`} aria-pressed={!!r?.present} onClick={() => mark(e.person._id, 'present', !r?.present)}>Asistió</button>
                    <button className={`tgl ${r?.homework ? 'on' : ''}`} aria-pressed={!!r?.homework} onClick={() => mark(e.person._id, 'homework', !r?.homework)}>Tarea</button>
                  </span>
                </li>
              );
            })}
          </ul>
          {!active.length && <p className="muted">Inscribe alumnos activos para registrar clases.</p>}
        </aside>
      </div>

      {registering && (
        <PersonForm
          limited={!isAdmin}
          people={people}
          onClose={() => setRegistering(false)}
          onSaved={async (p) => {
            setRegistering(false);
            await run(() => api(`${base}/enrollments`, { method: 'POST', body: { personId: p._id } }));
          }}
        />
      )}
    </div>
  );
}
