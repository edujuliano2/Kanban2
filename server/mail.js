const { buildCalendarInvite, memberEmails } = require('./calendar-invite');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractEmail(value) {
  const match = String(value || '').match(/<([^>]+)>/);
  return (match ? match[1] : value || '').trim();
}

function formatEventDate(key) {
  if (!key) return '';
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatEventTime(card) {
  if (!card.start_time) return 'Dia todo';
  return card.end_time ? `${card.start_time} às ${card.end_time}` : card.start_time;
}

function getMailConfig() {
  const from = process.env.MAIL_FROM || 'Agenda da Família <agenda@familia.local>';
  const organizerEmail =
    process.env.MAIL_FROM_EMAIL || extractEmail(from) || 'agenda@familia.local';
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');

  const smtp = process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure:
          process.env.SMTP_SECURE === '1' ||
          String(process.env.SMTP_SECURE).toLowerCase() === 'true',
        auth:
          process.env.SMTP_USER || process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
              }
            : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      }
    : null;

  return {
    from,
    organizerEmail,
    appUrl,
    smtp,
    resendApiKey: process.env.RESEND_API_KEY || '',
    replyTo: process.env.MAIL_REPLY_TO || ''
  };
}

function isMailConfigured() {
  const config = getMailConfig();
  return Boolean(config.smtp || config.resendApiKey);
}

function buildMessage({ card, recipients, method, config }) {
  const action = String(method).toUpperCase();
  const cancelled = action === 'CANCEL';
  const subject = `${cancelled ? 'Cancelado' : 'Convite'}: ${card.title}`;
  const dateText = formatEventDate(card.event_date);
  const timeText = formatEventTime(card);
  const participants = recipients.map((member) => member.name).join(', ');
  const link = config.appUrl && card.board_id ? `${config.appUrl}/board/card/${card.id}` : '';

  const text = [
    'Olá!',
    '',
    cancelled
      ? `O compromisso "${card.title}" foi cancelado.`
      : `Você foi convidado(a) para "${card.title}".`,
    '',
    `Data: ${dateText}`,
    `Horário: ${timeText}`,
    card.location ? `Local: ${card.location}` : '',
    participants ? `Participantes: ${participants}` : '',
    card.description ? `Detalhes: ${card.description}` : '',
    link ? `Abrir na agenda: ${link}` : '',
    '',
    cancelled
      ? 'O cancelamento está anexado para atualizar sua agenda de e-mail.'
      : 'O convite está anexado. Ao aceitar, ele será incluído na sua agenda de e-mail.'
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#182741">
      <h2 style="margin:0 0 8px">${cancelled ? 'Compromisso cancelado' : 'Convite de agenda'}</h2>
      <h3 style="margin:0 0 16px;color:#3b6cf6">${escapeHtml(card.title)}</h3>
      <p><strong>Data:</strong> ${escapeHtml(dateText)}</p>
      <p><strong>Horário:</strong> ${escapeHtml(timeText)}</p>
      ${card.location ? `<p><strong>Local:</strong> ${escapeHtml(card.location)}</p>` : ''}
      ${participants ? `<p><strong>Participantes:</strong> ${escapeHtml(participants)}</p>` : ''}
      ${card.description ? `<p><strong>Detalhes:</strong><br>${escapeHtml(card.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${link ? `<p><a href="${escapeHtml(link)}" style="color:#3b6cf6">Abrir na Agenda da Família</a></p>` : ''}
      <p style="color:#6c7a91;font-size:13px">O arquivo <strong>convite.ics</strong> está anexado. Aceite para incluir o compromisso na sua agenda de e-mail.</p>
    </div>
  `;

  return { subject, text, html };
}

async function sendViaSmtp({ config, recipients, ics, message, method }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport(config.smtp);

  try {
    const results = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          await transporter.sendMail({
            from: config.from,
            to: `${recipient.name} <${recipient.email}>`,
            replyTo: config.replyTo || undefined,
            subject: message.subject,
            text: message.text,
            html: message.html,
            icalEvent: {
              method: String(method).toUpperCase(),
              filename: 'convite.ics',
              content: ics
            }
          });
          return { ok: true, recipient };
        } catch (err) {
          return { ok: false, recipient, error: err.message };
        }
      })
    );

    return {
      sent: results.filter((item) => item.ok).map((item) => ({
        name: item.recipient.name,
        email: item.recipient.email
      })),
      errors: results
        .filter((item) => !item.ok)
        .map((item) => ({
          name: item.recipient.name,
          email: item.recipient.email,
          error: item.error
        }))
    };
  } finally {
    transporter.close();
  }
}

async function sendViaResend({ config, recipients, ics, message }) {
  const results = await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: config.from,
            to: [recipient.email],
            reply_to: config.replyTo || undefined,
            subject: message.subject,
            text: message.text,
            html: message.html,
            attachments: [
              {
                filename: 'convite.ics',
                content: Buffer.from(ics, 'utf8').toString('base64'),
                content_type: 'text/calendar; charset=utf-8; method=REQUEST'
              }
            ]
          })
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Resend respondeu ${res.status}`);
        }

        return { ok: true, recipient };
      } catch (err) {
        return { ok: false, recipient, error: err.message };
      }
    })
  );

  return {
    sent: results.filter((item) => item.ok).map((item) => ({
      name: item.recipient.name,
      email: item.recipient.email
    })),
    errors: results
      .filter((item) => !item.ok)
      .map((item) => ({
        name: item.recipient.name,
        email: item.recipient.email,
        error: item.error
      }))
  };
}

async function sendCalendarInvites({ card, members = [], method = 'REQUEST' }) {
  const config = getMailConfig();
  const recipients = memberEmails(members);
  const skipped = members
    .filter((member) => !String(member.email || '').trim())
    .map((member) => ({ name: member.name, reason: 'sem-email' }));

  if (!recipients.length) {
    return {
      configured: isMailConfigured(),
      transport: config.smtp ? 'smtp' : config.resendApiKey ? 'resend' : null,
      sent: [],
      skipped,
      errors: [],
      reason: 'no-recipients'
    };
  }

  if (!card.event_date) {
    return {
      configured: isMailConfigured(),
      transport: config.smtp ? 'smtp' : config.resendApiKey ? 'resend' : null,
      sent: [],
      skipped,
      errors: [],
      reason: 'no-date'
    };
  }

  if (!config.smtp && !config.resendApiKey) {
    console.log(
      `[convite] Serviço de e-mail não configurado. Convite de "${card.title}" para: ${recipients
        .map((member) => member.name)
        .join(', ')}`
    );
    return {
      configured: false,
      transport: null,
      sent: [],
      skipped,
      errors: [],
      reason: 'not-configured'
    };
  }

  const ics = buildCalendarInvite({
    card,
    members: recipients,
    method,
    organizerEmail: config.organizerEmail,
    appUrl: config.appUrl
  });

  const message = buildMessage({ card, recipients, method, config });
  const result = config.smtp
    ? await sendViaSmtp({ config, recipients, ics, message, method })
    : await sendViaResend({ config, recipients, ics, message });

  return {
    configured: true,
    transport: config.smtp ? 'smtp' : 'resend',
    sent: result.sent,
    skipped,
    errors: result.errors,
    reason: null
  };
}

module.exports = {
  sendCalendarInvites,
  isMailConfigured,
  getMailConfig
};
