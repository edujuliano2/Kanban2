const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');

const router = express.Router();
router.use(requireAuth);

async function getOwnedCard(cardId, userId) {
  return db.get(
    `SELECT cards.* FROM cards
     JOIN lists ON lists.id = cards.list_id
     JOIN boards ON boards.id = lists.board_id
     WHERE cards.id = ? AND boards.user_id = ?`,
    [cardId, userId]
  );
}

async function getCardFull(cardId) {
  const card = await db.get(
    `SELECT cards.*, lists.board_id FROM cards
     JOIN lists ON lists.id = cards.list_id
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

  return { ...card, checklist, comments };
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

  const card = await getOwnedCard(cardId, req.user.id);
  if (!card) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const targetList = await db.get(
    `SELECT lists.* FROM lists
     JOIN boards ON boards.id = lists.board_id
     WHERE lists.id = ? AND boards.user_id = ?`,
    [toListId, req.user.id]
  );
  if (!targetList) {
    return res.status(404).json({ error: 'Lista não encontrada' });
  }

  let index = typeof toIndex === 'number' && toIndex >= 0 ? Math.floor(toIndex) : 0;

  if (card.list_id === targetList.id) {
    const cards = await db.all(
      'SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC',
      [card.list_id]
    );
    const remaining = cards.filter((c) => c.id !== card.id);
    remaining.splice(Math.min(index, remaining.length), 0, card);
    const updates = remaining.map((c, i) =>
      db.run('UPDATE cards SET position = ? WHERE id = ?', [i, c.id])
    );
    await Promise.all(updates);
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
  if (!(await getOwnedCard(req.params.id, req.user.id))) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }
  res.json(await getCardFull(req.params.id));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  if (!(await getOwnedCard(req.params.id, req.user.id))) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const { title, description } = req.body || {};

  if (typeof title === 'string' && title.trim()) {
    await db.run('UPDATE cards SET title = ? WHERE id = ?', [title.trim(), req.params.id]);
  }
  if (typeof description === 'string') {
    await db.run('UPDATE cards SET description = ? WHERE id = ?', [description, req.params.id]);
  }

  res.json(await getCardFull(req.params.id));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!(await getOwnedCard(req.params.id, req.user.id))) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }
  await db.run('DELETE FROM cards WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/:id/comments', asyncHandler(async (req, res) => {
  if (!(await getOwnedCard(req.params.id, req.user.id))) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'O comentário não pode estar vazio' });
  }

  await db.run(
    'INSERT INTO comments (card_id, content) VALUES (?, ?)',
    [req.params.id, content.trim()]
  );

  res.status(201).json(await getCardFull(req.params.id));
}));

router.post('/:id/checklist', asyncHandler(async (req, res) => {
  if (!(await getOwnedCard(req.params.id, req.user.id))) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'O item do checklist não pode estar vazio' });
  }

  await db.run(
    'INSERT INTO checklist_items (card_id, text) VALUES (?, ?)',
    [req.params.id, text.trim()]
  );

  res.status(201).json(await getCardFull(req.params.id));
}));

router.put('/checklist/:itemId', asyncHandler(async (req, res) => {
  const item = await db.get('SELECT * FROM checklist_items WHERE id = ?', [req.params.itemId]);
  if (!item || !(await getOwnedCard(item.card_id, req.user.id))) {
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
    await db.run('UPDATE checklist_items SET text = ? WHERE id = ?', [text.trim(), item.id]);
  }

  res.json(await getCardFull(item.card_id));
}));

router.delete('/checklist/:itemId', asyncHandler(async (req, res) => {
  const item = await db.get('SELECT * FROM checklist_items WHERE id = ?', [req.params.itemId]);
  if (!item || !(await getOwnedCard(item.card_id, req.user.id))) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  await db.run('DELETE FROM checklist_items WHERE id = ?', [item.id]);
  res.json(await getCardFull(item.card_id));
}));

module.exports = router;