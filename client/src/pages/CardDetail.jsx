import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../api';
import { memberColor } from '../colors';
import { CATEGORIES, categoryOf } from '../categories';
import MemberStack from '../components/MemberStack';
import MemberPicker from '../components/MemberPicker';
import { formatDateLong, formatTimestamp } from '../dates';

function formFromCard(card) {
  return {
    title: card.title || '',
    description: card.description || '',
    type: card.card_type || 'event',
    event_date: card.event_date || '',
    start_time: card.start_time || '',
    end_time: card.end_time || '',
    category: card.category || 'outro',
    location: card.location || '',
    member_ids: card.member_ids?.length
      ? card.member_ids
      : card.member_id
        ? [card.member_id]
        : []
  };
}

function saveMessage(invite) {
  if (!invite) return 'Alterações salvas.';
  if (invite.reason === 'not-configured') {
    return 'Alterações salvas. O envio de e-mail ainda não está configurado.';
  }
  if (invite.reason === 'no-recipients') {
    return 'Alterações salvas. Nenhum participante com e-mail para atualizar o convite.';
  }
  if (invite.reason === 'no-date') {
    return 'Alterações salvas. Defina uma data para atualizar o convite.';
  }

  const parts = ['Alterações salvas.'];
  if (invite.sent?.length) {
    parts.push(`Convite atualizado para ${invite.sent.map((item) => item.name).join(', ')}.`);
  }
  if (invite.errors?.length) {
    parts.push(`Falha ao atualizar para ${invite.errors.map((item) => item.name).join(', ')}.`);
  }
  if (invite.skipped?.length) {
    parts.push(`Sem e-mail: ${invite.skipped.map((item) => item.name).join(', ')}.`);
  }
  return parts.join(' ');
}

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromCalendar = Boolean(location.state?.from?.startsWith('/calendar'));

  const [card, setCard] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [comment, setComment] = useState('');
  const [checkItem, setCheckItem] = useState('');

  async function loadCard() {
    try {
      const data = await api.getCard(id);
      setCard(data);
      setMembers(data.members || (await api.getMembers()));
      setForm(formFromCard(data));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCard();
  }, [id]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleMember(memberId) {
    setForm((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(memberId)
        ? prev.member_ids.filter((value) => value !== memberId)
        : [...prev.member_ids, memberId]
    }));
  }

  async function handleSave(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!form.title.trim()) {
      setError('O título não pode ficar vazio.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const isTask = form.type === 'task';
      const updated = await api.updateCard(id, {
        title: form.title.trim(),
        description: form.description,
        type: form.type,
        event_date: form.event_date || null,
        start_time: isTask ? null : form.start_time || null,
        end_time: isTask ? null : form.end_time || null,
        category: form.category,
        location: form.location,
        member_ids: form.member_ids,
        send_invites: !isTask
      });

      setCard(updated);
      setForm(formFromCard(updated));
      setNotice(isTask ? 'Tarefa salva.' : saveMessage(updated.invite));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTaskDone() {
    setError('');
    try {
      const updated = await api.updateCard(id, { done: !card.done });
      setCard(updated);
      setNotice(updated.done ? 'Tarefa concluída.' : 'Tarefa reaberta.');
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDiscard() {
    setForm(formFromCard(card));
    setError('');
    setNotice('Alterações descartadas.');
  }

  async function handleDelete() {
    if (!window.confirm('Excluir esta atividade da agenda?')) return;

    setDeleting(true);
    const boardId = card.board_id;
    try {
      await api.deleteCard(id);
      navigate(
        fromCalendar ? location.state.from : `/calendar?agenda=${boardId}`
      );
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      setCard(await api.addComment(id, comment));
      setComment('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddCheck(e) {
    e.preventDefault();
    if (!checkItem.trim()) return;
    try {
      setCard(await api.addChecklistItem(id, checkItem));
      setCheckItem('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleCheck(itemId, checked) {
    try {
      setCard(await api.updateChecklistItem(itemId, { checked: !checked }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeCheck(itemId) {
    try {
      setCard(await api.deleteChecklistItem(itemId));
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && (!card || !form)) {
    return <div className="page"><p className="error">{error}</p></div>;
  }
  if (!card || !form) return <div className="page">Carregando...</div>;

  const isTask = form.type === 'task';
  const participantIds = form.member_ids || [];
  const participants = participantIds
    .map((memberId) => members.find((item) => item.id === memberId))
    .filter(Boolean);
  const accent = memberColor(participants[0]?.color);
  const category = categoryOf(form.category);
  const doneCount = card.checklist.filter((item) => item.checked).length;
  const progress = card.checklist.length
    ? Math.round((doneCount / card.checklist.length) * 100)
    : 0;

  return (
    <div className="page">
      <header className="topbar">
        <div className="page-heading">
          <Link
            to={
              fromCalendar
                ? location.state.from
                : card.board_id
                  ? `/calendar?agenda=${card.board_id}`
                  : '/calendar'
            }
            className="back-link"
          >
            ← Voltar para o calendário
          </Link>
          <h1>Detalhes da atividade</h1>
        </div>
        <div className="topbar-actions">
          {isTask && (
            <button type="button" className="btn" onClick={toggleTaskDone}>
              {card.done ? '↩ Reabrir tarefa' : '✓ Concluir tarefa'}
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <div
        className={`event-detail${isTask && card.done ? ' done' : ''}`}
        style={{ borderTopColor: accent }}
      >
        <div className="event-detail-head">
          <MemberStack members={participants} max={4} size="large" />
          <div className="event-detail-title">
            <input
              className="detail-title-input"
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Título do evento ou tarefa"
              aria-label="Título"
            />
            <div className="event-detail-sub">
              <span className={`type-pill ${isTask ? 'task' : 'event'}`}>
                {isTask ? '✅ Tarefa' : '📅 Evento'}
              </span>
              <span>{category.icon} {category.label}</span>
              {form.event_date && <span>📅 {formatDateLong(form.event_date)}</span>}
              {!isTask && form.start_time && (
                <span>
                  🕒 {form.start_time}
                  {form.end_time ? `–${form.end_time}` : ''}
                </span>
              )}
              {isTask && !!card.done && <span className="done-pill">Concluída</span>}
            </div>
          </div>
        </div>

        <form className="detail-form" onSubmit={handleSave}>
          <div className="form-grid detail-grid">
            <label className="field">
              <span>Tipo</span>
              <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
                <option value="event">📅 Evento</option>
                <option value="task">✅ Tarefa</option>
              </select>
            </label>

            <label className="field">
              <span>{isTask ? 'Dia da tarefa' : 'Data'}</span>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setField('event_date', e.target.value)}
              />
            </label>

            {!isTask && (
              <>
                <label className="field">
                  <span>Início</span>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setField('start_time', e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Fim</span>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setField('end_time', e.target.value)}
                  />
                </label>
              </>
            )}

            <label className="field">
              <span>Categoria</span>
              <select value={form.category} onChange={(e) => setField('category', e.target.value)}>
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
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="Ex: Escola, clínica, casa da vó"
              />
            </label>
          </div>

          <div className="field participant-field">
            <span>{isTask ? 'Responsáveis pela tarefa' : 'Quem participa'}</span>
            <MemberPicker members={members} selected={participantIds} onToggle={toggleMember} />
            <small className="field-hint">
              {isTask
                ? 'Você pode direcionar a tarefa para outra pessoa sem se incluir.'
                : 'Ao salvar, os convites de calendário serão atualizados para os participantes com e-mail.'}
            </small>
          </div>

          <label className="field">
            <span>Detalhes</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="O que precisa ser lembrado?"
            />
          </label>

          <div className="row gap detail-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button type="button" className="btn" onClick={handleDiscard} disabled={saving}>
              Descartar alterações
            </button>
          </div>
        </form>

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
