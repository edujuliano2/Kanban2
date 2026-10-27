import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

export default function AppNav() {
  const { user } = useAuth();
  const { pathname, state } = useLocation();
  const fromCalendar =
    pathname.startsWith('/board/card/') && state?.from === '/calendar';
  const calendarActive = pathname.startsWith('/calendar') || fromCalendar;
  const agendasActive =
    !fromCalendar &&
    (pathname === '/boards' ||
      pathname === '/create-board' ||
      pathname.startsWith('/board/'));

  return (
    <nav className="app-nav">
      <NavLink to="/calendar" className="app-brand">
        <span className="app-brand-icon" aria-hidden="true">📅</span>
        <span>
          <strong>Agenda da Família</strong>
          {user?.family_name && <small>{user.family_name}</small>}
        </span>
      </NavLink>

      <div className="app-nav-links">
        <NavLink to="/calendar" className={calendarActive ? 'active' : ''}>
          Calendário
        </NavLink>
        <NavLink to="/boards" className={agendasActive ? 'active' : ''}>
          Agendas
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
