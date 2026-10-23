import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Teachers only have one page, so tabs are for admins.
export default function EscuelaTabs() {
  const { user } = useAuth();
  if (user.role !== 'admin') return null;
  return (
    <nav className="tabs" aria-label="Escuela de Vida">
      <NavLink to="/escuela" end>Resumen</NavLink>
      <NavLink to="/escuela/alumnos">Alumnos</NavLink>
    </nav>
  );
}
