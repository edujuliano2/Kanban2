import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import MemberStack from '../components/MemberStack';
import { contrastColor, memberColor } from '../colors';
import { CATEGORIES, categoryOf } from '../categories';
import {
  WEEKDAYS,
  formatClock,
  parseDateKey,
  toDateKey,
  todayKey
} from '../dates';

function sortEvents(a, b) {
  const aTime = a.start_time || '';
  const bTime = b.start_time || '';
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return (a.id || 0) - (b.id || 0);
}

function monthLabel(date) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function eventMemberIds(event) {
  if (event.member_ids?.length) return event.member_ids;
  return event.member_id ? [event.member_id] : [];
}

export default function Calendar() {
  const navigate = useNavigate();
  const [monthStart, setMonthStart] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [filterMember, setFilterMember] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const from = toDateKey(monthStart);
  const to = toDateKey(monthEnd);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([api.getAgenda(from, to), api.getMembers()])
      .then(([eventList, memberList]) => {
        if (cancelled) return;
        setEvents(eventList);
        setMembers(memberList);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const filteredEvents = events.filter((event) => {
    if (filterMember !== 'all' && !eventMemberIds(event).includes(Number(filterMember))) {
      return false;
    }
    if (filterCategory !== 'all' && (event.category || 'outro') !== filterCategory) {
      return false;
    }
    return true;
  });

  const days = useMemo(() => {
    const grouped = new Map();
    for (const event of filteredEvents) {
      if (!event.event_date) continue;
      const list = grouped.get(event.event_date) || [];
      list.push(event);
      grouped.set(event.event_date, list);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, list]) => ({
        dateKey,
        date: parseDateKey(dateKey),
        events: [...list].sort(sortEvents)
      }));
  }, [filteredEvents]);

  const isCurrentMonth =
    monthStart.getFullYear() === new Date().getFullYear() &&
    monthStart.getMonth() === new Date().getMonth();

  function shiftMonth(amount) {
    setMonthStart((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
  }

  return (
    <div className="page calendar-page">
      <header className="topbar">
        <div>
          <h1>Calendário da família</h1>
          <p className="muted">
            Todos os eventos do mês, mostrando somente os dias que têm compromissos.
          </p>
        </div>
        <nav className="topbar-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          >
            Ir para hoje
          </button>
        </nav>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="calendar-toolbar">
        <div className="calendar-month-nav">
          <button
            type="button"
            className="btn icon-btn"
            title="Mês anterior"
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </button>
          <div className="calendar-month-label">
            <strong>{monthLabel(monthStart)}</strong>
            <span>
              {filteredEvents.length}{' '}
              {filteredEvents.length === 1 ? 'evento' : 'eventos'} em{' '}
              {days.length} {days.length === 1 ? 'dia' : 'dias'}
            </span>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            title="Próximo mês"
            onClick={() => shiftMonth(1)}
          >
            ›
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              className="btn small"
              onClick={() =>
                setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
              }
            >
              Este mês
            </button>
          )}
        </div>

        <div className="calendar-filters">
          <div className="member-filters" role="group" aria-label="Filtrar por pessoa">
            <button
              type="button"
              className={`filter-chip${filterMember === 'all' ? ' active' : ''}`}
              onClick={() => setFilterMember('all')}
            >
              Todos
            </button>
            {members.map((member) => {
              const active = filterMember === String(member.id);
              const color = memberColor(member.color);
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`filter-chip${active ? ' active' : ''}`}
                  style={
                    active
                      ? { backgroundColor: color, borderColor: color, color: contrastColor(color) }
                      : undefined
                  }
                  onClick={() => setFilterMember(active ? 'all' : String(member.id))}
                >
                  <span className="filter-chip-emoji">{member.emoji || '🙂'}</span>
                  {member.name}
                </button>
              );
            })}
          </div>

          <label className="category-filter">
            <span className="sr-only">Filtrar por categoria</span>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">Todas as categorias</option>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.icon} {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <p className="muted">Carregando calendário...</p>
      ) : days.length === 0 ? (
        <div className="calendar-empty">
          <span className="calendar-empty-icon" aria-hidden="true">🗓️</span>
          <h2>Nenhum evento neste mês</h2>
          <p className="muted">
            Não há compromissos em {monthLabel(monthStart).toLowerCase()} com os filtros atuais.
          </p>
          <div className="row gap calendar-empty-actions">
            {(filterMember !== 'all' || filterCategory !== 'all') && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFilterMember('all');
                  setFilterCategory('all');
                }}
              >
                Limpar filtros
              </button>
            )}
            {!isCurrentMonth && (
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
                }
              >
                Voltar para este mês
              </button>
            )}
            {isCurrentMonth && filterMember === 'all' && filterCategory === 'all' && (
              <button type="button" className="btn primary" onClick={() => navigate('/boards')}>
                Ir para as agendas
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="calendar-days">
          {days.map((day) => {
            const weekday = WEEKDAYS[(day.date.getDay() + 6) % 7];
            const isToday = day.dateKey === todayKey();
            const dayNumber = String(day.date.getDate()).padStart(2, '0');
            const monthShort = day.date
              .toLocaleDateString('pt-BR', { month: 'short' })
              .replace('.', '');

            return (
              <section key={day.dateKey} className={`calendar-day${isToday ? ' is-today' : ''}`}>
                <div className="calendar-day-date">
                  <span className="calendar-day-weekday">{weekday.long}</span>
                  <strong className="calendar-day-number">{dayNumber}</strong>
                  <span className="calendar-day-month">
                    {monthShort}
                    {isToday && <span className="calendar-today-badge">Hoje</span>}
                  </span>
                </div>

                <div className="calendar-events">
                  {day.events.map((event) => {
                    const category = categoryOf(event.category);
                    const eventMembers = eventMemberIds(event)
                      .map((memberId) => memberById.get(memberId))
                      .filter(Boolean);
                    const accent = memberColor(eventMembers[0]?.color);

                    return (
                      <article
                        key={event.id}
                        className={`calendar-event${event.done ? ' done' : ''}`}
                        style={{ borderLeftColor: accent }}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/board/card/${event.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/board/card/${event.id}`);
                        }}
                      >
                        <div className="calendar-event-top">
                          <span className={`calendar-event-time${event.start_time ? '' : ' all-day'}`}>
                            {event.start_time
                              ? `${formatClock(event.start_time)}${
                                  event.end_time ? `–${formatClock(event.end_time)}` : ''
                                }`
                              : 'Dia todo'}
                          </span>
                          <span className="calendar-event-category" title={category.label}>
                            {category.icon} {category.label}
                          </span>
                          <span className="calendar-event-board">{event.board_name}</span>
                        </div>

                        <strong className="calendar-event-title">{event.title}</strong>

                        <div className="calendar-event-meta">
                          {eventMembers.length > 0 ? (
                            <span className="calendar-event-people">
                              <MemberStack members={eventMembers} max={4} />
                              <span>
                                {eventMembers.slice(0, 3).map((member) => member.name).join(', ')}
                                {eventMembers.length > 3 ? ` +${eventMembers.length - 3}` : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="muted small">Sem pessoa definida</span>
                          )}
                          {event.location && (
                            <span className="event-location">📍 {event.location}</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
