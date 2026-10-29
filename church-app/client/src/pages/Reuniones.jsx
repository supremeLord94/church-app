import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDate, todayISO } from '../api.js';
import { useAuth } from '../auth.jsx';
import { TYPE_LABEL, typePill, typeTitle } from '../gatherings.js';
import PageHeader from '../components/PageHeader.jsx';
import PersonPicker from '../components/PersonPicker.jsx';

function NewGathering({ isAdmin, people, onCancel, onCreated }) {
  const [f, setF] = useState({ type: 'celula', classNumber: '', date: todayISO(), time: '', place: '', section: '', leaderId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...f, classNumber: f.type === 'casa_de_paz' ? Number(f.classNumber) : undefined, section: f.section ? Number(f.section) : undefined };
      onCreated(await api('/gatherings', { method: 'POST', body }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Nueva reunión</h2>
      <div className="seg" role="group" aria-label="Tipo de reunión">
        {Object.entries(TYPE_LABEL).map(([k, v]) => (
          <button key={k} type="button" className={f.type === k ? 'active' : ''} onClick={() => setF((x) => ({ ...x, type: k }))}>{v}</button>
        ))}
      </div>
      <div className="form-row">
        {f.type === 'casa_de_paz' && (
          <label>Clase número (1 a 9)
            <input
              inputMode="numeric" maxLength={1} placeholder="1-9" required autoFocus
              value={f.classNumber}
              onChange={(e) => setF((x) => ({ ...x, classNumber: e.target.value.replace(/[^1-9]/g, '').slice(0, 1) }))}
            />
          </label>
        )}
        <label>Fecha<input type="date" value={f.date} onChange={set('date')} required /></label>
        <label>Hora<input type="time" value={f.time} onChange={set('time')} /></label>
        <label>Lugar<input value={f.place} onChange={set('place')} maxLength={120} placeholder="Casa o dirección" /></label>
        {isAdmin && (
          <label>Sección
            <select value={f.section} onChange={set('section')}>
              <option value="">La del líder</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
            </select>
          </label>
        )}
      </div>
      {isAdmin && (
        <label>Líder de la reunión
          <PersonPicker people={people} value={f.leaderId} onChange={(id) => setF((x) => ({ ...x, leaderId: id }))} placeholder="Escribe el nombre del líder" />
        </label>
      )}
      {!isAdmin && <p className="muted small">Tú quedas como líder de esta reunión. Después puedes agregar personas y marcar a quien sea líder o anfitrión.</p>}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" disabled={busy}>{busy ? 'Creando…' : 'Crear reunión'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function Reuniones() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const [items, setItems] = useState(null);
  const [people, setPeople] = useState([]);
  const [type, setType] = useState('');
  const [section, setSection] = useState('');
  const [weeks, setWeeks] = useState('8');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    api('/people').then((p) => setPeople(p.filter((x) => x.status !== 'inactive'))).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (section && isAdmin) p.set('section', section);
    if (weeks) p.set('weeks', weeks);
    api(`/gatherings?${p}`).then((d) => { setItems(d); setError(''); }).catch((e) => setError(e.message));
  }, [type, section, weeks, isAdmin]);

  return (
    <div className="stack">
      <PageHeader title="Reuniones" sub="Células y casas de paz: quién las dirige, dónde se hicieron y quién asistió.">
        <button className="primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cerrar' : 'Nueva reunión'}</button>
      </PageHeader>

      {adding && <NewGathering isAdmin={isAdmin} people={people} onCancel={() => setAdding(false)} onCreated={(g) => navigate(`/reuniones/${g._id}`)} />}
      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Tipo">
          {[['', 'Todas'], ['celula', 'Células'], ['casa_de_paz', 'Casas de Paz']].map(([k, v]) => (
            <button key={k} className={type === k ? 'active' : ''} onClick={() => setType(k)}>{v}</button>
          ))}
        </div>
        {isAdmin && (
          <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Sección">
            <option value="">Todas las secciones</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
          </select>
        )}
        <select value={weeks} onChange={(e) => setWeeks(e.target.value)} aria-label="Período">
          <option value="4">Últimas 4 semanas</option>
          <option value="8">Últimas 8 semanas</option>
          <option value="26">Últimos 6 meses</option>
          <option value="">Todo</option>
        </select>
      </div>

      {!items && !error && <p className="muted">Cargando…</p>}
      {items && items.length === 0 && <p className="card muted">No hay reuniones con estos filtros. Crea la primera con “Nueva reunión”.</p>}
      {items && items.length > 0 && (
        <div className="card flush scroll-x">
          <table className="table cards-sm gather-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Sección</th><th>Líder</th><th>Anfitrión</th><th>Lugar</th><th>Personas</th></tr></thead>
            <tbody>
              {items.map((g) => (
                <tr key={g._id} onClick={() => navigate(`/reuniones/${g._id}`)}>
                  <td className="first"><strong>{formatDate(g.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>{g.time && <span className="muted"> · {g.time}</span>}</td>
                  <td data-label="Tipo"><span className={`pill ${typePill(g)}`}>{typeTitle(g)}</span></td>
                  <td data-label="Sección">{g.section}</td>
                  <td data-label="Líder">{g.leaders.join(', ') || '—'}</td>
                  <td data-label="Anfitrión">{g.hosts.join(', ') || '—'}</td>
                  <td data-label="Lugar" className="muted">{g.place || '—'}</td>
                  <td data-label="Personas"><strong>{g.count}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
