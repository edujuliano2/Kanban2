import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { memberColor } from '../colors';
import { CATEGORIES, categoryOf } from '../categories';
import MemberStack from '../components/MemberStack';
import MemberPicker from '../components/MemberPicker';
import { inviteMessage } from '../invites';
import { formatDateTime, toLocalInput, isOverdue } from '../datetime';
import { formatDateLong, formatTimestamp } from '../dates';

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [card, setCard] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingInvites, setSendingInvites] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');

  const [desc, setDesc] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [location, setLocation] = useState('');

  const [comment, setComment] = useState('');
  const [checkItem, setCheckItem] = useState('');
  const [remindInput, setRemindInput] = useState('');
  const [savingRemind, setSavingRemind] = useState(false);

  async function loadCard() {
    try {
      const [data, memberList] = await Promise.all([api.getCard(id), api.getMembers()]);
      setCard(data);
      setMembers(memberList);
      setTitle(data.title);
      setDesc(data.description || '');
      setLocation(data.location || '');
      setRemindInput(toLocalInput(data.remind_at));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCard();
  }, [id]);

  async function patch(payload) {
    setCard((prev) => ({ ...prev, ...payload }));
    try {
      const updated = await api.updateCard(id, payload);
      setCard(updated);
      setTitle(updated.title);
      setDesc(updated.description || '');
      setLocation(updated.location || '');
      if (updated.invite) setNotice(inviteMessage(updated.invite));
    } catch (err) {
      setError(err.message);
      loadCard();
    }
  }

  function saveTitle() {
    if (title.trim() && title.trim() !== card.title) {
      patch({ title: title.trim() });
    } else {
      setTitle(card.title);
    }
    setEditingTitle(false);
  }

  function saveDesc() {
    patch({ description: desc });
    setEditingDesc(false);
  }

  function saveLocation() {
    if (location !== (card.location || '')) {
      patch({ location });
    }
  }

  async function saveReminder() {
    if (!remindInput) return clearReminder();

    setSavingRemind(true);
    setError('');
    try {
      const updated = await api.updateCard(id, {
        remind_at: new Date(remindInput).toISOString()
      });
      setCard(updated);
      setRemindInput(toLocalInput(updated.remind_at));
      setNotice('Lembrete salvo.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRemind(false);
    }
  }

  async function clearReminder() {
    setSavingRemind(true);
    setError('');
    try {
      const updated = await api.updateCard(id, { remind_at: null });
      setCard(updated);
      setRemindInput('');
      setNotice('Lembrete removido.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRemind(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Excluir esta atividade da agenda?')) return;
    const boardId = card.board_id;
    try {
      await api.deleteCard(id);
      navigate(`/board/${boardId}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setCard(await api.addComment(id, comment));
    setComment('');
  }

  function toggleMember(memberId) {
    const current = card.member_ids?.length
      ? card.member_ids
      : card.member_id
        ? [card.member_id]
        : [];
    const next = current.includes(memberId)
      ? current.filter((idValue) => idValue !== memberId)
      : [...current, memberId];
    patch({ member_ids: next });
  }

  async function resendInvites() {
    setSendingInvites(true);
    setError('');
    setNotice('');
    try {
      const updated = await api.updateCard(id, { send_invites: true });
      setCard(updated);
      const message =
        updated.invite?.reason === 'no-recipients'
          ? 'Nenhum participante com e-mail cadastrado para receber o convite.'
          : inviteMessage(updated.invite);
      setNotice(message || 'Convites processados.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingInvites(false);
    }
  }

  async function handleAddCheck(e) {
    e.preventDefault();
    if (!checkItem.trim()) return;
    setCard(await api.addChecklistItem(id, checkItem));
    setCheckItem('');
  }

  async function toggleCheck(itemId, checked) {
    setCard(await api.updateChecklistItem(itemId, { checked: !checked }));
  }

  async function removeCheck(itemId) {
    setCard(await api.deleteChecklistItem(itemId));
  }

  if (error && !card) return <div className="page"><p className="error">{error}</p></div>;
  if (!card) return <div className="page">Carregando...</div>;

  const participantIds = card.member_ids?.length
    ? card.member_ids
    : card.member_id
      ? [card.member_id]
      : [];
  const participants = participantIds
    .map((memberId) => members.find((item) => item.id === memberId))
    .filter(Boolean);
  const accent = memberColor(participants[0]?.color);
  const category = categoryOf(card.category);
  const doneCount = card.checklist.filter((item) => item.checked).length;
  const progress = card.checklist.length
    ? Math.round((doneCount / card.checklist.length) * 100)
    : 0;

  return (
    <div className="page">
      <header className="topbar">
        <div className="page-heading">
          <Link to={`/board/${card.board_id}`} className="back-link">
            ← {card.board_name || 'Voltar para a agenda'}
          </Link>
          <h1>Detalhes da atividade</h1>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`btn${card.done ? '' : ' primary'}`}
            onClick={() => patch({ done: !card.done })}
          >
            {card.done ? '↩ Reabrir' : '✓ Concluir'}
          </button>
          <button type="button" className="btn danger" onClick={handleDelete}>
            Excluir
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <div
        className={`event-detail${card.done ? ' done' : ''}`}
        style={{ borderTopColor: accent }}
      >
        <div className="event-detail-head">
          <MemberStack members={participants} max={4} size="large" />
          <div className="event-detail-title">
            {editingTitle ? (
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTitle();
                }}
              >
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <div className="row gap">
                  <button type="submit" className="btn primary small">Salvar</button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      setTitle(card.title);
                      setEditingTitle(false);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2>{card.title}</h2>
                <div className="event-detail-sub">
                  <span>{category.icon} {category.label}</span>
                  {card.event_date && <span>📅 {formatDateLong(card.event_date)}</span>}
                  {card.start_time && (
                    <span>
                      🕒 {card.start_time}
                      {card.end_time ? `–${card.end_time}` : ''}
                    </span>
                  )}
                  {!!card.done && <span className="done-pill">Concluída</span>}
                </div>
                <button
                  type="button"
                  className="btn text small"
                  onClick={() => setEditingTitle(true)}
                >
                  Editar título
                </button>
              </>
            )}
          </div>
        </div>

        <div className="form-grid detail-grid">
          <label className="field">
            <span>Data</span>
            <input
              type="date"
              value={card.event_date || ''}
              onChange={(e) => patch({ event_date: e.target.value || null })}
            />
          </label>

          <label className="field">
            <span>Início</span>
            <input
              type="time"
              value={card.start_time || ''}
              onChange={(e) => patch({ start_time: e.target.value || null })}
            />
          </label>

          <label className="field">
            <span>Fim</span>
            <input
              type="time"
              value={card.end_time || ''}
              onChange={(e) => patch({ end_time: e.target.value || null })}
            />
          </label>

          <label className="field">
            <span>Categoria</span>
            <select
              value={card.category || 'outro'}
              onChange={(e) => patch({ category: e.target.value })}
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.icon} {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Local</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={saveLocation}
              placeholder="Ex: Escola, clínica, casa da vó"
            />
          </label>
        </div>

        <div className="field participant-field">
          <span>Quem participa</span>
          <MemberPicker
            members={members}
            selected={participantIds}
            onToggle={toggleMember}
          />
          <div className="invite-actions">
            <button
              type="button"
              className="btn small"
              onClick={resendInvites}
              disabled={sendingInvites}
            >
              📨 {sendingInvites ? 'Enviando...' : 'Reenviar convites'}
            </button>
            <span className="muted small">
              Envia o convite de calendário para o e-mail cadastrado de cada participante.
            </span>
          </div>
        </div>

        <section className="section">
          <h3>Detalhes</h3>
          {editingDesc ? (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveDesc();
              }}
            >
              <textarea
                autoFocus
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="O que precisa ser lembrado?"
              />
              <div className="row gap">
                <button type="submit" className="btn primary small">Salvar</button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    setDesc(card.description || '');
                    setEditingDesc(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <p className="prewrap detail-text" onClick={() => setEditingDesc(true)}>
              {card.description || (
                <span className="muted">Sem detalhes. Clique para escrever.</span>
              )}
            </p>
          )}
        </section>

        <section className="section">
          <h3>Lembrete</h3>
          <div className="reminder-form">
            <input
              type="datetime-local"
              value={remindInput}
              onChange={(e) => setRemindInput(e.target.value)}
            />
            <div className="row gap">
              <button
                type="button"
                className="btn primary small"
                disabled={savingRemind || !remindInput}
                onClick={saveReminder}
              >
                Salvar lembrete
              </button>
              {card.remind_at && (
                <button
                  type="button"
                  className="btn small"
                  disabled={savingRemind}
                  onClick={clearReminder}
                >
                  Remover
                </button>
              )}
            </div>
          </div>
          {card.remind_at && (
            <p className={`reminder-status${isOverdue(card.remind_at) ? ' overdue' : ''}`}>
              {isOverdue(card.remind_at) ? 'Vencido' : 'Agendado para'}:{' '}
              {formatDateTime(card.remind_at)}
            </p>
          )}
        </section>

        <section className="section">
          <div className="section-head">
            <h3>O que levar / preparar</h3>
            <span className="muted small">{doneCount}/{card.checklist.length}</span>
          </div>

          {card.checklist.length > 0 && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}

          <form className="inline-form row-gap checklist-form" onSubmit={handleAddCheck}>
            <input
              type="text"
              value={checkItem}
              onChange={(e) => setCheckItem(e.target.value)}
              placeholder="Ex: levar uniforme, documentos, lanche"
            />
            <button type="submit" className="btn primary small">Adicionar</button>
          </form>

          <ul className="checklist">
            {card.checklist.map((item) => (
              <li key={item.id} className={item.checked ? 'checked' : ''}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={!!item.checked}
                    onChange={() => toggleCheck(item.id, item.checked)}
                  />
                  <span>{item.text}</span>
                </label>
                <button className="btn text small" onClick={() => removeCheck(item.id)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h3>Recados da família</h3>
          <form className="inline-form row-gap comment-form" onSubmit={handleComment}>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Deixe um recado sobre esta atividade..."
            />
            <button type="submit" className="btn primary small">Enviar recado</button>
          </form>

          {card.comments.length === 0 ? (
            <p className="muted">Nenhum recado ainda.</p>
          ) : (
            <ul className="comments">
              {card.comments.map((item) => (
                <li key={item.id}>
                  <p className="prewrap">{item.content}</p>
                  <span className="muted small">{formatTimestamp(item.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
