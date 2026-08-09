const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function getOwnedBoard(boardId, userId) {
  return db
    .prepare('SELECT id FROM boards WHERE id = ? AND user_id = ?')
    .get(boardId, userId);
}

router.post('/boards/:boardId/lists', (req, res) => {
  const board = getOwnedBoard(req.params.boardId, req.user.id);
  if (!board) {
    return res.status(404).json({ error: 'Quadro não encontrado' });
  }

  const { title } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O nome da lista é obrigatório' });
  }

  const nextPosition = db
    .prepare('SELECT COUNT(*) AS count FROM lists WHERE board_id = ?')
    .get(board.id).count;

  const result = db
    .prepare('INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)')
    .run(board.id, title.trim(), nextPosition);

  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...list, cards: [] });
});

router.delete('/lists/:id', (req, res) => {
  const list = db
    .prepare(
      `SELECT lists.* FROM lists
       JOIN boards ON boards.id = lists.board_id
       WHERE lists.id = ? AND boards.user_id = ?`
    )
    .get(req.params.id, req.user.id);
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  db.prepare('DELETE FROM lists WHERE id = ?').run(list.id);
  res.json({ ok: true });
});

router.post('/lists/:listId/cards', (req, res) => {
  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(req.params.listId);
  if (!list) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  const board = getOwnedBoard(list.board_id, req.user.id);
  if (!board) {
    return res.status(404).json({ error: 'Quadro não encontrado' });
  }

  const { title } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O título do cartão é obrigatório' });
  }

  const nextPosition = db
    .prepare('SELECT COUNT(*) AS count FROM cards WHERE list_id = ?')
    .get(list.id).count;

  const result = db
    .prepare('INSERT INTO cards (list_id, title, position) VALUES (?, ?, ?)')
    .run(list.id, title.trim(), nextPosition);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(card);
});

module.exports = router;
