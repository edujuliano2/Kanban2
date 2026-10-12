export function parseDate(value) {
  if (!value) return null;
  const isIso = /^\d{4}-\d{2}-\d{2}T/.test(value);
  const d = new Date(isIso ? value : String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function isOverdue(value) {
  const d = parseDate(value);
  return !!d && d.getTime() < Date.now();
}

export function toLocalInput(value) {
  const d = parseDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
