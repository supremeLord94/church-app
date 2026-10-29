import { useEffect, useMemo, useState } from 'react';
import { api, formatDate, fullName } from '../api.js';
import { useAuth } from '../auth.jsx';
import { plain } from '../text.js';
import PageHeader from '../components/PageHeader.jsx';
import PersonForm from '../components/PersonForm.jsx';

const STATUS = { member: 'Miembro', visitor: 'Visita', inactive: 'Inactivo' };
const PAGE = 60; // cards shown at first; "Mostrar más" adds another batch

function ageOf(birthday) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday || '');
  if (!m || Number(m[1]) < 1900) return null;
  const now = new Date();
  const passed = now.getMonth() + 1 > Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() >= Number(m[3]));
  return now.getFullYear() - Number(m[1]) - (passed ? 0 : 1);
}

function PersonCard({ p, byId, onOpen }) {
  const a = p.address || {};
  const address = [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ');
  const age = ageOf(p.birthday);
  const family = (p.relatives || [])
    .map((r) => (byId[r.person] ? `${fullName(byId[r.person])}${r.relationship ? ` (${r.relationship})` : ''}` : null))
    .filter(Boolean)
    .join(', ');

  const rows = [];
  if (p.phone) rows.push(['Teléfono', <a key="t" href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()}>{p.phone}</a>]);
  if (address) rows.push(['Dirección', address]);
  if (p.birthday) rows.push(['Cumpleaños', `${formatDate(p.birthday, { day: 'numeric', month: 'long' })}${age !== null ? ` · ${age} años` : ''}`]);
  if (p.invitedBy && byId[p.invitedBy]) rows.push(['Invitado por', fullName(byId[p.invitedBy])]);
  if (family) rows.push(['Familia', family]);
  if (p.joinedAt) rows.push(['Desde', formatDate(p.joinedAt, { day: 'numeric', month: 'short', year: 'numeric' })]);
  if (p.notes) rows.push(['Notas', <span key="n" className="clamp2">{p.notes}</span>]);

  return (
    <article className={`person-card ${p.status === 'inactive' ? 'faded' : ''}`} onClick={onOpen}>
      <header>
        <h2><button className="link-name" onClick={onOpen}>{fullName(p)}</button></h2>
        <div className="meta">
          <span className={`pill ${p.status === 'visitor' ? 'cyan' : p.status === 'inactive' ? 'grey' : 'orange'}`}>{STATUS[p.status]}</span>
          {p.section && <span className="pill">Sección {p.section}</span>}
          {p.baptized && <span className="pill green">Bautizado</span>}
          {p.macroencuentro && <span className="pill green">Macroencuentro</span>}
        </div>
      </header>
      {rows.length ? (
        <dl>
          {rows.map(([label, value]) => (
            <div key={label} className="kv"><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      ) : (
        <p className="muted small">Todavía no hay más datos. Toca la tarjeta para completarlos.</p>
      )}
    </article>
  );
}

export default function People() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState('');
  const [baptized, setBaptized] = useState(''); // '' = all, 'yes', 'no'
  const [macro, setMacro] = useState('');       // '' = all, 'yes', 'no'
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, person = edit
  const [error, setError] = useState('');

  const load = () => api('/people').then(setPeople).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => { setLimit(PAGE); }, [search, section, status, baptized, macro]);

  const byId = useMemo(() => Object.fromEntries(people.map((p) => [p._id, p])), [people]);

  // What the search looks through: name, phone, address and notes.
  const indexed = useMemo(
    () => people.map((p) => ({
      p,
      hay: plain([p.firstName, p.lastName, p.phone, p.address?.street, p.address?.city, p.address?.state, p.address?.zip, p.notes].join(' ')),
    })),
    [people]
  );

  const shown = useMemo(() => {
    const terms = plain(search).split(/\s+/).filter(Boolean);
    return indexed
      .filter(({ p }) => (section === '' ? true : section === 'none' ? !p.section : p.section === Number(section)))
      .filter(({ p }) => !status || p.status === status)
      .filter(({ p }) => !baptized || !!p.baptized === (baptized === 'yes')) // people saved before this field count as "no"
      .filter(({ p }) => !macro || !!p.macroencuentro === (macro === 'yes'))
      .filter(({ hay }) => terms.every((t) => hay.includes(t)))
      .map(({ p }) => p);
  }, [indexed, search, section, status, baptized, macro]);

  return (
    <div className="stack">
      <PageHeader title="Personas" sub={`${shown.length} ${shown.length === 1 ? 'persona' : 'personas'}`}>
        <button className="primary" onClick={() => setEditing({})}>Persona nueva</button>
      </PageHeader>

      <div className="toolbar wide">
        <input type="search" placeholder="Buscar por nombre, teléfono, dirección o notas" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Sección">
          <option value="">Red 1-8</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Red {n}</option>)}
          <option value="none">Sin red</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={baptized} onChange={(e) => setBaptized(e.target.value)} aria-label="Bautismo">
          <option value="">Bautismo: todos</option>
          <option value="yes">Bautizados</option>
          <option value="no">Sin bautizar</option>
        </select>
        <select value={macro} onChange={(e) => setMacro(e.target.value)} aria-label="Macroencuentro">
          <option value="">Macroencuentro: todos</option>
          <option value="yes">Hicieron el Macroencuentro</option>
          <option value="no">Sin Macroencuentro</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="people-grid">
        {shown.slice(0, limit).map((p) => <PersonCard key={p._id} p={p} byId={byId} onOpen={() => setEditing(p)} />)}
      </div>
      {!shown.length && <p className="card muted">No hay personas con estos filtros.</p>}
      {shown.length > limit && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="ghost" onClick={() => setLimit((l) => l + PAGE)}>Mostrar más ({shown.length - limit} restantes)</button>
        </div>
      )}

      {editing && (
        <PersonForm
          person={editing}
          people={people}
          isAdmin={user?.role === 'admin'}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onDeleted={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
