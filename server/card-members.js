const db = require('./db');

function parseMemberIds(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return undefined;

  const ids = [];
  for (const raw of value) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return undefined;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function filterFamilyMemberIds(ids, familyId) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.all(
    `SELECT id FROM members WHERE family_id = ? AND id IN (${placeholders})`,
    [familyId, ...ids]
  );
  const existing = new Set(rows.map((row) => row.id));
  return ids.filter((id) => existing.has(id));
}

async function setCardMembers(cardId, memberIds) {
  await db.run('DELETE FROM card_members WHERE card_id = ?', [cardId]);
  for (const memberId of memberIds) {
    await db.run('INSERT INTO card_members (card_id, member_id) VALUES (?, ?)', [
      cardId,
      memberId
    ]);
  }
  await db.run('UPDATE cards SET member_id = ? WHERE id = ?', [
    memberIds[0] || null,
    cardId
  ]);
}

async function getCardMemberIds(cardId, legacyMemberId = null) {
  const rows = await db.all(
    'SELECT member_id FROM card_members WHERE card_id = ? ORDER BY member_id ASC',
    [cardId]
  );
  if (rows.length) return rows.map((row) => row.member_id);
  return legacyMemberId ? [legacyMemberId] : [];
}

async function attachMemberIds(cards) {
  if (!cards.length) return cards;

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
    const memberIds = ids && ids.length ? ids : card.member_id ? [card.member_id] : [];
    return { ...card, member_ids: memberIds };
  });
}

module.exports = {
  parseMemberIds,
  filterFamilyMemberIds,
  setCardMembers,
  getCardMemberIds,
  attachMemberIds
};
