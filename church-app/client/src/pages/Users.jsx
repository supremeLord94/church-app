import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ROLE_LABEL } from '../roles.js';
import PageHeader from '../components/PageHeader.jsx';
import UsernameField from '../components/UsernameField.jsx';

// 12 characters, no look-alike characters (0/O, 1/l/I).
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const ROLE_HELP = {
  user: 'Usuario: toma asistencia, registra personas nuevas y edita sus datos',
  teacher: 'Profesor: solo ve los grupos de Escuela de Vida que le asignes; marca asistencia, tareas y si completó el curso',
  admin: 'Administrador: acceso a todo, incluyendo usuarios',
};

function RoleSelect({ value, onChange }) {
  return (
    <label>Rol
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.keys(ROLE_HELP).map((r) => <option key={r} value={r}>{ROLE_HELP[r]}</option>)}
      </select>
    </label>
  );
}

function PasswordField({ value, onChange }) {
  const [show, setShow] = useState(true);
  return (
    <label>Contraseña (8 a 128 caracteres)
      <div className="row">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} minLength={8} maxLength={128} required autoComplete="new-password" />
        <button type="button" className="ghost" onClick={() => onChange(generatePassword())}>Generar</button>
        <button type="button" className="link" onClick={() => setShow((s) => !s)}>{show ? 'Ocultar' : 'Mostrar'}</button>
      </div>
    </label>
  );
}

function Dialog({ title, onClose, onSubmit, submitLabel, error, children }) {
  return (
    <div className="drawer centered" role="dialog" aria-modal="true">
      <form className="sheet narrow" onSubmit={onSubmit}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose}>Cerrar</button>
        </div>
        {children}
        {error && <p className="error">{error}</p>}
        <div className="sheet-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primary">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [dialog, setDialog] = useState(null); // {type:'new'} | {type:'edit', u} | {type:'reset', u}
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // shown once after create/reset

  const load = () => api('/users').then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const open = (d) => {
    setError('');
    setForm(
      d.type === 'new' ? { name: '', username: '', email: '', role: 'user', password: generatePassword() }
      : d.type === 'edit' ? { name: d.u.name, username: d.u.username || '', email: d.u.email, role: d.u.role, active: d.u.active }
      : { password: generatePassword() }
    );
    setDialog(d);
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (dialog.type === 'new') {
        const u = await api('/users', { method: 'POST', body: form });
        setNotice({ name: u.name, login: u.username || u.email, password: form.password, what: 'creada', teacher: u.role === 'teacher' });
      } else if (dialog.type === 'reset') {
        await api(`/users/${dialog.u._id}/reset-password`, { method: 'POST', body: { password: form.password } });
        setNotice({ name: dialog.u.name, login: dialog.u.username || dialog.u.email, password: form.password, what: 'restablecida' });
      } else {
        await api(`/users/${dialog.u._id}`, { method: 'PUT', body: form });
      }
      setDialog(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Usuarios" sub="Personas que pueden entrar a la aplicación. Pueden iniciar sesión con su correo o con su nombre de usuario.">
        <button className="primary" onClick={() => open({ type: 'new' })}>Nuevo usuario</button>
      </PageHeader>

      {notice && (
        <div className="card notice">
          <div>
            <strong>Cuenta {notice.what} para {notice.name}.</strong>
            <p className="muted">Compárteles esta contraseña temporal. Deberán cambiarla la primera vez que entren. Por seguridad no se vuelve a mostrar.</p>
            <p className="pw">Entra con: {notice.login} · <code>{notice.password}</code></p>
            {notice.teacher && <p className="muted small">Para que este profesor vea un grupo, asígnalo desde la página del grupo en Escuela de Vida.</p>}
          </div>
          <div className="row">
            <button className="ghost" onClick={() => navigator.clipboard?.writeText(notice.password)}>Copiar contraseña</button>
            <button className="link" onClick={() => setNotice(null)}>Listo</button>
          </div>
        </div>
      )}
      {error && !dialog && <p className="error">{error}</p>}

      <ul className="user-grid">
        {users.map((u) => (
          <li key={u._id} className={`card user-card ${u.active ? '' : 'faded'}`}>
            <div className="user-top">
              <div className="user-who">
                <strong>{u.name}</strong>{u._id === me.id && <span className="muted small"> (tú)</span>}
                <div className="muted small">{u.username ? `${u.username} · ` : ''}{u.email}</div>
              </div>
              <span className={`pill ${u.role === 'admin' ? 'orange' : u.role === 'teacher' ? 'pink' : ''}`}>{ROLE_LABEL[u.role] || u.role}</span>
            </div>
            <div>
              {u.lockedUntil ? <span className="pill pink solid" title="Se desbloquea sola o al restablecer la contraseña">Bloqueado hasta {new Date(u.lockedUntil).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}</span>
                : !u.active ? <span className="pill grey">Desactivado</span>
                : u.mustChangePassword ? <span className="pill pink">Debe cambiar contraseña</span>
                : <span className="pill">Activo</span>}
            </div>
            <div className="user-actions">
              <button className="ghost" onClick={() => open({ type: 'edit', u })}>Editar</button>
              <button className="ghost" onClick={() => open({ type: 'reset', u })}>Restablecer contraseña</button>
            </div>
          </li>
        ))}
      </ul>

      {dialog?.type === 'new' && (
        <Dialog title="Nuevo usuario" onClose={() => setDialog(null)} onSubmit={submit} submitLabel="Crear usuario" error={error}>
          <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></label>
          <label>Correo<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <UsernameField value={form.username} onChange={(username) => setForm({ ...form, username })} />
          <RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <PasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} />
        </Dialog>
      )}
      {dialog?.type === 'edit' && (
        <Dialog title={`Editar a ${dialog.u.name}`} onClose={() => setDialog(null)} onSubmit={submit} submitLabel="Guardar cambios" error={error}>
          <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Correo<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <UsernameField value={form.username} onChange={(username) => setForm({ ...form, username })} exceptId={dialog.u._id} />
          <RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <label className="check-line">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Cuenta activa (si la desactivas, se le cierra la sesión)
          </label>
        </Dialog>
      )}
      {dialog?.type === 'reset' && (
        <Dialog title={`Restablecer contraseña de ${dialog.u.name}`} onClose={() => setDialog(null)} onSubmit={submit} submitLabel="Restablecer" error={error}>
          <p className="muted">Escribe una contraseña nueva o genera una. Tendrá que cambiarla al entrar.</p>
          <PasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} />
        </Dialog>
      )}
    </div>
  );
}
