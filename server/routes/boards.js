const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const {
  hasOwn,
  cleanText,
  optionalDate,
  optionalTime,
  parseCardType
} = require('../event-fields');
const {
  parseMemberIds,
  filterFamilyMemberIds,
  setCardMembers,
  attachMemberIds
} = require('../card-members');
const { sendCalendarInvites } = require('../mail');

const router = express.Router();
router.use(requireAuth);

async function getFamilyBoard(boardId, familyId) {
  return db.get('SELECT * FROM boards WHERE id = ? AND family_id = ?', [boardId, familyId]);
}

async function ensureDefaultList(boardId) {
  const existing = await db.get(
    'SELECT id FROM lists WHERE board_id = ? ORDER BY position ASC, id ASC LIMIT 1',
    [boardId]
  );
  if (existing) return existing.id;

  const result = await db.run(
    'INSERT INTO lists (board_id, title, position) VALUES (?, ?, 0) RETURNING id',
    [boardId, 'Geral']
  );
  return result.lastInsertRowid;
}

async function getMembersByIds(ids, familyId) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db.all(
    `SELECT * FROM members WHERE family_id = ? AND id IN (${placeholders})
     ORDER BY position ASC, id ASC`,
    [familyId, ...ids]
  );
}

router.get('/', asyncHandler(async (req, res) => {
  const boards = await db.all(
    'SELECT * FROM boards WHERE family_id = ? ORDER BY created_at DESC',
    [req.user.family_id]
  );
  res.json(boards);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const board = await getFamilyBoard(req.params.id, req.user.family_id);
  if (!board) {
    return res.status(404).json({ error: 'Agenda não encontrada' });
  }

  const cards = await db.all(
    `SELECT cards.* FROM cards
     JOIN lists ON lists.id = cards.list_id
     WHERE lists.board_id = ?
     ORDER BY cards.event_date ASC, cards.start_time ASC, cards.position ASC, cards.id ASC`,
    [board.id]
  );

  res.json({ ...board, cards: await attachMemberIds(cards) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  const cleanName = cleanText(name, 120);
  if (!cleanName) {
    return res.status(400).json({ error: 'O nome da agenda é obrigatório' });
  }

  const result = await db.run(
    'INSERT INTO boards (user_id, family_id, name, description) VALUES (?, ?, ?, ?) RETURNING id',
    [req.user.id, req.user.family_id, cleanName, cleanText(description, 300) || '']
  );

  const boardId = result.lastInsertRowid;
  await db.run(
    'INSERT INTO lists (board_id, title, position) VALUES (?, ?, 0)',
    [boardId, 'Geral']
  );

  const board = await db.get('SELECT * FROM boards WHERE id = ?', [boardId]);
  res.status(201).json(board);
}));

router.post('/:id/cards', asyncHandler(async (req, res) => {
  const board = await getFamilyBoard(req.params.id, req.user.family_id);
  if (!board) {
    return res.status(404).json({ error: 'Agenda não encontrada' });
  }

  const body = req.body || {};
  const title = cleanText(body.title, 200);
  if (!title) {
    return res.status(400).json({ error: 'O título da atividade é obrigatório' });
  }

  const type = hasOwn(body, 'type') ? parseCardType(body.type) : 'event';
  if (!type) {
    return res.status(400).json({ error: 'Tipo de card inválido' });
  }

  const rawMemberIds = hasOwn(body, 'member_ids')
    ? body.member_ids
    : body.member_id
      ? [body.member_id]
      : [];
  const parsedMemberIds = parseMemberIds(rawMemberIds);
  if (parsedMemberIds === undefined) {
    return res.status(400).json({ error: 'Participantes inválidos' });
  }
  const memberIds = await filterFamilyMemberIds(parsedMemberIds, req.user.family_id);
  if (memberIds.length !== parsedMemberIds.length) {
    return res.status(400).json({ error: 'Uma ou mais pessoas não pertencem à sua família' });
  }

  const listId = await ensureDefaultList(board.id);
  const countRow = await db.get(
    'SELECT COUNT(*) AS count FROM cards WHERE list_id = ?',
    [listId]
  );

  const result = await db.run(
    `INSERT INTO cards
      (list_id, title, description, position, card_type, member_id, event_date, start_time, end_time, location, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      listId,
      title,
      cleanText(body.description) || '',
      Number(countRow.count) || 0,
      type,
      memberIds[0] || null,
      optionalDate(body.event_date) ?? null,
      type === 'event' ? optionalTime(body.start_time) ?? null : null,
      type === 'event' ? optionalTime(body.end_time) ?? null : null,
      cleanText(body.location, 200) || '',
      cleanText(body.category, 40) || 'outro'
    ]
  );

  const cardId = result.lastInsertRowid;
  await setCardMembers(cardId, memberIds);

  let card = await db.get('SELECT * FROM cards WHERE id = ?', [cardId]);
  card = { ...card, board_id: board.id, board_name: board.name };

  if (type === 'event' && body.send_invites !== false) {
    const inviteMembers = await getMembersByIds(memberIds, req.user.family_id);
    card.invite = await sendCalendarInvites({
      card,
      members: inviteMembers,
      method: 'REQUEST'
    });
  }

  res.status(201).json({ ...card, member_ids: memberIds });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const board = await getFamilyBoard(req.params.id, req.user.family_id);
  if (!board) {
    return res.status(404).json({ error: 'Agenda não encontrada' });
  }

  const body = req.body || {};
  const fields = [];
  const params = [];

  if (hasOwn(body, 'name')) {
    const name = cleanText(body.name, 120);
    if (!name) {
      return res.status(400).json({ error: 'O nome da agenda não pode ficar vazio' });
    }
    fields.push('name = ?');
    params.push(name);
  }

  if (hasOwn(body, 'description')) {
    fields.push('description = ?');
    params.push(cleanText(body.description, 300) || '');
  }

  if (fields.length) {
    params.push(board.id);
    await db.run(`UPDATE boards SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  res.json(await db.get('SELECT * FROM boards WHERE id = ?', [board.id]));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const board = await getFamilyBoard(req.params.id, req.user.family_id);
  if (!board) {
    return res.status(404).json({ error: 'Agenda não encontrada' });
  }

  await db.run('DELETE FROM boards WHERE id = ?', [board.id]);
  res.json({ ok: true });
}));

module.exports = router;
