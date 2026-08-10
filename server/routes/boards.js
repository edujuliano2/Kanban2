const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const boards = await db.all(
    'SELECT * FROM boards WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(boards);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const board = await db.get(
    'SELECT * FROM boards WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!board) {
    return res.status(404).json({ error: 'Quadro não encontrado' });
  }

  const lists = await db.all(
    'SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC, id ASC',
    [board.id]
  );

  const listsWithCards = [];
  for (const list of lists) {
    const cards = await db.all(
      'SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC',
      [list.id]
    );
    listsWithCards.push({ ...list, cards });
  }

  res.json({ ...board, lists: listsWithCards });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O nome do quadro é obrigatório' });
  }

  const result = await db.run(
    'INSERT INTO boards (user_id, name, description) VALUES (?, ?, ?) RETURNING id',
    [req.user.id, name.trim(), (description || '').trim()]
  );

  const board = await db.get(
    'SELECT * FROM boards WHERE id = ?',
    [result.lastInsertRowid]
  );
  res.status(201).json(board);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const board = await db.get(
    'SELECT id FROM boards WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!board) {
    return res.status(404).json({ error: 'Quadro não encontrado' });
  }

  await db.run('DELETE FROM boards WHERE id = ?', [board.id]);
  res.json({ ok: true });
}));

module.exports = router;