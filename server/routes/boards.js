const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const boards = db
    .prepare('SELECT * FROM boards WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json(boards);
});

router.get('/:id', (req, res) => {
  const board = db
    .prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (!board) {
    return res.status(404).json({ error: 'Quadro não encontrado' });
  }

  const lists = db
    .prepare('SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC, id ASC')
    .all(board.id);

  const listsWithCards = lists.map((list) => {
    const cards = db
      .prepare('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC')
      .all(list.id);
    return { ...list, cards };
  });

  res.json({ ...board, lists: listsWithCards });
});

router.post('/', (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O nome do quadro é obrigatório' });
  }

  const result = db
    .prepare('INSERT INTO boards (user_id, name, description) VALUES (?, ?, ?)')
    .run(req.user.id, name.trim(), (description || '').trim());

  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(board);
});

router.delete('/:id', (req, res) => {
  const board = db
    .prepare('SELECT id FROM boards WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!board) {
    return res.status(404).json({ error: 'Quadro não encontrado' });
  }

  db.prepare('DELETE FROM boards WHERE id = ?').run(board.id);
  res.json({ ok: true });
});

module.exports = router;
