const { buildCalendarInvite } = require('../server/calendar-invite');

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  OK  ${message}`);
}

const members = [
  { name: 'Eduardo', email: 'eduardo@exemplo.com' },
  { name: 'Ana; Maria', email: 'ana@exemplo.com' },
  { name: 'Sem e-mail', email: '' }
];

const timed = buildCalendarInvite({
  card: {
    id: 42,
    title: 'Consulta em família, com todos',
    event_date: '2026-10-19',
    start_time: '09:00',
    end_time: '10:30',
    location: 'Clínica; Centro',
    category: 'saude',
    description: 'Levar documentos.\nChegar 10 minutos antes.'
  },
  members,
  method: 'REQUEST',
  organizerEmail: 'agenda@exemplo.com',
  appUrl: 'https://agenda.exemplo.com'
});

assert(timed.startsWith('BEGIN:VCALENDAR\r\n'), 'ICS começa com VCALENDAR e CRLF');
assert(timed.includes('METHOD:REQUEST\r\n'), 'método REQUEST');
assert(timed.includes('UID:card-42@agenda-familia.local\r\n'), 'UID estável por evento');
assert(timed.includes('DTSTART:20261019T120000Z\r\n'), 'horário inicial convertido para UTC');
assert(timed.includes('DTEND:20261019T133000Z\r\n'), 'horário final convertido para UTC');
assert(timed.includes('SUMMARY:Consulta em família\\, com todos'), 'vírgula escapada no título');
assert(timed.includes('LOCATION:Clínica\\; Centro'), 'ponto e vírgula escapado no local');
assert(timed.includes('ATTENDEE;CN=Eduardo'), 'primeiro participante');
assert(timed.includes('ATTENDEE;CN=Ana\\; Maria'), 'segundo participante');
assert(!timed.includes('Sem e-mail'), 'participante sem e-mail é ignorado');
assert(timed.endsWith('END:VCALENDAR\r\n'), 'ICS termina com VCALENDAR');

const allDay = buildCalendarInvite({
  card: {
    id: 43,
    title: 'Feriado',
    event_date: '2026-10-20',
    start_time: null,
    end_time: null,
    location: '',
    category: 'outro',
    description: ''
  },
  members: [members[0]],
  method: 'REQUEST'
});

assert(allDay.includes('DTSTART;VALUE=DATE:20261020\r\n'), 'evento de dia inteiro');
assert(allDay.includes('DTEND;VALUE=DATE:20261021\r\n'), 'fim do dia inteiro é o dia seguinte');

const cancelled = buildCalendarInvite({
  card: {
    id: 42,
    title: 'Consulta em família',
    event_date: '2026-10-19',
    start_time: '09:00',
    end_time: '10:30',
    location: 'Clínica',
    category: 'saude',
    description: ''
  },
  members: [members[0]],
  method: 'CANCEL'
});

assert(cancelled.includes('METHOD:CANCEL\r\n'), 'método CANCEL');
assert(cancelled.includes('STATUS:CANCELLED\r\n'), 'status cancelado');

const noEnd = buildCalendarInvite({
  card: {
    id: 44,
    title: 'Sem horário final',
    event_date: '2026-10-21',
    start_time: '09:00',
    end_time: null,
    location: '',
    category: 'outro',
    description: ''
  },
  members: [members[0]]
});

assert(noEnd.includes('DTEND:20261021T130000Z\r\n'), 'sem fim, assume uma hora de duração');

const overnight = buildCalendarInvite({
  card: {
    id: 45,
    title: 'Viagem',
    event_date: '2026-10-21',
    start_time: '23:00',
    end_time: '01:00',
    location: '',
    category: 'viagem',
    description: ''
  },
  members: [members[0]]
});

assert(overnight.includes('DTEND:20261022T040000Z\r\n'), 'evento que atravessa a meia-noite');

const newYorkSummer = buildCalendarInvite({
  card: {
    id: 46,
    title: 'Reunião em Nova York',
    event_date: '2026-07-01',
    start_time: '09:00',
    end_time: '10:00',
    location: '',
    category: 'trabalho',
    description: ''
  },
  members: [members[0]],
  timeZone: 'America/New_York'
});

assert(
  newYorkSummer.includes('DTSTART:20260701T130000Z\r\n'),
  'converte horário de verão de outro fuso para UTC'
);

console.log('\nGeração de convites de calendário validada.');
