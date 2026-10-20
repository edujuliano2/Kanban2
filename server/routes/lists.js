const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');

const router = express.Router();
router.use(requireAuth);

async function getFamilyBoard(boardId, familyId) {
  return db.get('SELECT id FROM boards WHERE id = ? AND family_id = ?', [boardId, familyId]);
}

router.post('/boards/:boardId/lists', asyncHandler(async (req, res) => {
  const board = await getFamilyBoard(req.params.boardId, req.user.family_id);
  if (!board) {
    return res.status(404).json({ error: 'Agenda não encontrada' });
  }

  const { title, color } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O nome da lista é obrigatório' });
  }

  const countRow = await db.get(
    'SELECT COUNT(*) AS count FROM lists WHERE board_id = ?',
    [board.id]
  );
  const nextPosition = Number(countRow.count);

  const result = await db.run(
    'INSERT INTO lists (board_id, title, position, color) VALUES (?, ?, ?, ?) RETURNING id',
    [board.id, title.trim(), nextPosition, color || null]
  );

  const list = await db.get('SELECT * FROM lists WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({ ...list, cards: [] });
}));

router.put('/lists/:id', asyncHandler(async (req, res) => {
  const list = await db.get(
    `SELECT lists.* FROM lists
     JOIN boards ON boards.id = lists.board_id
     WHERE lists.id = ? AND boards.family_id = ?`,
    [req.params.id, req.user.family_id]
  );
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  const { title, color } = req.body || {};
  if (typeof title === 'string' && title.trim()) {
    await db.run('UPDATE lists SET title = ? WHERE id = ?', [title.trim(), list.id]);
  }
  if (typeof color === 'string') {
    await db.run('UPDATE lists SET color = ? WHERE id = ?', [color || null, list.id]);
  }

  const updated = await db.get('SELECT * FROM lists WHERE id = ?', [list.id]);
  const cards = await db.all(
    'SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC',
    [list.id]
  );
  res.json({ ...updated, cards });
}));

router.delete('/lists/:id', asyncHandler(async (req, res) => {
  const list = await db.get(
    `SELECT lists.* FROM lists
     JOIN boards ON boards.id = lists.board_id
     WHERE lists.id = ? AND boards.family_id = ?`,
    [req.params.id, req.user.family_id]
  );
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  await db.run('DELETE FROM lists WHERE id = ?', [list.id]);
  res.json({ ok: true });
}));

router.post('/lists/:listId/cards', asyncHandler(async (req, res) => {
  const list = await db.get('SELECT * FROM lists WHERE id = ?', [req.params.listId]);
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  const board = await getFamilyBoard(list.board_id, req.user.family_id);
  if (!board) {
    return res.status(404).json({ error: 'Agenda não encontrada' });
  }

  const { title, color } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O título do cartão é obrigatório' });
  }

  const countRow = await db.get(
    'SELECT COUNT(*) AS count FROM cards WHERE list_id = ?',
    [list.id]
  );
  const nextPosition = Number(countRow.count);

  const result = await db.run(
    'INSERT INTO cards (list_id, title, position, color) VALUES (?, ?, ?, ?) RETURNING id',
    [list.id, title.trim(), nextPosition, color || null]
  );

  const card = await db.get(
    'SELECT * FROM cards WHERE id = ?',
    [result.lastInsertRowid]
  );
  res.status(201).json(card);
}));

module.exports = router;
