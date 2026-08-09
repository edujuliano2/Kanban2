const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function getOwnedCard(cardId, userId) {
  return db
    .prepare(
      `SELECT cards.* FROM cards
       JOIN lists ON lists.id = cards.list_id
       JOIN boards ON boards.id = lists.board_id
       WHERE cards.id = ? AND boards.user_id = ?`
    )
    .get(cardId, userId);
}

function getCardFull(cardId) {
  const card = db
    .prepare(
      `SELECT cards.*, lists.board_id FROM cards
       JOIN lists ON lists.id = cards.list_id
       WHERE cards.id = ?`
    )
    .get(cardId);
  if (!card) return null;

  const checklist = db
    .prepare('SELECT * FROM checklist_items WHERE card_id = ? ORDER BY id ASC')
    .all(cardId);
  const comments = db
    .prepare('SELECT * FROM comments WHERE card_id = ? ORDER BY created_at ASC, id ASC')
    .all(cardId);

  return { ...card, checklist, comments };
}

function renormalize(listId) {
  const cards = db
    .prepare('SELECT id FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC')
    .all(listId);
  cards.forEach((c, i) => {
    db.prepare('UPDATE cards SET position = ? WHERE id = ?').run(i, c.id);
  });
}

router.post('/move', (req, res) => {
  const { cardId, toListId, toIndex } = req.body || {};

  const card = getOwnedCard(cardId, req.user.id);
  if (!card) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const targetList = db
    .prepare(
      `SELECT lists.* FROM lists
       JOIN boards ON boards.id = lists.board_id
       WHERE lists.id = ? AND boards.user_id = ?`
    )
    .get(toListId, req.user.id);
  if (!targetList) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  let index = typeof toIndex === 'number' && toIndex >= 0 ? Math.floor(toIndex) : 0;

  if (card.list_id === targetList.id) {
    const cards = db
      .prepare('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC')
      .all(card.list_id);
    const remaining = cards.filter((c) => c.id !== card.id);
    remaining.splice(Math.min(index, remaining.length), 0, card);
    remaining.forEach((c, i) => {
      db.prepare('UPDATE cards SET position = ? WHERE id = ?').run(i, c.id);
    });
  } else {
    db.prepare('UPDATE cards SET list_id = ?, position = ? WHERE id = ?').run(
      targetList.id,
      index,
      card.id
    );
    renormalize(card.list_id);
    renormalize(targetList.id);
  }

  res.json({ ok: true });
});

router.get('/:id', (req, res) => {
  if (!getOwnedCard(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }
  res.json(getCardFull(req.params.id));
});

router.put('/:id', (req, res) => {
  if (!getOwnedCard(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const { title, description } = req.body || {};
  const updates = {};
  if (typeof title === 'string' && title.trim()) updates.title = title.trim();
  if (typeof description === 'string') updates.description = description;

  if (updates.title) {
    db.prepare('UPDATE cards SET title = ? WHERE id = ?').run(updates.title, req.params.id);
  }
  if (updates.description !== undefined) {
    db.prepare('UPDATE cards SET description = ? WHERE id = ?').run(updates.description, req.params.id);
  }

  res.json(getCardFull(req.params.id));
});

router.delete('/:id', (req, res) => {
  if (!getOwnedCard(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/comments', (req, res) => {
  if (!getOwnedCard(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'O comentário não pode estar vazio' });
  }

  db.prepare('INSERT INTO comments (card_id, content) VALUES (?, ?)').run(
    req.params.id,
    content.trim()
  );

  res.status(201).json(getCardFull(req.params.id));
});

router.post('/:id/checklist', (req, res) => {
  if (!getOwnedCard(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'O item do checklist não pode estar vazio' });
  }

  db.prepare('INSERT INTO checklist_items (card_id, text) VALUES (?, ?)').run(
    req.params.id,
    text.trim()
  );

  res.status(201).json(getCardFull(req.params.id));
});

router.put('/checklist/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.itemId);
  if (!item || !getOwnedCard(item.card_id, req.user.id)) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  const { checked, text } = req.body || {};
  if (typeof checked === 'boolean') {
    db.prepare('UPDATE checklist_items SET checked = ? WHERE id = ?').run(checked ? 1 : 0, item.id);
  }
  if (typeof text === 'string' && text.trim()) {
    db.prepare('UPDATE checklist_items SET text = ? WHERE id = ?').run(text.trim(), item.id);
  }

  res.json(getCardFull(item.card_id));
});

router.delete('/checklist/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.itemId);
  if (!item || !getOwnedCard(item.card_id, req.user.id)) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  db.prepare('DELETE FROM checklist_items WHERE id = ?').run(item.id);
  res.json(getCardFull(item.card_id));
});

module.exports = router;
