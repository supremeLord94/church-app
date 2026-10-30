import { useEffect, useState } from 'react';
import { api, fullName } from '../api.js';
import PersonPicker from './PersonPicker.jsx';

// Admin: the two default leaders of each section (usually a couple). New reuniones of the section start with them:
// the first is the Líder and the second the Co-líder.
export default function SectionLeaders({ people }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/settings/section-leaders').then(setList).catch((e) => setError(e.message)); }, []);

  async function save(section, ids) {
    setError('');
    try {
      setList(await api(`/settings/section-leaders/${section}`, { method: 'PUT', body: { people: ids } }));
    } catch (e) {
      setError(e.message);
    }
  }

  if (!list) return error ? <p className="error">{error}</p> : null;

  return (
    <section className="card">
      <h2>Líderes de sección</h2>
      <p className="muted small">Cada sección tiene hasta 2 líderes, normalmente un matrimonio. Las reuniones nuevas de la sección empiezan con ellos: el primero como Líder y el segundo como Co-líder.</p>
      <ul className="sec-leaders">
        {list.map((s) => {
          const ids = s.people.map((p) => p._id);
          return (
            <li key={s.section}>
              <strong className="sec-name">Sección {s.section}</strong>
              <span className="sec-leaders-people">
                {s.people.map((p, i) => (
                  <span key={p._id} className="pill orange">
                    {fullName(p)} · {i === 0 ? 'Líder' : 'Co-líder'}
                    {i === 1 && <button type="button" className="link" title="Poner como líder" aria-label={`Poner a ${fullName(p)} como líder`} onClick={() => save(s.section, [ids[1], ids[0]])}>↑</button>}
                    <button type="button" className="link" title="Quitar" aria-label={`Quitar a ${fullName(p)}`} onClick={() => save(s.section, ids.filter((x) => x !== p._id))}>×</button>
                  </span>
                ))}
                {!s.people.length && <span className="muted small">Sin líderes asignados</span>}
              </span>
              {s.people.length < 2 && (
                <PersonPicker
                  key={`${s.section}-${ids.length}`}
                  people={people.filter((p) => !ids.includes(p._id))}
                  value=""
                  onChange={(id) => id && save(s.section, [...ids, id])}
                  placeholder="Agregar líder"
                />
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
