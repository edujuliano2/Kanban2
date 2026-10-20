import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { parseDate } from '../datetime';

const NOTIFIED_KEY = 'kanban_notified_reminders';
const POLL_MS = 30000;

function loadNotified() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY)) || {};
  } catch {
    return {};
  }
}

export default function ReminderNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notifiedRef = useRef(loadNotified());

  useEffect(() => {
    if (!user) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    let cancelled = false;

    async function check() {
      try {
        const reminders = await api.getReminders();
        if (cancelled) return;
        const now = Date.now();
        reminders.forEach((r) => {
          const at = parseDate(r.remind_at);
          if (!at || at.getTime() > now) return;
          if (notifiedRef.current[r.id] === r.remind_at) return;
          notifiedRef.current[r.id] = r.remind_at;
          localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedRef.current));
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const label = r.card_type === 'task' ? 'tarefa' : 'evento';
            const n = new Notification(`Lembrete de ${label}: ${r.title}`, {
              body: at.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
              tag: `card-reminder-${r.id}`
            });
            n.onclick = () => {
              window.focus();
              navigate(`/board/card/${r.id}`);
            };
          }
        });
      } catch {
        // silencioso: token ausente/expirado ou rede indisponível
      }
    }

    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, navigate]);

  return null;
}
