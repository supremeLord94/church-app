import { useEffect, useState } from 'react';
import { api, setToken } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ROLE_LABEL } from '../roles.js';
import PageHeader from '../components/PageHeader.jsx';
import UsernameField from '../components/UsernameField.jsx';

export default function Account() {
  const { user, refresh } = useAuth();

  const [profile, setProfile] = useState({ name: user.name, username: user.username || '', email: user.email || '', currentPassword: '' });
  const [profileError, setProfileError] = useState('');
  const [profileDone, setProfileDone] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);

  useEffect(() => {
    setProfile((p) => ({ ...p, name: user.name, username: user.username || '', email: user.email || '' }));
  }, [user.name, user.username, user.email]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileDone(false);
    try {
      await api('/auth/profile', { method: 'PUT', body: profile });
      setProfile((p) => ({ ...p, currentPassword: '' }));
      setProfileDone(true);
      refresh();
    } catch (err) {
      setProfileError(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwDone(false);
    if (pw.newPassword !== pw.confirm) return setPwError('Las contraseñas nuevas no coinciden');
    try {
      const d = await api('/auth/change-password', { method: 'POST', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      if (d.token) setToken(d.token); // other devices are signed out; this one stays in
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setPwDone(true);
      refresh();
    } catch (err) {
      setPwError(err.message);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Mi cuenta" sub={`${user.name} · ${ROLE_LABEL[user.role]}`} />
      {user.mustChangePassword && (
        <p className="card notice">Un administrador te dio una contraseña temporal. Elige una nueva para continuar.</p>
      )}
      <div className="cards-2">
        <form className="card form-card" onSubmit={saveProfile}>
          <h2>Mis datos</h2>
          <label>Nombre<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></label>
          <UsernameField value={profile.username} onChange={(username) => setProfile({ ...profile, username })} exceptId={user.id} label="Nombre de usuario" />
          <label>Correo<input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /></label>
          <label>Contraseña actual (para confirmar los cambios)
            <input type="password" value={profile.currentPassword} onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })} required autoComplete="current-password" />
          </label>
          {profileError && <p className="error">{profileError}</p>}
          {profileDone && <p className="ok">Datos guardados.</p>}
          <button className="primary">Guardar datos</button>
        </form>

        <form className="card form-card" onSubmit={savePassword}>
          <h2>Cambiar contraseña</h2>
          <label>Contraseña actual<input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" /></label>
          <label>Contraseña nueva (mínimo 8 caracteres)<input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} minLength={8} maxLength={128} required autoComplete="new-password" /></label>
          <label>Repite la contraseña nueva<input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} minLength={8} required autoComplete="new-password" /></label>
          {pwError && <p className="error">{pwError}</p>}
          {pwDone && <p className="ok">Contraseña cambiada.</p>}
          <button className="primary">Guardar contraseña</button>
        </form>
      </div>
    </div>
  );
}
