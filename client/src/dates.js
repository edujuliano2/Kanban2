export const WEEKDAYS = [
  { short: 'Seg', long: 'Segunda' },
  { short: 'Ter', long: 'Terça' },
  { short: 'Qua', long: 'Quarta' },
  { short: 'Qui', long: 'Quinta' },
  { short: 'Sex', long: 'Sexta' },
  { short: 'Sáb', long: 'Sábado' },
  { short: 'Dom', long: 'Domingo' }
];

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key) {
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (start.getDay() + 6) % 7; // segunda = 0
  start.setDate(start.getDate() - weekday);
  return start;
}

export function formatWeekRange(start) {
  const end = addDays(start, 6);
  const startMonth = start.toLocaleDateString('pt-BR', { month: 'long' });
  const endMonth = end.toLocaleDateString('pt-BR', { month: 'long' });
  const year = end.getFullYear();

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} a ${end.getDate()} de ${startMonth} de ${year}`;
  }
  return `${start.getDate()} de ${startMonth} a ${end.getDate()} de ${endMonth} de ${year}`;
}

export function formatLongDate(date = new Date()) {
  const text = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShortDate(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDateLong(key) {
  const date = parseDateKey(key);
  if (!date) return '';
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function isToday(date) {
  return toDateKey(date) === todayKey();
}

export function formatClock(value) {
  if (!value) return '';
  return value.slice(0, 5);
}

export function formatTimestamp(value) {
  if (!value) return '';
  const isIso = /^\d{4}-\d{2}-\d{2}T/.test(value);
  const date = new Date(isIso ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
