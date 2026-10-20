export function inviteMessage(invite) {
  if (!invite) return '';
  if (invite.reason === 'no-recipients') return '';
  if (invite.reason === 'no-date') {
    return 'Atividade salva. Defina uma data para enviar o convite de calendário.';
  }
  if (invite.reason === 'not-configured') {
    return 'Atividade salva. O envio de convites por e-mail ainda não está configurado no servidor.';
  }

  const parts = [];
  if (invite.sent?.length) {
    parts.push(`Convite enviado para ${invite.sent.map((item) => item.name).join(', ')}.`);
  }
  if (invite.errors?.length) {
    parts.push(`Falha ao enviar para ${invite.errors.map((item) => item.name).join(', ')}.`);
  }
  if (invite.skipped?.length) {
    parts.push(`Sem e-mail: ${invite.skipped.map((item) => item.name).join(', ')}.`);
  }
  return parts.join(' ');
}
