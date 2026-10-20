import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import MemberAvatar from '../components/MemberAvatar';
import MemberStack from '../components/MemberStack';
import { categoryOf } from '../categories';
import {
  formatLongDate,
  formatClock,
  todayKey
} from '../dates';

export default function Boards() {
  const [boards, setBoards] = useState([]);
  const [members, setMembers] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const today = todayKey();
    Promise.all([api.getBoards(), api.getMembers(), api.getAgenda(today, today)])
      .then(([boardList, memberList, events]) => {
        setBoards(boardList);
        setMembers(memberList);
        setTodayEvents(events);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e, board) {
    e.stopPropagation();
    if (!window.confirm(`Excluir a agenda "${board.name}"? Todas as atividades dela serão apagadas.`)) {
      return;
    }
    try {
      await api.deleteBoard(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      setError(err.message);
    }
  }

  const memberById = new Map(members.map((member) => [member.id, member]));
  const pendingToday = todayEvents.filter((event) => !event.done);

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Nossa agenda</h1>
          <p className="muted">A rotina de cada um, em um só lugar.</p>
        </div>
        <nav className="topbar-actions">
          <Link to="/calendar" className="btn">Calendário</Link>
          <Link to="/family" className="btn">Família</Link>
          <Link to="/create-board" className="btn primary">+ Nova agenda</Link>
        </nav>
      </header>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          {members.length === 0 && (
            <div className="setup-banner">
              <div>
                <strong>Monte a sua família</strong>
                <p className="muted">
                  Cadastre você, sua esposa e suas filhas para identificar os compromissos de cada um.
                </p>
              </div>
              <Link to="/family" className="btn primary">Cadastrar família</Link>
            </div>
          )}

          <section className="today-panel">
            <div className="today-head">
              <div>
                <span className="eyebrow">Hoje</span>
                <h2>{formatLongDate()}</h2>
              </div>
              <span className="today-count">
                {pendingToday.length === 0
                  ? 'Dia livre'
                  : `${pendingToday.length} ${
                      pendingToday.length === 1 ? 'atividade' : 'atividades'
                    }`}
              </span>
            </div>

            {members.length > 0 && (
              <div className="member-strip">
                {members.map((member) => (
                  <Link to="/family" key={member.id} className="member-chip" title={`Editar ${member.name}`}>
                    <MemberAvatar member={member} size="small" />
                    <span>{member.name}</span>
                    {member.relationship && <small>{member.relationship}</small>}
                  </Link>
                ))}
                <Link to="/family" className="member-chip add">+ pessoa</Link>
              </div>
            )}

            {todayEvents.length === 0 ? (
              <p className="today-empty">Nenhuma atividade hoje. Bom momento para respirar. 🌿</p>
            ) : (
              <ul className="today-list">
                {todayEvents.map((event) => {
                  const isTask = (event.card_type || 'event') === 'task';
                  const eventMemberIds = event.member_ids?.length
                    ? event.member_ids
                    : event.member_id
                      ? [event.member_id]
                      : [];
                  const eventMembers = eventMemberIds
                    .map((memberId) => memberById.get(memberId))
                    .filter(Boolean);
                  const category = categoryOf(event.category);
                  return (
                    <li
                      key={event.id}
                      className={`today-event${event.done ? ' done' : ''}`}
                      onClick={() => navigate(`/board/card/${event.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/board/card/${event.id}`);
                      }}
                    >
                      <span className={`today-time${isTask ? ' task' : ''}`}>
                        {isTask
                          ? 'Tarefa'
                          : event.start_time
                            ? formatClock(event.start_time)
                            : 'Dia todo'}
                      </span>
                      <MemberStack members={eventMembers} max={3} />
                      <span className="today-event-title">
                        <strong>{event.title}</strong>
                        <small>
                          {category.icon} {category.label}
                          {event.location ? ` · ${event.location}` : ''}
                        </small>
                      </span>
                      <span className="today-board">{event.board_name}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="section-head">
              <h2>Agendas</h2>
              {boards.length > 0 && <span className="muted small">{boards.length} no total</span>}
            </div>

            {boards.length === 0 ? (
              <div className="empty">
                <p>Você ainda não tem nenhuma agenda.</p>
                <Link to="/create-board" className="btn primary">Criar minha primeira agenda</Link>
              </div>
            ) : (
              <div className="board-grid">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    className="board-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/board/${board.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/board/${board.id}`);
                    }}
                  >
                    <div className="board-card-top">
                      <span className="board-card-icon" aria-hidden="true">🗓️</span>
                      <button
                        className="board-delete"
                        title="Excluir agenda"
                        onClick={(e) => handleDelete(e, board)}
                      >
                        Excluir
                      </button>
                    </div>
                    <div className="board-card-text">
                      <strong>{board.name}</strong>
                      {board.description && <span>{board.description}</span>}
                    </div>
                    <span className="board-card-link">Abrir agenda →</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
