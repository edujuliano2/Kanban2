import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';

export default function AppNav() {
  const { user } = useAuth();

  return (
    <nav className="app-nav">
      <NavLink to="/boards" className="app-brand">
        <span className="app-brand-icon" aria-hidden="true">📅</span>
        <span>
          <strong>Agenda da Família</strong>
          {user?.family_name && <small>{user.family_name}</small>}
        </span>
      </NavLink>

      <div className="app-nav-links">
        <NavLink to="/boards" className={({ isActive }) => (isActive ? 'active' : '')}>
          Agendas
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => (isActive ? 'active' : '')}>
          Calendário
        </NavLink>
        <NavLink to="/family" className={({ isActive }) => (isActive ? 'active' : '')}>
          Família
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          Ajustes
        </NavLink>
      </div>
    </nav>
  );
}
