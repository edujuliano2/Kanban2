import { useState, useEffect, useMemo } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { api } from '../api';
import ActivityModal from '../components/ActivityModal';
import CalendarEventCard from '../components/CalendarEventCard';
import { contrastColor, memberColor } from '../colors';
import { CATEGORIES } from '../categories';
import { inviteMessage } from '../invites';
import {
  WEEKDAYS,
  addDays,
  formatClock,
  formatLongDate,
  formatShortDate,
  formatWeekRange,
  parseDateKey,
  startOfWeek,
  toDateKey,
  todayKey
} from '../dates';

const VIEWS = [
  { value: 'month', label: 'Mês' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Dia' }
];

function monthLabel(date) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthGridStart(anchor) {
  return startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
}

function eventMemberIds(event) {
  if (event.member_ids?.length) return event.member_ids;
  return event.member_id ? [event.member_id] : [];
}

export default function Calendar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const agendaParam = searchParams.get('agenda');
  const parsedAgendaId = agendaParam ? Number(agendaParam) : null;
  const selectedBoardId =
    Number.isFinite(parsedAgendaId) && parsedAgendaId > 0 ? parsedAgendaId : null;

  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('agenda_calendar_view');
    return ['month', 'week', 'day'].includes(saved) ? saved : 'month';
  });
  const [anchor, setAnchor] = useState(() => new Date());

  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [showFilters, setShowFilters] = useState(false);
  const [filterMember, setFilterMember] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState(todayKey());
  const [deletingId, setDeletingId] = useState(null);

  const selectedBoard = selectedBoardId
    ? boards.find((board) => board.id === selectedBoardId) || null
    : null;

  const range = useMemo(() => {
    if (view === 'month') {
      const start = monthGridStart(anchor);
      return { from: start, to: addDays(start, 41) };
    }
    if (view === 'week') {
      const start = startOfWeek(anchor);
      return { from: start, to: addDays(start, 6) };
    }
    return { from: anchor, to: anchor };
  }, [view, anchor]);

  const fromKey = toDateKey(range.from);
  const toKey = toDateKey(range.to);

  const monthDays = useMemo(() => {
    if (view !== 'month') return [];
    const start = monthGridStart(anchor);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [view, anchor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor]);

  useEffect(() => {
    let cancelled = false;
    api
      .getBoards()
      .then((data) => {
        if (!cancelled) setBoards(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setBoardsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!boardsLoaded || !selectedBoardId) return;
    if (!boards.some((board) => board.id === selectedBoardId)) {
      setSearchParams({}, { replace: true });
    }
  }, [boardsLoaded, boards, selectedBoardId, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .getAgenda(fromKey, toKey)
      .then((data) => {
        if (cancelled) return;
        setEvents(data.events);
        setMembers(data.members);
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
  }, [fromKey, toKey, refreshKey]);

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (selectedBoardId && Number(event.board_id) !== selectedBoardId) {
          return false;
        }
        if (filterType !== 'all' && (event.card_type || 'event') !== filterType) {
          return false;
        }
        if (
          filterMember !== 'all' &&
          !eventMemberIds(event).includes(Number(filterMember))
        ) {
          return false;
        }
        if (
          filterCategory !== 'all' &&
          (event.category || 'outro') !== filterCategory
        ) {
          return false;
        }
        return true;
      }),
    [events, selectedBoardId, filterMember, filterType, filterCategory]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const event of filteredEvents) {
      if (!event.event_date) continue;
      const list = map.get(event.event_date) || [];
      list.push(event);
      map.set(event.event_date, list);
    }
    return map;
  }, [filteredEvents]);

  function membersForEvent(event) {
    return eventMemberIds(event)
      .map((memberId) => memberById.get(memberId))
      .filter(Boolean);
  }

  const dayKey = toDateKey(anchor);
  const dayEvents = eventsByDate.get(dayKey) || [];
  const dayAllDay = dayEvents.filter(
    (event) => (event.card_type || 'event') === 'task' || !event.start_time
  );
  const dayTimed = dayEvents.filter(
    (event) => (event.card_type || 'event') === 'event' && event.start_time
  );

  const periodLabel = useMemo(() => {
    if (view === 'month') return monthLabel(anchor);
    if (view === 'week') return formatWeekRange(startOfWeek(anchor));
    return formatLongDate(anchor);
  }, [view, anchor]);

  const activeFilterCount =
    (filterMember !== 'all' ? 1 : 0) +
    (filterType !== 'all' ? 1 : 0) +
    (filterCategory !== 'all' ? 1 : 0);

  function shiftPeriod(direction) {
    setAnchor((previous) => {
      if (view === 'month') {
        return new Date(previous.getFullYear(), previous.getMonth() + direction, 1);
      }
      if (view === 'week') return addDays(previous, direction * 7);
      return addDays(previous, direction);
    });
  }

  function changeView(nextView) {
    setView(nextView);
    localStorage.setItem('agenda_calendar_view', nextView);
  }

  function openCreate(date) {
    if (!boardsLoaded || loading) {
      setNotice('Carregando o calendário. Tente novamente em instantes.');
      return;
    }
    setCreateDate(toDateKey(date));
    setNotice('');
    setShowCreate(true);
  }

  function openDay(date) {
    setAnchor(date);
    changeView('day');
  }

  function openEvent(event) {
    navigate(`/board/card/${event.id}`, {
      state: { from: `${location.pathname}${location.search}` }
    });
  }

  function clearAgenda() {
    const next = new URLSearchParams(searchParams);
    next.delete('agenda');
    setSearchParams(next, { replace: true });
  }

  function handleCreated(created) {
    setShowCreate(false);
    if (created.event_date) {
      const createdDate = parseDateKey(created.event_date);
      if (createdDate) setAnchor(createdDate);
    }
    setRefreshKey((value) => value + 1);
    setNotice(inviteMessage(created.invite) || 'Atividade criada.');
  }

  async function handleDelete(event) {
    const isTask = (event.card_type || 'event') === 'task';
    const message = isTask
      ? `Excluir a tarefa “${event.title}”?`
      : `Excluir o evento “${event.title}”? Os participantes com e-mail receberão um cancelamento.`;
    if (!window.confirm(message)) return;

    setDeletingId(event.id);
    setError('');
    try {
      const result = await api.deleteCard(event.id);
      setEvents((previous) => previous.filter((item) => item.id !== event.id));

      const sent = result?.invite?.sent || [];
      if (sent.length) {
        setNotice(
          `Atividade excluída. Cancelamento enviado para ${sent
            .map((item) => item.name)
            .join(', ')}.`
        );
      } else {
        setNotice(isTask ? 'Tarefa excluída.' : 'Evento excluído.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setFilterMember('all');
    setFilterType('all');
    setFilterCategory('all');
  }

  return (
    <div className="page calendar-page">
      <div className={`calendar-toolbar${loading ? ' is-loading' : ''}`}>
        <div className="calendar-toolbar-top">
          <div className="calendar-nav">
            <button
              type="button"
              className="btn icon-btn"
              onClick={() => shiftPeriod(-1)}
              title={view === 'month' ? 'Mês anterior' : view === 'week' ? 'Semana anterior' : 'Dia anterior'}
            >
              ‹
            </button>
            <button type="button" className="btn small" onClick={() => setAnchor(new Date())}>
              Hoje
            </button>
            <button
              type="button"
              className="btn icon-btn"
              onClick={() => shiftPeriod(1)}
              title={view === 'month' ? 'Próximo mês' : view === 'week' ? 'Próxima semana' : 'Próximo dia'}
            >
              ›
            </button>
          </div>

          <div className="calendar-title">
            <span className="eyebrow">Calendário da família</span>
            <h1>{periodLabel}</h1>
          </div>

          <div className="calendar-actions">
            {loading && <span className="calendar-updating">Atualizando...</span>}
            <div className="view-switch" role="group" aria-label="Visualização do calendário">
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={view === item.value ? 'active' : ''}
                  onClick={() => changeView(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`btn small filter-btn${showFilters || activeFilterCount ? ' active' : ''}`}
              onClick={() => setShowFilters((value) => !value)}
            >
              Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
          </div>
        </div>

        {showFilters && (
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
                        ? {
                            backgroundColor: color,
                            borderColor: color,
                            color: contrastColor(color)
                          }
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

            <div className="filter-selects">
              <label className="category-filter">
                <span className="sr-only">Filtrar por tipo</span>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="all">Eventos e tarefas</option>
                  <option value="event">Somente eventos</option>
                  <option value="task">Somente tarefas</option>
                </select>
              </label>
              <label className="category-filter">
                <span className="sr-only">Filtrar por categoria</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">Todas as categorias</option>
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.icon} {category.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeFilterCount > 0 && (
              <button type="button" className="btn text small" onClick={clearFilters}>
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {selectedBoard && (
        <div className="calendar-agenda-banner">
          <span>
            Agenda selecionada: <strong>{selectedBoard.name}</strong>
          </span>
          <button type="button" className="btn text small" onClick={clearAgenda}>
            Ver todas as agendas
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {boardsLoaded && !loading && boards.length === 0 ? (
        <div className="calendar-empty">
          <span className="calendar-empty-icon" aria-hidden="true">🗓️</span>
          <h2>Nenhuma agenda criada</h2>
          <p className="muted">Crie uma agenda para começar a usar o calendário.</p>
          <Link to="/create-board" className="btn primary">
            Criar agenda
          </Link>
        </div>
      ) : view === 'month' ? (
        <>
          <p className="calendar-hint muted small">
            Clique em um dia para abrir a visão do dia. Use o + para criar uma atividade.
          </p>
          <div className="month-view">
            <div className="month-weekdays">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday.short}>{weekday.short}</span>
              ))}
            </div>
            <div className="month-grid">
              {monthDays.map((day) => {
                const key = toDateKey(day);
                const list = eventsByDate.get(key) || [];
                const inMonth = day.getMonth() === anchor.getMonth();
                const isToday = key === todayKey();
                const isSelected = key === dayKey;

                return (
                  <div
                    key={key}
                    className={`month-day${inMonth ? '' : ' outside'}${
                      isToday ? ' today' : ''
                    }${isSelected ? ' selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDay(day)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDay(day);
                      }
                    }}
                    title="Clique para abrir o dia"
                  >
                    <div className="month-day-head">
                      <button
                        type="button"
                        className="month-day-number"
                        title="Abrir visão do dia"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDay(day);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {day.getDate()}
                      </button>
                      <button
                        type="button"
                        className="month-day-add"
                        title="Adicionar atividade"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreate(day);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        +
                      </button>
                    </div>

                    <div className="month-day-events">
                      {list.slice(0, 2).map((event) => (
                        <CalendarEventCard
                          key={event.id}
                          event={event}
                          members={membersForEvent(event)}
                          compact
                          onOpen={() => openEvent(event)}
                          onDelete={() => handleDelete(event)}
                          deleting={deletingId === event.id}
                        />
                      ))}
                      {list.length > 2 && (
                        <button
                          type="button"
                          className="month-more"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDay(day);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          +{list.length - 2} mais
                        </button>
                      )}
                    </div>

                    <div className="month-dots" aria-hidden="true">
                      {list.slice(0, 3).map((event) => {
                        const eventMembers = membersForEvent(event);
                        return (
                          <span
                            key={event.id}
                            className={`month-dot${eventMembers.length > 1 ? ' family' : ''}`}
                            style={{ backgroundColor: memberColor(eventMembers[0]?.color) }}
                          />
                        );
                      })}
                      {list.length > 3 && (
                        <span className="month-dot-more">+{list.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : view === 'week' ? (
        <div className="week-view">
          <div className="week-strip">
            {weekDays.map((day) => {
              const key = toDateKey(day);
              const count = (eventsByDate.get(key) || []).length;
              const selected = key === dayKey;
              const isToday = key === todayKey();
              const weekday = WEEKDAYS[(day.getDay() + 6) % 7];

              return (
                <button
                  key={key}
                  type="button"
                  className={`week-strip-day${selected ? ' selected' : ''}${
                    isToday ? ' today' : ''
                  }`}
                  title="Selecionar dia"
                  onClick={() => setAnchor(day)}
                >
                  <span>{weekday.short}</span>
                  <strong>{day.getDate()}</strong>
                  {count > 0 ? <span className="week-strip-count">{count}</span> : <span />}
                </button>
              );
            })}
          </div>

          <div className="week-grid">
            {weekDays.map((day) => {
              const key = toDateKey(day);
              const list = eventsByDate.get(key) || [];
              const selected = key === dayKey;
              const weekday = WEEKDAYS[(day.getDay() + 6) % 7];

              return (
                <section
                  key={key}
                  className={`week-day${selected ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDay(day)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDay(day);
                    }
                  }}
                  title="Clique para abrir o dia"
                >
                  <header className="week-day-header">
                    <span>{weekday.long}</span>
                    <strong>{formatShortDate(day)}</strong>
                  </header>

                  <div className="week-day-events">
                    {list.length ? (
                      list.map((event) => (
                        <CalendarEventCard
                          key={event.id}
                          event={event}
                          members={membersForEvent(event)}
                          onOpen={() => openEvent(event)}
                          onDelete={() => handleDelete(event)}
                          deleting={deletingId === event.id}
                        />
                      ))
                    ) : (
                      <button
                        type="button"
                        className="week-empty"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreate(day);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        + Adicionar
                      </button>
                    )}
                  </div>

                  {list.length > 0 && (
                    <button
                      type="button"
                      className="week-add"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreate(day);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      + Adicionar
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="day-view">
          <div className="day-view-head">
            <div>
              <span className="eyebrow">Visão do dia</span>
              <h2>{formatLongDate(anchor)}</h2>
              <span className="muted small">{anchor.getFullYear()}</span>
            </div>
            <button type="button" className="btn primary" onClick={() => openCreate(anchor)}>
              + Nova atividade
            </button>
          </div>

          {dayEvents.length === 0 ? (
            <div className="day-empty">
              <span className="day-empty-icon" aria-hidden="true">🗒️</span>
              <h3>Nenhuma atividade neste dia</h3>
              <p className="muted">Use o botão + para adicionar um evento ou tarefa.</p>
            </div>
          ) : (
            <>
              {dayAllDay.length > 0 && (
                <section className="day-section">
                  <h3>Dia todo e tarefas</h3>
                  <div className="day-all-day-list">
                    {dayAllDay.map((event) => (
                      <CalendarEventCard
                        key={event.id}
                        event={event}
                        members={membersForEvent(event)}
                        onOpen={() => openEvent(event)}
                        onDelete={() => handleDelete(event)}
                        deleting={deletingId === event.id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {dayTimed.length > 0 && (
                <section className="day-section">
                  <h3>Agenda</h3>
                  <div className="day-timeline">
                    {dayTimed.map((event) => (
                      <div key={event.id} className="day-timeline-row">
                        <span className="day-timeline-time">
                          {formatClock(event.start_time)}
                        </span>
                        <div className="day-timeline-card">
                          <CalendarEventCard
                            event={event}
                            members={membersForEvent(event)}
                            onOpen={() => openEvent(event)}
                            onDelete={() => handleDelete(event)}
                            deleting={deletingId === event.id}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <button type="button" className="btn day-add-bottom" onClick={() => openCreate(anchor)}>
            + Adicionar atividade
          </button>
        </div>
      )}

      {showCreate && (
        <ActivityModal
          boards={boards}
          members={members}
          initialDate={createDate}
          initialType="event"
          defaultMemberId={filterMember !== 'all' ? Number(filterMember) : null}
          defaultBoardId={selectedBoardId || (boards.length === 1 ? boards[0].id : null)}
          lockBoard={Boolean(selectedBoardId)}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
