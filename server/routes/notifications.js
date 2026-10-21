const express = require('express');
const db = require('../db');
const { asyncHandler } = require('../helpers');
const { normalizePhone } = require('../family-helpers');

const router = express.Router();

const TIMEZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

const CATEGORY_LABELS = {
  compromisso: 'Compromisso',
  escola: 'Escola',
  trabalho: 'Trabalho',
  saude: 'Saúde',
  esporte: 'Esporte',
  lazer: 'Lazer',
  casa: 'Casa',
  viagem: 'Viagem',
  outro: 'Outro'
};

function requireNotificationKey(req, res, next) {
  const expected = process.env.NOTIFICATIONS_API_KEY;
  if (!expected) {
    return res.status(503).json({
      error:
        'NOTIFICATIONS_API_KEY não configurada. Defina a variável no servidor para liberar as notificações.'
    });
  }

  const provided =
    req.get('x-api-key') ||
    (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  return next();
}

router.use(requireNotificationKey);

function pad(value) {
  return String(value).padStart(2, '0');
}

function zonedNow() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`
  };
}

function validDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function addDaysKey(key, amount) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

function addMinutesToClock(dateKey, time, minutes) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return {
    date: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
      date.getUTCDate()
    )}`,
    time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  };
}

function weekdayLong(key) {
  const label = dateFromKey(key).toLocaleDateString('pt-BR', {
    weekday: 'long',
    timeZone: 'UTC'
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortDate(key) {
  return dateFromKey(key).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC'
  });
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'família';
}

function phoneOf(member) {
  const phone = normalizePhone(member.phone);
  return phone.length >= 12 && phone.length <= 15 ? phone : '';
}

function notificationFamilyId() {
  const id = Number(process.env.NOTIFICATIONS_FAMILY_ID);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getMembers() {
  const familyId = notificationFamilyId();
  const where = familyId ? 'WHERE family_id = ?' : '';
  return db.all(
    `SELECT id, family_id, name, phone, emoji
     FROM members
     ${where}
     ORDER BY family_id ASC, position ASC, id ASC`,
    familyId ? [familyId] : []
  );
}

async function getCardsInRange(from, to, options = {}) {
  const familyId = notificationFamilyId();
  const params = [from, to];
  let extra = '';

  if (options.eventsOnly) {
    extra += " AND cards.card_type = 'event' AND cards.start_time IS NOT NULL";
  }
  if (familyId) {
    extra += ' AND boards.family_id = ?';
    params.push(familyId);
  }

  const cards = await db.all(
    `SELECT cards.id, cards.title, cards.card_type, cards.event_date,
            cards.start_time, cards.end_time, cards.location, cards.category,
            cards.done, cards.member_id, boards.name AS board_name,
            boards.id AS board_id
     FROM cards
     JOIN lists ON lists.id = cards.list_id
     JOIN boards ON boards.id = lists.board_id
     WHERE cards.event_date >= ? AND cards.event_date <= ?${extra}
     ORDER BY cards.event_date ASC,
       CASE WHEN cards.start_time IS NULL THEN 1 ELSE 0 END,
       cards.start_time ASC,
       cards.id ASC`,
    params
  );

  if (!cards.length) return [];

  const placeholders = cards.map(() => '?').join(',');
  const rows = await db.all(
    `SELECT card_id, member_id FROM card_members
     WHERE card_id IN (${placeholders})
     ORDER BY card_id ASC, member_id ASC`,
    cards.map((card) => card.id)
  );

  const byCard = new Map();
  for (const row of rows) {
    const list = byCard.get(row.card_id) || [];
    list.push(row.member_id);
    byCard.set(row.card_id, list);
  }

  return cards.map((card) => {
    const ids = byCard.get(card.id);
    return {
      ...card,
      member_ids: ids && ids.length ? ids : card.member_id ? [card.member_id] : []
    };
  });
}

function cardLine(card) {
  const done = card.done ? '✅ ' : '';
  const category = CATEGORY_LABELS[card.category] || 'Outro';
  const location = card.location ? ` — ${card.location}` : '';
  const board = card.board_name ? ` _(${card.board_name})_` : '';

  if ((card.card_type || 'event') === 'task') {
    return `${done}• ☑️ ${card.title}${location} · ${category}${board}`;
  }

  const time = card.start_time
    ? `${card.start_time}${card.end_time ? `–${card.end_time}` : ''}`
    : 'Dia todo';
  return `${done}• 🕒 ${time} — ${card.title}${location} · ${category}${board}`;
}

function futureEventsSection(title, events, emptyText) {
  if (!events.length) {
    return `*${title}*\n${emptyText}`;
  }

  const grouped = new Map();
  for (const card of events) {
    const list = grouped.get(card.event_date) || [];
    list.push(card);
    grouped.set(card.event_date, list);
  }

  const lines = [`*${title}*`];
  for (const [dateKey, list] of [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    lines.push(`*${weekdayLong(dateKey)}, ${shortDate(dateKey)}*`);
    lines.push(list.map(cardLine).join('\n'));
  }
  return lines.join('\n');
}

function buildDailyMessage({
  member,
  todayCards,
  next7Events,
  other22Events,
  today,
  next7From,
  next7To,
  otherFrom,
  otherTo
}) {
  const greeting = `🌞 *Bom dia, ${firstName(member.name)}!*`;

  if (!todayCards.length && !next7Events.length && !other22Events.length) {
    return `${greeting}\n\n🌿 Você não tem eventos nem tarefas para hoje e nenhum evento nos próximos 30 dias.`;
  }

  const sections = [greeting];

  if (todayCards.length) {
    const events = todayCards.filter((card) => (card.card_type || 'event') === 'event');
    const tasks = todayCards.filter((card) => (card.card_type || 'event') === 'task');
    const todayLines = [`*Hoje — ${weekdayLong(today)}, ${shortDate(today)}*`];

    if (events.length) {
      todayLines.push(`*📅 Eventos de hoje*\n${events.map(cardLine).join('\n')}`);
    }
    if (tasks.length) {
      todayLines.push(`*✅ Tarefas de hoje*\n${tasks.map(cardLine).join('\n')}`);
    }

    sections.push(todayLines.join('\n'));
  } else {
    sections.push(
      `*Hoje — ${weekdayLong(today)}, ${shortDate(today)}*\n🌿 Nada para hoje.`
    );
  }

  sections.push(
    futureEventsSection(
      `📆 Próximos 7 dias (${shortDate(next7From)} a ${shortDate(next7To)})`,
      next7Events,
      'Nenhum evento nos próximos 7 dias.'
    )
  );

  sections.push(
    futureEventsSection(
      `🗓️ Outros 22 dias (${shortDate(otherFrom)} a ${shortDate(otherTo)})`,
      other22Events,
      'Nenhum evento nos próximos 22 dias.'
    )
  );

  sections.push('_Agenda da Família_');
  return sections.join('\n\n');
}

function buildReminderMessage(member, card, participantNames) {
  const location = card.location ? `\n📍 ${card.location}` : '';
  const people = participantNames.length
    ? `\n👥 ${participantNames.join(', ')}`
    : '';

  return [
    `⏰ *Lembrete para ${firstName(member.name)}*`,
    `Daqui a 1 hora começa *${card.title}* às ${card.start_time}.`,
    `📅 ${weekdayLong(card.event_date)}, ${shortDate(card.event_date)}${location}${people}`,
    `_${card.board_name || 'Agenda da Família'}_`
  ].join('\n');
}

router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const showAll = req.query.all === '1';
    const configuredFamilyId = notificationFamilyId();
    const familyFilter = showAll ? null : configuredFamilyId;
    const families = await db.all(
      `SELECT families.id, families.name,
              COUNT(members.id) AS members,
              SUM(CASE WHEN members.phone IS NOT NULL AND members.phone <> '' THEN 1 ELSE 0 END) AS with_phone,
              SUM(CASE WHEN members.phone IS NOT NULL AND LENGTH(members.phone) BETWEEN 12 AND 15 THEN 1 ELSE 0 END) AS valid_phone
       FROM families
       LEFT JOIN members ON members.family_id = families.id
       ${familyFilter ? 'WHERE families.id = ?' : ''}
       GROUP BY families.id, families.name
       ORDER BY families.id ASC`,
      familyFilter ? [familyFilter] : []
    );

    res.json({
      configured_family_id: configuredFamilyId,
      diagnostic_all: showAll,
      timezone: TIMEZONE,
      matched_families: families.length,
      families: families.map((family) => ({
        id: family.id,
        name: family.name,
        members: Number(family.members) || 0,
        with_phone: Number(family.with_phone) || 0,
        valid_phone: Number(family.valid_phone) || 0
      }))
    });
  })
);

router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const now = zonedNow();
    const today = validDateKey(req.query.date) ? req.query.date : now.date;
    const next7From = addDaysKey(today, 1);
    const next7To = addDaysKey(today, 7);
    const otherFrom = addDaysKey(today, 8);
    const horizonEnd = addDaysKey(today, 29);

    const [members, cards] = await Promise.all([
      getMembers(),
      getCardsInRange(today, horizonEnd)
    ]);

    const byMember = new Map();
    for (const card of cards) {
      for (const memberId of card.member_ids) {
        const list = byMember.get(memberId) || [];
        list.push(card);
        byMember.set(memberId, list);
      }
    }

    const messages = members
      .map((member) => ({ member, phone: phoneOf(member) }))
      .filter((item) => item.phone)
      .map(({ member, phone }) => {
        const memberCards = byMember.get(member.id) || [];
        const todayCards = memberCards.filter((card) => card.event_date === today);
        const futureEvents = memberCards.filter(
          (card) =>
            (card.card_type || 'event') === 'event' && card.event_date > today
        );
        const next7Events = futureEvents.filter(
          (card) => card.event_date >= next7From && card.event_date <= next7To
        );
        const other22Events = futureEvents.filter(
          (card) => card.event_date >= otherFrom && card.event_date <= horizonEnd
        );

        return {
          member_id: member.id,
          name: member.name,
          phone,
          date: today,
          next7: { from: next7From, to: next7To },
          other22: { from: otherFrom, to: horizonEnd },
          message: buildDailyMessage({
            member,
            todayCards,
            next7Events,
            other22Events,
            today,
            next7From,
            next7To,
            otherFrom,
            otherTo: horizonEnd
          })
        };
      });

    res.json({
      mode: 'daily',
      date: today,
      horizon: { from: today, to: horizonEnd },
      next7: { from: next7From, to: next7To },
      other22: { from: otherFrom, to: horizonEnd },
      timezone: TIMEZONE,
      generated_at: new Date().toISOString(),
      count: messages.length,
      messages
    });
  })
);

router.get(
  '/reminders',
  asyncHandler(async (req, res) => {
    const now = zonedNow();
    const windowStart = addMinutesToClock(now.date, now.time, 55);
    const windowEnd = addMinutesToClock(now.date, now.time, 65);
    const startKey = `${windowStart.date}T${windowStart.time}`;
    const endKey = `${windowEnd.date}T${windowEnd.time}`;

    const [members, events] = await Promise.all([
      getMembers(),
      getCardsInRange(windowStart.date, windowEnd.date, { eventsOnly: true })
    ]);

    const memberById = new Map(members.map((member) => [member.id, member]));
    const messages = [];

    for (const card of events) {
      const eventKey = `${card.event_date}T${card.start_time}`;
      if (eventKey < startKey || eventKey > endKey) continue;

      const participantNames = card.member_ids
        .map((memberId) => memberById.get(memberId))
        .filter(Boolean)
        .map((member) => member.name);

      for (const memberId of card.member_ids) {
        const member = memberById.get(memberId);
        const phone = member ? phoneOf(member) : '';
        if (!member || !phone) continue;

        messages.push({
          member_id: member.id,
          name: member.name,
          phone,
          card_id: card.id,
          card_type: card.card_type,
          event_date: card.event_date,
          start_time: card.start_time,
          start_at: startKey,
          message: buildReminderMessage(member, card, participantNames)
        });
      }
    }

    res.json({
      mode: 'reminders',
      window: {
        from: startKey,
        to: endKey,
        local_now: `${now.date}T${now.time}`
      },
      timezone: TIMEZONE,
      generated_at: new Date().toISOString(),
      count: messages.length,
      messages
    });
  })
);

module.exports = router;
