import { useState } from 'react';
import { fullName } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import PersonForm from '../components/PersonForm.jsx';

// For teachers: add someone new to the database. They can't see or edit the rest of the people list.
export default function RegisterPerson() {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState([]);

  return (
    <div className="stack">
      <PageHeader title="Registrar persona" sub="Agrega a alguien nuevo a la base de datos.">
        <button className="primary" onClick={() => setOpen(true)}>Persona nueva</button>
      </PageHeader>
      <p className="card muted">
        Aquí puedes registrar personas nuevas. Después, un administrador puede inscribirlas en un grupo de Escuela de Vida.
        Por privacidad no puedes ver ni editar a las demás personas.
      </p>
      {recent.length > 0 && (
        <section className="card">
          <h2>Registradas en esta sesión</h2>
          <ul className="rec-list">
            {recent.map((p) => <li key={p._id}><span className="name">{fullName(p)}</span><span className="pill orange">Registrada</span></li>)}
          </ul>
        </section>
      )}
      {open && <PersonForm limited onClose={() => setOpen(false)} onSaved={(p) => { setRecent((r) => [p, ...r]); setOpen(false); }} />}
    </div>
  );
}
