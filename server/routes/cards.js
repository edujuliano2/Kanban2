const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const {
  hasOwn,
  cleanText,
  optionalDate,
  optionalTime
} = require('../event-fields');
const {
  parseMemberIds,
  filterFamilyMemberIds,
  setCardMembers,
  getCardMemberIds
} = require('../card-members');
const { sendCalendarInvites } = require('../mail');

const router = express.Router();
router.use(requireAuth);

async function getFamilyCard(cardId, familyId) {
  return db.get(
    `SELECT cards.* FROM cards
     JOIN lists ON lists.id = cards.list_id
     JOIN boards ON boards.id = lists.board_id
     WHERE cards.id = ? AND boards.family_id = ?`,
    [cardId, familyId]
  );
}

async function getCardFull(cardId) {
  const card = await db.get(
    `SELECT cards.*, lists.board_id, boards.name AS board_name, boards.family_id
     FROM cards
     JOIN lists ON lists.id = cards.list_id
     JOIN boards ON boards.id = lists.board_id
     WHERE cards.id = ?`,
    [cardId]
  );
  if (!card) return null;

  const checklist = await db.all(
    'SELECT * FROM checklist_items WHERE card_id = ? ORDER BY id ASC',
    [cardId]
  );
  const comments = await db.all(
    'SELECT * FROM comments WHERE card_id = ? ORDER BY created_at ASC, id ASC',
    [cardId]
  );
  const memberIds = await getCardMemberIds(cardId, card.member_id);

  return { ...card, member_ids: memberIds, checklist, comments };
}

async function getCardMembers(cardId, familyId) {
  return db.all(
    `SELECT members.* FROM members
     JOIN card_members ON card_members.member_id = members.id
     WHERE card_members.card_id = ? AND members.family_id = ?
     ORDER BY members.position ASC, members.id ASC`,
    [cardId, familyId]
  );
}

function renormalize(listId) {
  return db
    .all('SELECT id FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC', [listId])
    .then((cards) => {
      const updates = cards.map((c, i) =>
        db.run('UPDATE cards SET position = ? WHERE id = ?', [i, c.id])
      );
      return Promise.all(updates);
    });
}

router.post('/move', asyncHandler(async (req, res) => {
  const { cardId, toListId, toIndex } = req.body || {};

  const card = await getFamilyCard(cardId, req.user.family_id);
  if (!card) {
    return res.status(404).json({ error: 'Atividade não encontrada' });
  }

  const targetList = await db.get(
    `SELECT lists.* FROM lists
     JOIN boards ON boards.id = lists.board_id
     WHERE lists.id = ? AND boards.family_id = ?`,
    [toListId, req.user.family_id]
  );
  if (!targetList) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  const index = typeof toIndex === 'number' && toIndex >= 0 ? Math.floor(toIndex) : 0;

  if (card.list_id === targetList.id) {
    const cards = await db.all(
      'SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC',
      [card.list_id]
    );
    const remaining = cards.filter((c) => c.id !== card.id);
    remaining.splice(Math.min(index, remaining.length), 0, card);
    await Promise.all(
      remaining.map((c, i) => db.run('UPDATE cards SET position = ? WHERE id = ?', [i, c.id]))
    );
  } else {
    await db.run('UPDATE cards SET list_id = ?, position = ? WHERE id = ?', [
      targetList.id,
      index,
      card.id
    ]);
    await renormalize(card.list_id);
    await renormalize(targetList.id);
  }

  res.json({ ok: true });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!(await getFamilyCard(req.params.id, req.user.family_id))) {
    return res.status(404).json({ error: 'Atividade não encontrada' });
  }
  res.json(await getCardFull(req.params.id));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const card = await getFamilyCard(req.params.id, req.user.family_id);
  if (!card) {
    return res.status(404).json({ error: 'Atividade não encontrada' });
  }

  const body = req.body || {};
  const fields = [];
  const params = [];

  function set(column, value) {
    fields.push(`${column} = ?`);
    params.push(value);
  }

  if (hasOwn(body, 'title')) {
    const value = cleanText(body.title, 200);
    if (!value) {
      return res.status(400).json({ error: 'O título da atividade não pode ficar vazio' });
    }
    set('title', value);
  }

  if (hasOwn(body, 'description')) {
    set('description', cleanText(body.description) || '');
  }

  if (hasOwn(body, 'event_date')) {
    const date = optionalDate(body.event_date);
    if (date === undefined) {
      return res.status(400).json({ error: 'Data inválida' });
    }
    set('event_date', date);
  }

  if (hasOwn(body, 'start_time')) {
    const time = optionalTime(body.start_time);
    if (time === undefined) {
      return res.status(400).json({ error: 'Horário inicial inválido' });
    }
    set('start_time', time);
  }

  if (hasOwn(body, 'end_time')) {
    const time = optionalTime(body.end_time);
    if (time === undefined) {
      return res.status(400).json({ error: 'Horário final inválido' });
    }
    set('end_time', time);
  }

  if (hasOwn(body, 'location')) {
    set('location', cleanText(body.location, 200) || '');
  }

  if (hasOwn(body, 'category')) {
    set('category', cleanText(body.category, 40) || 'outro');
  }

  if (hasOwn(body, 'color')) {
    set('color', cleanText(body.color, 20) || null);
  }

  if (hasOwn(body, 'done')) {
    set('done', body.done ? 1 : 0);
  }

  let memberIds = null;
  if (hasOwn(body, 'member_ids')) {
    const parsed = parseMemberIds(body.member_ids);
    if (parsed === undefined) {
      return res.status(400).json({ error: 'Participantes inválidos' });
    }
    memberIds = await filterFamilyMemberIds(parsed, req.user.family_id);
    if (memberIds.length !== parsed.length) {
      return res.status(400).json({ error: 'Uma ou mais pessoas não pertencem à sua família' });
    }
  }

  if (fields.length) {
    params.push(card.id);
    await db.run(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  if (memberIds) {
    await setCardMembers(card.id, memberIds);
  }

  let fullCard = await getCardFull(card.id);

  if (body.send_invites) {
    const inviteMembers = await getCardMembers(card.id, req.user.family_id);
    fullCard.invite = await sendCalendarInvites({
      card: fullCard,
      members: inviteMembers,
      method: 'REQUEST'
    });
  }

  res.json(fullCard);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const card = await getCardFull(req.params.id);
  if (!card || card.family_id !== req.user.family_id) {
    return res.status(404).json({ error: 'Atividade não encontrada' });
  }

  const inviteMembers = await getCardMembers(card.id, req.user.family_id);
  const invite = await sendCalendarInvites({
    card,
    members: inviteMembers,
    method: 'CANCEL'
  });

  await db.run('DELETE FROM cards WHERE id = ?', [card.id]);
  res.json({ ok: true, invite });
}));

router.post('/:id/comments', asyncHandler(async (req, res) => {
  if (!(await getFamilyCard(req.params.id, req.user.family_id))) {
    return res.status(404).json({ error: 'Atividade não encontrada' });
  }

  const content = cleanText((req.body || {}).content, 2000);
  if (!content) {
    return res.status(400).json({ error: 'O recado não pode estar vazio' });
  }

  await db.run('INSERT INTO comments (card_id, content) VALUES (?, ?)', [
    req.params.id,
    content
  ]);

  res.status(201).json(await getCardFull(req.params.id));
}));

router.post('/:id/checklist', asyncHandler(async (req, res) => {
  if (!(await getFamilyCard(req.params.id, req.user.family_id))) {
    return res.status(404).json({ error: 'Atividade não encontrada' });
  }

  const text = cleanText((req.body || {}).text, 300);
  if (!text) {
    return res.status(400).json({ error: 'O item não pode estar vazio' });
  }

  await db.run('INSERT INTO checklist_items (card_id, text) VALUES (?, ?)', [
    req.params.id,
    text
  ]);

  res.status(201).json(await getCardFull(req.params.id));
}));

router.put('/checklist/:itemId', asyncHandler(async (req, res) => {
  const item = await db.get('SELECT * FROM checklist_items WHERE id = ?', [req.params.itemId]);
  if (!item || !(await getFamilyCard(item.card_id, req.user.family_id))) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  const { checked, text } = req.body || {};
  if (typeof checked === 'boolean') {
    await db.run('UPDATE checklist_items SET checked = ? WHERE id = ?', [
      checked ? 1 : 0,
      item.id
    ]);
  }
  if (typeof text === 'string' && text.trim()) {
    await db.run('UPDATE checklist_items SET text = ? WHERE id = ?', [
      text.trim().slice(0, 300),
      item.id
    ]);
  }

  res.json(await getCardFull(item.card_id));
}));

router.delete('/checklist/:itemId', asyncHandler(async (req, res) => {
  const item = await db.get('SELECT * FROM checklist_items WHERE id = ?', [req.params.itemId]);
  if (!item || !(await getFamilyCard(item.card_id, req.user.family_id))) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  await db.run('DELETE FROM checklist_items WHERE id = ?', [item.id]);
  res.json(await getCardFull(item.card_id));
}));

module.exports = router;
