import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ROLE_LABEL, homeFor } from './roles.js';
import Icon from './components/Icon.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Attendance from './pages/Attendance.jsx';
import People from './pages/People.jsx';
import Missing from './pages/Missing.jsx';
import Users from './pages/Users.jsx';
import Account from './pages/Account.jsx';
import Activity from './pages/Activity.jsx';
import RegisterPerson from './pages/RegisterPerson.jsx';
import Reuniones from './pages/Reuniones.jsx';
import Reunion from './pages/Reunion.jsx';
import EscuelaOverview from './pages/escuela/Overview.jsx';
import EscuelaStudents from './pages/escuela/Students.jsx';
import Cohort from './pages/escuela/Cohort.jsx';

const ALL = ['admin', 'user', 'teacher', 'leader'];
// Who sees each menu item. Pages enforce the same rules (and the API enforces them again).
const NAV = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true, roles: ['admin'] },
  { to: '/asistencia', label: 'Asistencia', icon: 'check', roles: ['admin', 'user'] },
  { to: '/ausentes', label: 'Ausentes', icon: 'alert', roles: ['admin'] },
  { to: '/personas', label: 'Personas', icon: 'people', roles: ['admin', 'user'] },
  { to: '/reuniones', label: 'Reuniones', icon: 'chat', roles: ['admin', 'leader'] },
  { to: '/escuela', label: 'Escuela de Vida', icon: 'book', roles: ['admin', 'teacher'] },
  { to: '/registrar', label: 'Registrar persona', icon: 'people', roles: ['teacher', 'leader'] },
  { to: '/usuarios', label: 'Usuarios', icon: 'shield', roles: ['admin'] },
  { to: '/actividad', label: 'Actividad', icon: 'log', roles: ['admin'] },
];

function Shell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false); // slide-in menu on phones and tablets

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="menu-btn" aria-label="Abrir menú" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
          <Icon name="menu" />
        </button>
        <span className="brand"><img className="brand-logo" src="/logo.png" alt="" />Familia Real</span>
      </header>

      {open && <button className="scrim" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}

      <aside id="sidebar" className={`side ${open ? 'open' : ''}`}>
        <div className="side-head">
          <span className="brand"><img className="brand-logo" src="/logo.png" alt="" />Familia Real</span>
          <button className="menu-btn close" aria-label="Cerrar menú" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <nav className="nav">
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <Icon name={n.icon} /> <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <NavLink to="/cuenta" className="who" aria-label="Mi cuenta" title="Mi cuenta">
            <Icon name="settings" />
            <div className="who-text">
              <strong>{user.name}</strong>
              <span>{ROLE_LABEL[user.role]} · Mi cuenta</span>
            </div>
          </NavLink>
          <button className="link" onClick={logout}>Salir</button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

function Protected({ children, roles = ALL }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <p className="muted pad">Cargando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && pathname !== '/cuenta') return <Navigate to="/cuenta" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected roles={['admin']}><Dashboard /></Protected>} />
      <Route path="/asistencia" element={<Protected roles={['admin', 'user']}><Attendance /></Protected>} />
      <Route path="/ausentes" element={<Protected roles={['admin']}><Missing /></Protected>} />
      <Route path="/personas" element={<Protected roles={['admin', 'user']}><People /></Protected>} />
      <Route path="/escuela" element={<Protected roles={['admin', 'teacher']}><EscuelaOverview /></Protected>} />
      <Route path="/escuela/alumnos" element={<Protected roles={['admin']}><EscuelaStudents /></Protected>} />
      <Route path="/escuela/grupos/:id" element={<Protected roles={['admin', 'teacher']}><Cohort /></Protected>} />
      <Route path="/usuarios" element={<Protected roles={['admin']}><Users /></Protected>} />
      <Route path="/actividad" element={<Protected roles={['admin']}><Activity /></Protected>} />
      <Route path="/registrar" element={<Protected roles={['teacher', 'leader']}><RegisterPerson /></Protected>} />
      <Route path="/reuniones" element={<Protected roles={['admin', 'leader']}><Reuniones /></Protected>} />
      <Route path="/reuniones/:id" element={<Protected roles={['admin', 'leader']}><Reunion /></Protected>} />
      <Route path="/cuenta" element={<Protected><Account /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
