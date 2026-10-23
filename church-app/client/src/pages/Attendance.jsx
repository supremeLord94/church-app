import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatDate, fullName, lastSunday } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import PersonPicker from '../components/PersonPicker.jsx';
import { noAutofill } from '../noAutofill.js';

const QUICK_EMPTY = { firstName: '', lastName: '', phone: '', section: '', status: 'visitor', invitedBy: '' };

export default function Attendance() {
  const [date, setDate] = useState(lastSunday());
  const [people, setPeople] = useState([]);
  const [present, setPresent] = useState(new Set());
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('');
  const [view, setView] = useState('all'); // all | present | missing
  const [adding, setAdding] = useState(false);
  const [quick, setQuick] = useState(QUICK_EMPTY);
  const [error, setError] = useState('');

  const loadPeople = useCallback(() => api('/people').then((p) => setPeople(p.filter((x) => x.status !== 'inactive'))), []);
  const loadPresent = useCallback(
    () => api(`/attendance/${date}`).then((d) => setPresent(new Set(d.presentIds))).catch((e) => setError(e.message)),
    [date]
  );

  useEffect(() => { loadPeople().catch((e) => setError(e.message)); }, [loadPeople]);
  useEffect(() => {
    loadPresent();
    // Other people may be checking in too: refresh every 15 seconds.
    const t = setInterval(loadPresent, 15000);
    return () => clearInterval(t);
  }, [loadPresent]);

  async function toggle(p) {
    const next = !present.has(p._id);
    setPresent((s) => { const n = new Set(s); next ? n.add(p._id) : n.delete(p._id); return n; });
    try {
      await api(`/attendance/${date}/${p._id}`, { method: 'PUT', body: { present: next } });
    } catch (e) {
      setError(e.message);
      loadPresent();
    }
  }

  async function addQuick(e, allowDuplicate = false) {
    e?.preventDefault();
    setError('');
    try {
      const created = await api('/people', {
        method: 'POST',
        body: { ...quick, section: quick.section ? Number(quick.section) : '', joinedAt: date, allowDuplicate },
      });
      await api(`/attendance/${date}/${created._id}`, { method: 'PUT', body: { present: true } });
      setPeople((ps) => [...ps, created]);
      setPresent((s) => new Set(s).add(created._id));
      setQuick(QUICK_EMPTY);
      setAdding(false);
    } catch (err) {
      if (err.data?.duplicate && window.confirm(`${err.message}\n\n¿Registrarla de todos modos? Solo si es otra persona con el mismo nombre.`)) return addQuick(null, true);
      setError(err.message);
    }
    return undefined;
  }

  const shown = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return people
      .filter((p) => (section === '' ? true : section === 'none' ? !p.section : p.section === Number(section)))
      .filter((p) => view === 'all' || (view === 'present') === present.has(p._id))
      .filter((p) => terms.every((t) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(t)))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [people, present, search, section, view]);

  const visitorsPresent = people.filter((p) => p.status === 'visitor' && present.has(p._id)).length;

  return (
    <div className="stack">
      <PageHeader title="Asistencia" sub={formatDate(date)} />
      {error && <p className="error">{error}</p>}

      <div className="split att-split">
        <section>
          <ul className="tiles">
            {shown.map((p) => {
              const on = present.has(p._id);
              return (
                <li key={p._id}>
                  <button className={`tile ${on ? 'on' : ''}`} onClick={() => toggle(p)} aria-pressed={on}>
                    <span className="check" aria-hidden="true">{on ? '✓' : ''}</span>
                    <span className="tile-text">
                      <span className="name">{fullName(p)}</span>
                      <span className="meta">
                        {p.status === 'visitor' && <span className="pill cyan">Visita</span>}
                        {p.section && <span className="pill">Sección {p.section}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!shown.length && <p className="card muted">No hay personas con estos filtros. Prueba otra búsqueda o agrega una persona nueva.</p>}
        </section>

        <aside className="side-panel card">
          <label>Fecha del servicio
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>

          <div className="counter">
            <strong>{present.size}</strong> presentes
            <span className="muted"> · {present.size - visitorsPresent} miembros, {visitorsPresent} visitas</span>
          </div>

          <input type="search" placeholder="Buscar nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Sección">
            <option value="">Todas las secciones</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
            <option value="none">Sin sección</option>
          </select>
          <div className="seg" role="group" aria-label="Filtrar">
            {[['all', 'Todos'], ['present', 'Presentes'], ['missing', 'Faltan']].map(([k, label]) => (
              <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>{label}</button>
            ))}
          </div>
          <button className={adding ? 'ghost' : 'primary'} onClick={() => setAdding((a) => !a)}>{adding ? 'Cancelar' : 'Persona nueva'}</button>

          {adding && (
            <form className="quick" onSubmit={addQuick}>
              <label>Nombre<input {...noAutofill('nombre')} value={quick.firstName} onChange={(e) => setQuick({ ...quick, firstName: e.target.value })} required autoFocus /></label>
              <label>Apellido<input autoComplete="family-name" value={quick.lastName} onChange={(e) => setQuick({ ...quick, lastName: e.target.value })} required /></label>
              <label>Teléfono<input {...noAutofill('telefono')} type="text" inputMode="tel" value={quick.phone} onChange={(e) => setQuick({ ...quick, phone: e.target.value })} /></label>
              <label>Sección
                <select value={quick.section} onChange={(e) => setQuick({ ...quick, section: e.target.value })}>
                  <option value="">Sin sección</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
                </select>
              </label>
              <label>Estado
                <select value={quick.status} onChange={(e) => setQuick({ ...quick, status: e.target.value })}>
                  <option value="visitor">Visita</option>
                  <option value="member">Miembro</option>
                </select>
              </label>
              <label>Invitado por
                <PersonPicker people={people} value={quick.invitedBy} onChange={(id) => setQuick({ ...quick, invitedBy: id })} />
              </label>
              <p className="muted small">Se marcará como presente. Completa dirección y familiares después en Personas.</p>
              <button className="primary">Guardar y marcar presente</button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
