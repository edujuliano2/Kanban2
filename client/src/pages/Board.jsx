import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api';
import { useAuth } from '../auth';
import { contrastColor, memberColor } from '../colors';
import { CATEGORIES, categoryOf } from '../categories';
import MemberStack from '../components/MemberStack';
import MemberPicker from '../components/MemberPicker';
import { inviteMessage } from '../invites';
import {
  WEEKDAYS,
  addDays,
  formatClock,
  formatShortDate,
  formatWeekRange,
  isToday,
  parseDateKey,
  startOfWeek,
  toDateKey,
  todayKey
} from '../dates';

const UNDATED = 'undated';

function sortEvents(a, b) {
  const aTime = a.start_time || '';
  const bTime = b.start_time || '';
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return (a.id || 0) - (b.id || 0);
}

function emptyNewForm(memberIds, dateKey, category = 'outro') {
  return {
    title: '',
    event_date: dateKey || todayKey(),
    start_time: '',
    end_time: '',
    member_ids: memberIds || [],
    category,
    location: '',
    description: '',
    send_invites: true
  };
}

function cardMemberIds(card) {
  if (card.member_ids?.length) return card.member_ids;
  return card.member_id ? [card.member_id] : [];
}

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [board, setBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [filterMember, setFilterMember] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(() =>
    emptyNewForm(user?.member_id ? [user.member_id] : [], todayKey())
  );
  const [creating, setCreating] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [savingBoard, setSavingBoard] = useState(false);

  const [addingTo, setAddingTo] = useState(null);
  const [quickForm, setQuickForm] = useState({ title: '', time: '', member_ids: [] });

  const [moveMenu, setMoveMenu] = useState(null);
  const dragActiveRef = useRef(0);
  const boardBodyRef = useRef(null);

  async function loadBoard() {
    setLoading(true);
    try {
      const [boardData, memberList] = await Promise.all([api.getBoard(id), api.getMembers()]);
      setBoard(boardData);
      setMembers(memberList);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
  }, [id]);

  const memberById = new Map(members.map((member) => [member.id, member]));
  const days = WEEKDAYS.map((weekday, index) => {
    const date = addDays(weekStart, index);
    return { key: toDateKey(date), date, label: weekday.short, long: weekday.long };
  });

  const cards = board?.cards || [];
  const filtered = cards.filter((card) => {
    if (filterMember !== 'all' && !cardMemberIds(card).includes(Number(filterMember))) return false;
    if (filterCategory !== 'all' && (card.category || 'outro') !== filterCategory) return false;
    return true;
  });

  const dayColumns = days.map((day) => ({
    ...day,
    cards: filtered.filter((card) => card.event_date === day.key).sort(sortEvents)
  }));
  const undatedCards = filtered.filter((card) => !card.event_date).sort(sortEvents);
  const weekTotal = dayColumns.reduce((total, column) => total + column.cards.length, 0);
  const otherWeeks = filtered.filter(
    (card) => card.event_date && !days.some((day) => day.key === card.event_date)
  ).length;

  function openNewModal() {
    const weekEnd = addDays(weekStart, 6);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const defaultDate = today >= weekStart && today <= weekEnd ? todayKey() : toDateKey(weekStart);

    setNewForm(
      emptyNewForm(
        filterMember === 'all'
          ? user?.member_id
            ? [user.member_id]
            : []
          : [Number(filterMember)],
        defaultDate,
        filterCategory === 'all' ? 'outro' : filterCategory
      )
    );
    setShowNew(true);
  }

  function openEditModal() {
    setEditForm({ name: board.name, description: board.description || '' });
    setShowEdit(true);
  }

  async function handleEditBoard(e) {
    e.preventDefault();
    if (!editForm.name.trim()) return;

    setSavingBoard(true);
    try {
      const updated = await api.updateBoard(board.id, editForm);
      setBoard((prev) => ({ ...prev, ...updated }));
      setShowEdit(false);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBoard(false);
    }
  }

  function openQuickAdd(dayKey) {
    setQuickForm({
      title: '',
      time: '',
      member_ids:
        filterMember !== 'all'
          ? [Number(filterMember)]
          : user?.member_id
            ? [user.member_id]
            : []
    });
    setAddingTo(dayKey);
  }

  function toggleNewMember(memberId) {
    setNewForm((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(memberId)
        ? prev.member_ids.filter((id) => id !== memberId)
        : [...prev.member_ids, memberId]
    }));
  }

  function toggleQuickMember(memberId) {
    setQuickForm((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(memberId)
        ? prev.member_ids.filter((id) => id !== memberId)
        : [...prev.member_ids, memberId]
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newForm.title.trim()) return;

    setCreating(true);
    try {
      const created = await api.createCard(board.id, {
        ...newForm,
        start_time: newForm.start_time || null,
        end_time: newForm.end_time || null,
        send_invites: Boolean(newForm.send_invites)
      });
      setBoard((prev) => ({ ...prev, cards: [...prev.cards, created] }));
      if (created.event_date) {
        setWeekStart(startOfWeek(parseDateKey(created.event_date) || new Date()));
      }
      setShowNew(false);
      setError('');
      setNotice(inviteMessage(created.invite));
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleQuickAdd(e, dayKey) {
    e.preventDefault();
    if (!quickForm.title.trim()) return;

    try {
      const created = await api.createCard(board.id, {
        title: quickForm.title,
        event_date: dayKey === UNDATED ? null : dayKey,
        start_time: quickForm.time || null,
        member_ids: quickForm.member_ids,
        category: filterCategory === 'all' ? 'outro' : filterCategory,
        send_invites: true
      });
      setBoard((prev) => ({ ...prev, cards: [...prev.cards, created] }));
      setQuickForm({ title: '', time: '', member_ids: quickForm.member_ids });
      setAddingTo(null);
      setError('');
      setNotice(inviteMessage(created.invite));
    } catch (err) {
      setError(err.message);
    }
  }

  function onDragEnd(result) {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const cardId = Number(draggableId);
    const card = cards.find((item) => item.id === cardId);
    if (!card) return;

    const nextDate = destination.droppableId === UNDATED ? null : destination.droppableId;
    if ((card.event_date || null) === nextDate) return;

    setBoard((prev) => ({
      ...prev,
      cards: prev.cards.map((item) =>
        item.id === cardId ? { ...item, event_date: nextDate } : item
      )
    }));

    api.updateCard(cardId, { event_date: nextDate }).catch(() => loadBoard());
  }

  function handleMoveTo(dateKey) {
    if (!moveMenu) return;
    const cardId = moveMenu.card.id;
    setBoard((prev) => ({
      ...prev,
      cards: prev.cards.map((item) =>
        item.id === cardId ? { ...item, event_date: dateKey } : item
      )
    }));
    setMoveMenu(null);
    api.updateCard(cardId, { event_date: dateKey }).catch(() => loadBoard());
  }

  function toggleDone(card, e) {
    e.stopPropagation();
    const done = !card.done;
    setBoard((prev) => ({
      ...prev,
      cards: prev.cards.map((item) => (item.id === card.id ? { ...item, done } : item))
    }));
    api.updateCard(card.id, { done }).catch(() => loadBoard());
  }

  function scrollToUndated() {
    const element = boardBodyRef.current;
    if (!element) return;
    element.scrollTo({ left: element.scrollWidth, behavior: 'smooth' });
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !board) return <div className="page"><p className="error">{error}</p></div>;
  if (!board) return null;

  return (
    <div className="page agenda-page">
      <header className="topbar">
        <div className="page-heading">
          <Link to="/boards" className="back-link">← Agendas</Link>
          <h1>{board.name}</h1>
          {board.description && <p className="muted">{board.description}</p>}
        </div>
        <nav className="topbar-actions">
          <button type="button" className="btn" onClick={openEditModal}>
            Editar agenda
          </button>
          <Link to="/family" className="btn">Família</Link>
          <button type="button" className="btn primary" onClick={openNewModal}>
            + Nova atividade
          </button>
        </nav>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {members.length === 0 && (
        <div className="setup-banner">
          <div>
            <strong>Ainda não há ninguém na família</strong>
            <p className="muted">
              Cadastre as pessoas para marcar cada compromisso com a cor e o emoji certos.
            </p>
          </div>
          <Link to="/family" className="btn primary">Cadastrar família</Link>
        </div>
      )}

      <div className="agenda-toolbar">
        <div className="week-nav">
          <button
            type="button"
            className="btn icon-btn"
            title="Semana anterior"
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
          >
            ‹
          </button>
          <div className="week-label">
            <strong>{formatWeekRange(weekStart)}</strong>
            <span>
              {weekTotal} {weekTotal === 1 ? 'atividade nesta semana' : 'atividades nesta semana'}
              {otherWeeks > 0 ? ` · ${otherWeeks} em outras semanas` : ''}
            </span>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            title="Próxima semana"
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
          >
            ›
          </button>
          <button
            type="button"
            className="btn small today-btn"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Hoje
          </button>
          <button
            type="button"
            className="btn small undated-shortcut"
            onClick={scrollToUndated}
            title="Ir para as atividades sem data"
          >
            📥 Sem data{undatedCards.length ? ` (${undatedCards.length})` : ''}
          </button>
        </div>

        <div className="filter-row">
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

      <p className="drag-hint muted small">
        Arraste as atividades entre os dias para remarcar. A ordem dentro do dia segue o horário.
      </p>

      <DragDropContext
        onDragStart={() => (dragActiveRef.current = Date.now())}
        onDragEnd={onDragEnd}
      >
        <div className="board-body agenda-body" ref={boardBodyRef}>
          {dayColumns.map((column) => (
            <div
              key={column.key}
              className={`list day-column${isToday(column.date) ? ' is-today' : ''}${
                column.date.getDay() === 0 || column.date.getDay() === 6 ? ' is-weekend' : ''
              }`}
            >
              <div className="list-header day-header">
                <div className="day-heading">
                  <span className="day-name">{isToday(column.date) ? 'Hoje' : column.label}</span>
                  <span className="day-date">{formatShortDate(column.date)}</span>
                </div>
                <span className="count-pill">{column.cards.length}</span>
              </div>

              <Droppable droppableId={column.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`list-cards${snapshot.isDraggingOver ? ' dragging-over' : ''}`}
                  >
                    {column.cards.map((card, index) => (
                      <EventMini
                        key={card.id}
                        card={card}
                        index={index}
                        members={cardMemberIds(card)
                          .map((memberId) => memberById.get(memberId))
                          .filter(Boolean)}
                        dragActiveRef={dragActiveRef}
                        onOpen={() => navigate(`/board/card/${card.id}`)}
                        onToggleDone={(e) => toggleDone(card, e)}
                        onMove={() => setMoveMenu({ card })}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {addingTo === column.key ? (
                <form className="quick-add" onSubmit={(e) => handleQuickAdd(e, column.key)}>
                  <input
                    autoFocus
                    type="text"
                    value={quickForm.title}
                    onChange={(e) => setQuickForm({ ...quickForm, title: e.target.value })}
                    placeholder="O que vai acontecer?"
                  />
                  <div className="quick-add-row">
                    <input
                      type="time"
                      value={quickForm.time}
                      onChange={(e) => setQuickForm({ ...quickForm, time: e.target.value })}
                      aria-label="Horário"
                    />
                  </div>
                  <MemberPicker
                    members={members}
                    selected={quickForm.member_ids}
                    onToggle={toggleQuickMember}
                  />
                  <div className="row gap">
                    <button type="submit" className="btn primary small">Salvar</button>
                    <button type="button" className="btn small" onClick={() => setAddingTo(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn text add-card-btn"
                  onClick={() => openQuickAdd(column.key)}
                >
                  + Adicionar
                </button>
              )}
            </div>
          ))}

          <div className="list day-column undated-column">
            <div className="list-header day-header">
              <div className="day-heading">
                <span className="day-name">📥 Sem data</span>
                <span className="day-date">para organizar depois</span>
              </div>
              <span className="count-pill">{undatedCards.length}</span>
            </div>

            <Droppable droppableId={UNDATED}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`list-cards${snapshot.isDraggingOver ? ' dragging-over' : ''}`}
                >
                  {undatedCards.map((card, index) => (
                    <EventMini
                      key={card.id}
                      card={card}
                      index={index}
                      members={cardMemberIds(card)
                        .map((memberId) => memberById.get(memberId))
                        .filter(Boolean)}
                      dragActiveRef={dragActiveRef}
                      onOpen={() => navigate(`/board/card/${card.id}`)}
                      onToggleDone={(e) => toggleDone(card, e)}
                      onMove={() => setMoveMenu({ card })}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {addingTo === UNDATED ? (
              <form className="quick-add" onSubmit={(e) => handleQuickAdd(e, UNDATED)}>
                <input
                  autoFocus
                  type="text"
                  value={quickForm.title}
                  onChange={(e) => setQuickForm({ ...quickForm, title: e.target.value })}
                  placeholder="Ex: comprar material escolar"
                />
                <div className="quick-add-row">
                  <MemberPicker
                    members={members}
                    selected={quickForm.member_ids}
                    onToggle={toggleQuickMember}
                  />
                </div>
                <div className="row gap">
                  <button type="submit" className="btn primary small">Salvar</button>
                  <button type="button" className="btn small" onClick={() => setAddingTo(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="btn text add-card-btn"
                onClick={() => openQuickAdd(UNDATED)}
              >
                + Adicionar
              </button>
            )}
          </div>
        </div>
      </DragDropContext>

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleEditBoard}
          >
            <h3>Editar agenda</h3>

            <label className="field">
              <span>Nome</span>
              <input
                autoFocus
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Descrição</span>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Para que serve esta agenda?"
              />
            </label>

            <div className="row gap modal-actions">
              <button type="submit" className="btn primary" disabled={savingBoard}>
                {savingBoard ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button type="button" className="btn" onClick={() => setShowEdit(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <form
            className="modal modal-wide"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <h3>Nova atividade</h3>

            <label className="field">
              <span>Título</span>
              <input
                autoFocus
                type="text"
                value={newForm.title}
                onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                placeholder="Ex: Reunião na escola, natação, consulta"
                required
              />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Data</span>
                <input
                  type="date"
                  value={newForm.event_date}
                  onChange={(e) => setNewForm({ ...newForm, event_date: e.target.value })}
                />
              </label>

              <label className="field">
                <span>Início</span>
                <input
                  type="time"
                  value={newForm.start_time}
                  onChange={(e) => setNewForm({ ...newForm, start_time: e.target.value })}
                />
              </label>

              <label className="field">
                <span>Fim</span>
                <input
                  type="time"
                  value={newForm.end_time}
                  onChange={(e) => setNewForm({ ...newForm, end_time: e.target.value })}
                />
              </label>

              <label className="field">
                <span>Categoria</span>
                <select
                  value={newForm.category}
                  onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.icon} {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Local</span>
                <input
                  type="text"
                  value={newForm.location}
                  onChange={(e) => setNewForm({ ...newForm, location: e.target.value })}
                  placeholder="Ex: Escola, clínica, casa da vó"
                />
              </label>
            </div>

            <div className="field">
              <span>Quem participa</span>
              <MemberPicker
                members={members}
                selected={newForm.member_ids}
                onToggle={toggleNewMember}
              />
              <small className="field-hint">
                O convite de calendário será enviado para o e-mail cadastrado de cada pessoa.
              </small>
            </div>

            <label className="check-line">
              <input
                type="checkbox"
                checked={newForm.send_invites}
                onChange={(e) => setNewForm({ ...newForm, send_invites: e.target.checked })}
              />
              <span>Enviar convite para a agenda de e-mail das pessoas</span>
            </label>

            <label className="field">
              <span>Observações</span>
              <textarea
                rows={3}
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                placeholder="Detalhes, o que levar, combinados..."
              />
            </label>

            {error && <p className="error">{error}</p>}

            <div className="row gap modal-actions">
              <button type="submit" className="btn primary" disabled={creating}>
                {creating ? 'Salvando...' : 'Adicionar à agenda'}
              </button>
              <button type="button" className="btn" onClick={() => setShowNew(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {moveMenu && (
        <div className="modal-overlay" onClick={() => setMoveMenu(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mover “{moveMenu.card.title}” para...</h3>

            {days.map((day) => (
              <button
                key={day.key}
                type="button"
                className="modal-list"
                disabled={moveMenu.card.event_date === day.key}
                onClick={() => handleMoveTo(day.key)}
              >
                <span className="modal-list-dot" />
                <span>
                  {day.long}, {formatShortDate(day.date)}
                </span>
                {moveMenu.card.event_date === day.key && <small className="muted">atual</small>}
              </button>
            ))}

            <button
              type="button"
              className="modal-list"
              disabled={!moveMenu.card.event_date}
              onClick={() => handleMoveTo(null)}
            >
              <span className="modal-list-dot" />
              <span>Sem data</span>
            </button>

            <button type="button" className="btn" onClick={() => setMoveMenu(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventMini({ card, index, members = [], dragActiveRef, onOpen, onToggleDone, onMove }) {
  const category = categoryOf(card.category);
  const color = memberColor(members[0]?.color);

  return (
    <Draggable draggableId={String(card.id)} index={index}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
          className={`card-mini event-mini${dragSnapshot.isDragging ? ' dragging' : ''}${
            card.done ? ' done' : ''
          }`}
          style={{
            ...dragProvided.draggableProps.style,
            borderLeftColor: color
          }}
          onClick={() => {
            if (Date.now() - dragActiveRef.current < 400) return;
            onOpen();
          }}
        >
          <div className="event-top">
            <button
              type="button"
              className={`done-toggle${card.done ? ' checked' : ''}`}
              title={card.done ? 'Marcar como pendente' : 'Marcar como concluído'}
              aria-label={card.done ? 'Marcar como pendente' : 'Marcar como concluído'}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onToggleDone}
            >
              ✓
            </button>

            <span className={`event-time${card.start_time ? '' : ' all-day'}`}>
              {card.start_time
                ? `${formatClock(card.start_time)}${card.end_time ? `–${formatClock(card.end_time)}` : ''}`
                : card.event_date
                  ? 'Dia todo'
                  : 'Sem data'}
            </span>

            <span className="event-category" title={category.label}>
              {category.icon}
            </span>

            <button
              type="button"
              className="card-mini-move-btn"
              title="Mover para outro dia"
              aria-label="Mover para outro dia"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onMove();
              }}
            >
              ⋯
            </button>
          </div>

          <span className="event-title">{card.title}</span>

          {(members.length > 0 || card.location) && (
            <div className="event-meta">
              {members.length > 0 && (
                <span className="event-members">
                  <MemberStack members={members} max={3} />
                  <span className="event-member-names">
                    {members.slice(0, 2).map((member) => member.name).join(', ')}
                    {members.length > 2 ? ` +${members.length - 2}` : ''}
                  </span>
                </span>
              )}
              {card.location && <span className="event-location">📍 {card.location}</span>}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
