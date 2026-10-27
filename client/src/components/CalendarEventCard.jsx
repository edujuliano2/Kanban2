import { categoryOf } from '../categories';
import { memberColor } from '../colors';
import { formatClock } from '../dates';
import MemberStack from './MemberStack';
import TrashIcon from './TrashIcon';

export default function CalendarEventCard({
  event,
  members = [],
  compact = false,
  onOpen,
  onDelete,
  deleting = false
}) {
  const isTask = (event.card_type || 'event') === 'task';
  const isDone = isTask && event.done;
  const category = categoryOf(event.category);
  const accent = memberColor(members[0]?.color);

  if (compact) {
    return (
      <div
        className={`month-event${isTask ? ' task' : ''}${isDone ? ' done' : ''}`}
        style={{ borderLeftColor: accent }}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onOpen();
          }
        }}
        title={`${isTask ? 'Tarefa' : 'Evento'}: ${event.title}`}
      >
        <span className="month-event-time">
          {isTask ? '☑' : event.start_time ? formatClock(event.start_time) : '•'}
        </span>
        {members.length > 1 && (
          <span className="month-event-family" title="Família" aria-label="Família">
            👥
          </span>
        )}
        <span className="month-event-title">{event.title}</span>
        {onDelete && (
          <button
            type="button"
            className="month-event-delete"
            title={deleting ? 'Excluindo...' : 'Excluir atividade'}
            aria-label="Excluir atividade"
            disabled={deleting}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon size={10} />
          </button>
        )}
      </div>
    );
  }

  const names = members
    .slice(0, 2)
    .map((member) => member.name)
    .join(', ');

  return (
    <article
      className={`cal-event${isTask ? ' is-task' : ''}${isDone ? ' done' : ''}`}
      style={{ borderLeftColor: accent }}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
    >
      <div className="cal-event-top">
        <span className={`cal-event-time${isTask ? ' task' : ''}`}>
          {isTask
            ? 'Tarefa'
            : event.start_time
              ? `${formatClock(event.start_time)}${
                  event.end_time ? `–${formatClock(event.end_time)}` : ''
                }`
              : 'Dia todo'}
        </span>
        <span className="cal-event-category" title={category.label}>
          {category.icon}
        </span>
        {event.board_name && <span className="cal-event-board">{event.board_name}</span>}
        {onDelete && (
          <button
            type="button"
            className="cal-event-delete"
            title={deleting ? 'Excluindo...' : 'Excluir atividade'}
            aria-label="Excluir atividade"
            disabled={deleting}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon size={12} />
          </button>
        )}
      </div>

      <strong className="cal-event-title">{event.title}</strong>

      <div className="cal-event-meta">
        {members.length ? (
          <span className="cal-event-members">
            <MemberStack members={members} max={3} />
            <span>
              {names}
              {members.length > 2 ? ` +${members.length - 2}` : ''}
            </span>
          </span>
        ) : (
          <span className="muted small">Sem pessoa definida</span>
        )}
        {event.location && <span className="event-location">📍 {event.location}</span>}
      </div>
    </article>
  );
}
