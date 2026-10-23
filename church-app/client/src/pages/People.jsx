import { useEffect, useState } from 'react';
import { api, fullName } from '../api.js';
import { useAuth } from '../auth.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PersonForm from '../components/PersonForm.jsx';

const STATUS = { member: 'Miembro', visitor: 'Visita', inactive: 'Inactivo' };

export default function People() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, person = edit
  const [error, setError] = useState('');

  const load = () => api('/people').then(setPeople).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = people
    .filter((p) => (section === '' ? true : section === 'none' ? !p.section : p.section === Number(section)))
    .filter((p) => !status || p.status === status)
    .filter((p) => terms.every((t) => `${p.firstName} ${p.lastName} ${p.phone || ''}`.toLowerCase().includes(t)));

  return (
    <div className="stack">
      <PageHeader title="Personas" sub={`${shown.length} ${shown.length === 1 ? 'persona' : 'personas'}`}>
        <button className="primary" onClick={() => setEditing({})}>Persona nueva</button>
      </PageHeader>

      <div className="toolbar wide">
        <input type="search" placeholder="Buscar nombre o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Sección">
          <option value="">Todas las secciones</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Sección {n}</option>)}
          <option value="none">Sin sección</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="split people-split">
        <div className="card flush scroll-x">
          <table className="table stack">
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Sección</th><th>Estado</th></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p._id} className={editing?._id === p._id ? 'selected' : ''} onClick={() => setEditing(p)}>
                  <td className="first"><button className="link-name" onClick={() => setEditing(p)}>{fullName(p)}</button></td>
                  <td className="muted" data-label="Teléfono">{p.phone || '—'}</td>
                  <td data-label="Sección">{p.section ? `Sección ${p.section}` : '—'}</td>
                  <td data-label="Estado"><span className={`pill ${p.status === 'visitor' ? 'pink' : p.status === 'inactive' ? 'grey' : ''}`}>{STATUS[p.status]}</span></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan="4" className="muted pad">No hay personas con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>

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
    </div>
  );
}
