import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import MemberPicker from './MemberPicker';
import { CATEGORIES } from '../categories';

function membersForType(type, defaultMemberId, user) {
  if (defaultMemberId) return [Number(defaultMemberId)];
  if (type === 'event' && user?.member_id) return [user.member_id];
  return [];
}

function defaultBoard(boards, defaultBoardId) {
  if (defaultBoardId && boards.some((board) => board.id === defaultBoardId)) {
    return defaultBoardId;
  }

  const lastBoard = Number(localStorage.getItem('agenda_last_board'));
  if (lastBoard && boards.some((board) => board.id === lastBoard)) {
    return lastBoard;
  }

  return boards[0]?.id || '';
}

export default function ActivityModal({
  boards = [],
  members = [],
  initialDate,
  initialType = 'event',
  defaultMemberId = null,
  defaultBoardId = null,
  onClose,
  onCreated
}) {
  const { user } = useAuth();
  const [type, setType] = useState(initialType === 'task' ? 'task' : 'event');
  const [form, setForm] = useState(() => ({
    board_id: defaultBoard(boards, defaultBoardId),
    title: '',
    event_date: initialDate,
    start_time: '',
    end_time: '',
    category: 'outro',
    location: '',
    description: '',
    member_ids: membersForType(initialType, defaultMemberId, user),
    send_invites: initialType !== 'task'
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  function changeType(nextType) {
    setType(nextType);
    setForm((prev) => ({
      ...prev,
      start_time: nextType === 'task' ? '' : prev.start_time,
      end_time: nextType === 'task' ? '' : prev.end_time,
      send_invites: nextType === 'event',
      member_ids: membersForType(nextType, defaultMemberId, user)
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.board_id) {
      setError('Crie uma agenda antes de adicionar atividades.');
      return;
    }
    if (!form.title.trim()) {
      setError('Informe o título da atividade.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const isTask = type === 'task';
      const created = await api.createCard(form.board_id, {
        title: form.title.trim(),
        type,
        event_date: form.event_date || null,
        start_time: isTask ? null : form.start_time || null,
        end_time: isTask ? null : form.end_time || null,
        category: form.category,
        location: form.location,
        description: form.description,
        member_ids: form.member_ids,
        send_invites: !isTask && form.send_invites
      });

      localStorage.setItem('agenda_last_board', String(form.board_id));
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!boards.length) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>Nenhuma agenda criada</h3>
          <p className="muted">
            Crie uma agenda para começar a adicionar eventos e tarefas.
          </p>
          <div className="row gap modal-actions">
            <Link to="/create-board" className="btn primary" onClick={onClose}>
              Criar agenda
            </Link>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal modal-wide activity-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{type === 'task' ? 'Nova tarefa' : 'Novo evento'}</h3>

        <div className="type-toggle" role="group" aria-label="Tipo de card">
          <button
            type="button"
            className={type === 'event' ? 'active' : ''}
            onClick={() => changeType('event')}
          >
            📅 Evento
          </button>
          <button
            type="button"
            className={type === 'task' ? 'active' : ''}
            onClick={() => changeType('task')}
          >
            ✅ Tarefa
          </button>
        </div>

        <p className="type-hint muted small">
          {type === 'task'
            ? 'Tarefa do dia, sem horário. Pode ser direcionada a outra pessoa sem incluir você.'
            : 'Evento com data, horário, participantes e convite de calendário.'}
        </p>

        <label className="field">
          <span>Título</span>
          <input
            autoFocus
            type="text"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder={
              type === 'task'
                ? 'Ex: comprar material escolar, levar uniforme'
                : 'Ex: Reunião na escola, natação, consulta'
            }
            required
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>Agenda</span>
            <select
              value={form.board_id}
              onChange={(e) => setField('board_id', Number(e.target.value))}
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{type === 'task' ? 'Dia da tarefa' : 'Data'}</span>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setField('event_date', e.target.value)}
              required
            />
          </label>

          {type === 'event' && (
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
            <select
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
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
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="Ex: Escola, clínica, casa da vó"
            />
          </label>
        </div>

        <div className="field">
          <span>{type === 'task' ? 'Responsáveis pela tarefa' : 'Quem participa'}</span>
          <MemberPicker members={members} selected={form.member_ids} onToggle={toggleMember} />
          <small className="field-hint">
            {type === 'task'
              ? 'Você pode direcionar a tarefa para outra pessoa sem se incluir.'
              : 'O convite de calendário será enviado para o e-mail cadastrado de cada pessoa.'}
          </small>
        </div>

        {type === 'event' && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={form.send_invites}
              onChange={(e) => setField('send_invites', e.target.checked)}
            />
            <span>Enviar convite para a agenda de e-mail das pessoas</span>
          </label>
        )}

        <label className="field">
          <span>Observações</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Detalhes, o que levar, combinados..."
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row gap modal-actions">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving
              ? 'Salvando...'
              : type === 'task'
                ? 'Criar tarefa'
                : 'Adicionar à agenda'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
