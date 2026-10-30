import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, fullName } from '../api.js';
import { useAuth } from '../auth.jsx';
import { roleOf, rolesFor, typePill, typeTitle } from '../gatherings.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PersonForm from '../components/PersonForm.jsx';
import '../reunionMenu.css';

const MENU_W = 240;

export default function Reunion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [g, setG] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [registering, setRegistering] = useState(false);
  const [menu, setMenu] = useState(null); // { id, top, left }: floating tag menu of one person
  const [q, setQ] = useState('');
  const [section, setSection] = useState('');
  const [found, setFound] = useState({ people: [], total: 0 });
  const sectionSet = useRef(false);

  const load = useCallback(
    () => api(`/gatherings/${id}`).then((d) => {
      setG(d);
      if (!sectionSet.current) { sectionSet.current = true; setSection(String(d.section)); } // people are almost always from the reunión's own section
    }).catch((e) => setError(e.message)),
    [id]
  );
  useEffect(() => { load(); }, [load]);

  // Where to draw the tag menu: under the person's tag button, or above it when there is no room below.
  // Returns null when the button is not on screen (the menu then closes).
  const place = useCallback((personId) => {
    const btn = document.querySelector(`[data-tags-for="${personId}"]`);
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const h = 64 + (g ? rolesFor(g.type).length : 7) * 46;
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    return { id: personId, top, left };
  }, [g]);

  // While the menu is open: follow the button on scroll/resize, close on outside click or Escape.
  useEffect(() => {
    if (!menu) return undefined;
    const move = () => setMenu((m) => (m ? place(m.id) : m));
    const onDown = (e) => { if (!e.target.closest('.tag-menu, .icon-btn.tags')) setMenu(null); };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('scroll', move, true);
    window.addEventListener('resize', move);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', move, true);
      window.removeEventListener('resize', move);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu?.id, place]); // eslint-disable-line

  // After every change the list may reorder: keep the menu next to its button.
  useEffect(() => { setMenu((m) => (m ? place(m.id) : m)); }, [place]);

  // Search people to add: by name, filtered by section (debounced).
  const count = g?.participants.length;
  useEffect(() => {
    if (!g) return undefined;
    if (!q.trim() && !section) { setFound({ people: [], total: 0 }); return undefined; }
    const t = setTimeout(() => {
      const p = new URLSearchParams({ gathering: id });
      if (q.trim()) p.set('q', q.trim());
      if (section) p.set('section', section);
      api(`/gatherings/people?${p}`).then(setFound).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, section, id, count]); // eslint-disable-line

  if (!g) return error ? <p className="error">{error}</p> : <p className="muted">Cargando…</p>;

  const isAdmin = user.role === 'admin';
  const canDelete = isAdmin || g.createdBy?._id === user.id;
  const tags = rolesFor(g.type);
  const has = (p, key) => p.roles.includes(key);
  const holders = (key) => g.participants.filter((p) => has(p, key));
  const people = [...g.participants].sort(
    (a, b) => b.roles.includes('leader') - a.roles.includes('leader') || b.roles.length - a.roles.length || fullName(a.person).localeCompare(fullName(b.person))
  );
  const base = `/gatherings/${id}`;
  const menuPerson = menu && g.participants.find((p) => p.person._id === menu.id);

  const act = async (fn) => {
    setError('');
    try { setG(await fn()); } catch (e) { setError(e.message); }
  };
  const add = (personId) => act(() => api(`${base}/participants`, { method: 'POST', body: { personId } }));
  const setRole = (personId, role, on) => act(() => api(`${base}/participants/${personId}`, { method: 'PUT', body: { role, on } }));
  const remove = (p) => window.confirm(`¿Quitar a ${fullName(p.person)} de esta reunión?`) && act(() => api(`${base}/participants/${p.person._id}`, { method: 'DELETE' }));
  const startEdit = () => { setForm({ date: g.date, time: g.time || '', place: g.place || '', classNumber: g.classNumber ? String(g.classNumber) : '', section: String(g.section) }); setEditing(true); };
  const saveEdit = async (e) => {
    e.preventDefault();
    await act(() => api(base, { method: 'PUT', body: { ...form, classNumber: g.type === 'casa_de_paz' ? Number(form.classNumber) : undefined, section: isAdmin ? Number(form.section) : undefined } }));
    setEditing(false);
  };
  const deleteIt = async () => {
    if (!window.confirm('¿Borrar esta reunión con su lista de personas? No se puede deshacer.')) return;
    try { await api(base, { method: 'DELETE' }); navigate('/reuniones'); } catch (e) { setError(e.message); }
  };

  return (
    <div className="stack">
      <PageHeader
        back={<Link className="back" to="/reuniones">← Reuniones</Link>}
        title={typeTitle(g)}
        sub={`${formatDate(g.date)}${g.time ? ` · ${g.time}` : ''}${g.place ? ` · ${g.place}` : ''} · Sección ${g.section}`}
      >
        <span className={`pill ${typePill(g)}`}>{g.participants.length} {g.participants.length === 1 ? 'persona' : 'personas'}</span>
        <button className="ghost" onClick={() => (editing ? setEditing(false) : startEdit())}>{editing ? 'Cancelar' : 'Editar datos'}</button>
        {canDelete && <button className="danger" onClick={deleteIt}>Borrar</button>}
      </PageHeader>
      {error && <p className="error">{error}</p>}

      {editing && (
        <form className="card form-row" onSubmit={saveEdit}>
          {g.type === 'casa_de_paz' && (
            <label>Clase número (1 a 9)
              <input inputMode="numeric" maxLength={1} required value={form.classNumber} onChange={(e) => setForm({ ...form, classNumber: e.target.value.replace(/[^1-9]/g, '').slice(0, 1) })} />
            </label>
          )}
          <label>Fecha<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label>Hora<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          <label>Lugar<input value={form.place} maxLength={120} onChange={(e) => setForm({ ...form, place: e.target.value })} /></label>
          {isAdmin && (
            <label>Sección
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
              </select>
            </label>
          )}
          <button className="primary">Guardar</button>
        </form>
      )}

      <div className="split gather-split">
        <div className="stack">
          <section className="card">
            <h2>Responsables</h2>
            <dl className="roles-grid">
              {tags.map((r) => (
                <div key={r.key} className="kv">
                  <dt>{r.label}</dt>
                  <dd>{holders(r.key).length ? holders(r.key).map((p) => fullName(p.person)).join(', ') : <span className="muted">Sin asignar</span>}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card flush">
            <div className="card-head">
              <h2>Quién estuvo</h2>
              <span className="muted small">Toca “Etiquetas” para asignar un papel en esta reunión</span>
            </div>
            <ul className="person-list pad-x">
              {people.map((p) => {
                const name = fullName(p.person);
                const isOpen = menu?.id === p.person._id;
                return (
                  <li key={p.person._id} className={`person-row sec-card sec-${p.person.section || 0}`}>
                    <div className="person-main">
                      <span className="person-name">{name}</span>
                      <span className="meta">
                        {p.roles.map((r) => <span key={r} className={`pill ${roleOf[r]?.pill}`}>{roleOf[r]?.label}</span>)}
                        {p.person.section && p.person.section !== g.section && <span className={`pill sec sec-${p.person.section}`}>Sección {p.person.section}</span>}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button className="icon-btn tags" data-tags-for={p.person._id} aria-label={`Etiquetas de ${name}`} title="Etiquetas" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setMenu(isOpen ? null : place(p.person._id))}><Icon name="tag" /></button>
                      <button className="icon-btn remove" aria-label={`Quitar a ${name} de la reunión`} title="Quitar de la reunión" onClick={() => remove(p)}><Icon name="minus" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="pad muted small">Líder, Sublíder, Anfitrión, Palabra y Alabanzas son de una sola persona: si se las das a alguien más, se le quitan a quien las tenía. Co-líder, Oración y Ofrendas pueden ser de varias. Las etiquetas son solo de esta reunión.</p>
          </section>
        </div>

        <aside className="side-panel card">
          <h2>Agregar personas</h2>
          <input type="search" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Sección">
            <option value="">Todas las secciones</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
            <option value="none">Sin sección</option>
          </select>
          {!q.trim() && !section && <p className="muted small">Escribe un nombre o elige una sección para ver personas.</p>}
          {(q.trim() || section) && (
            <>
              <p className="muted small">{found.total} {found.total === 1 ? 'persona' : 'personas'}{found.total > found.people.length ? ` (mostrando ${found.people.length}; escribe más del nombre para acotar)` : ''}</p>
              <ul className="person-list">
                {found.people.map((p) => (
                  <li key={p._id} className={`person-row sec-card result sec-${p.section || 0}`}>
                    <div className="person-main">
                      <span className="person-name">{fullName(p)}</span>
                      <span className="meta">
                        {p.section ? <span className={`pill sec sec-${p.section}`}>Sección {p.section}</span> : <span className="pill">Sin sección</span>}
                        {p.status === 'visitor' && <span className="pill cyan">Visita</span>}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button className="icon-btn add" aria-label={`Agregar a ${fullName(p)}`} title="Agregar a la reunión" onClick={() => add(p._id)}><Icon name="plus" /></button>
                    </div>
                  </li>
                ))}
              </ul>
              {found.total === 0 && <p className="muted small">No hay nadie con ese nombre que falte por agregar. ¿Es nueva? Regístrala abajo.</p>}
            </>
          )}
          <button className="primary" onClick={() => setRegistering(true)}>Registrar persona nueva</button>
          <p className="muted small">Se registra en la base de datos y se agrega a esta reunión{g.type === 'casa_de_paz' ? ' como visita' : ''}.</p>
        </aside>
      </div>

      {menu && menuPerson && (
        <div className="tag-menu" role="menu" aria-label={`Etiquetas de ${fullName(menuPerson.person)}`} style={{ top: menu.top, left: menu.left, width: MENU_W }}>
          <div className="tag-menu-head">{fullName(menuPerson.person)}</div>
          {tags.map((r) => {
            const on = has(menuPerson, r.key);
            const other = r.single && !on ? holders(r.key)[0] : null; // someone else holds it: choosing it moves it
            return (
              <button key={r.key} type="button" role="menuitemcheckbox" aria-checked={on} className={`tag-opt ${on ? 'on' : ''}`} onClick={() => setRole(menu.id, r.key, !on)}>
                <span className="tag-check" aria-hidden="true">{on ? '✓' : ''}</span>
                <span className="tag-name">{r.label}</span>
                {other && <span className="tag-hint">hoy: {other.person.firstName}</span>}
              </button>
            );
          })}
          {error && <p className="tag-error error">{error}</p>}
        </div>
      )}

      {registering && (
        <PersonForm
          limited
          defaults={{ status: g.type === 'casa_de_paz' ? 'visitor' : 'member', section: String(g.section) }}
          onClose={() => setRegistering(false)}
          onSaved={async (p) => { setRegistering(false); await add(p._id); }}
        />
      )}
    </div>
  );
}
