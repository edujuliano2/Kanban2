function pad(value) {
  return String(value).padStart(2, '0');
}

function escapeText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;

  let result = '';
  let current = '';
  let currentBytes = 0;
  let first = true;

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    const limit = first ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      result += `${current}\r\n`;
      first = false;
      current = ` ${char}`;
      currentBytes = 1 + charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  return result + current;
}

function utcStamp(date = new Date()) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function dateDigits(key) {
  return (key || '').replace(/-/g, '');
}

function addDaysKey(key, amount) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + amount);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addOneHour(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const total = (hours * 60 + minutes + 60) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function memberEmails(members = []) {
  const seen = new Set();
  return members.filter((member) => {
    const email = String(member.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

function buildCalendarInvite({
  card,
  members = [],
  method = 'REQUEST',
  organizerEmail = 'agenda@familia.local',
  organizerName = 'Agenda da Família',
  appUrl = '',
  sequence
}) {
  const action = String(method).toUpperCase();
  const recipients = memberEmails(members);
  const attendeeLines = recipients.map(
    (member) =>
      `ATTENDEE;CN=${escapeText(member.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${member.email.trim()}`
  );

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agenda da Familia//PT-BR',
    'CALSCALE:GREGORIAN',
    `METHOD:${action}`,
    'BEGIN:VEVENT',
    `UID:card-${card.id}@agenda-familia.local`,
    `DTSTAMP:${utcStamp()}`,
    `SEQUENCE:${Number.isFinite(sequence) ? sequence : Math.floor(Date.now() / 1000)}`,
    `STATUS:${action === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    `SUMMARY:${escapeText(card.title)}`,
    `ORGANIZER;CN=${escapeText(organizerName)}:mailto:${organizerEmail}`
  ];

  if (card.event_date) {
    if (card.start_time) {
      const start = card.start_time.slice(0, 5);
      let end = card.end_time ? card.end_time.slice(0, 5) : '';
      let endDate = card.event_date;

      if (!end || end === start) {
        end = addOneHour(start);
        if (end <= start) endDate = addDaysKey(card.event_date, 1);
      } else if (end < start) {
        endDate = addDaysKey(card.event_date, 1);
      }

      lines.push(`DTSTART:${dateDigits(card.event_date)}T${start.replace(':', '')}00`);
      lines.push(`DTEND:${dateDigits(endDate)}T${end.replace(':', '')}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateDigits(card.event_date)}`);
      lines.push(`DTEND;VALUE=DATE:${dateDigits(addDaysKey(card.event_date, 1))}`);
    }
  }

  if (card.location) lines.push(`LOCATION:${escapeText(card.location)}`);

  const descriptionParts = [];
  if (card.description) descriptionParts.push(card.description);
  descriptionParts.push(`Categoria: ${card.category || 'outro'}`);
  if (appUrl) descriptionParts.push(`Agenda online: ${appUrl}`);
  lines.push(`DESCRIPTION:${escapeText(descriptionParts.join('\n\n'))}`);

  lines.push(...attendeeLines);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

module.exports = {
  buildCalendarInvite,
  memberEmails,
  escapeText,
  addOneHour
};
