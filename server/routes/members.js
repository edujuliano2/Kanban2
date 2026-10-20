const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const { hasOwn, cleanText } = require('../event-fields');
const { normalizeEmail } = require('../family-helpers');

const router = express.Router();
router.use(requireAuth);

const MEMBER_COLORS = [
  '#3b6cf6',
  '#e91e63',
  '#009688',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#10b981',
  '#0ea5e9'
];

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

router.get('/', asyncHandler(async (req, res) => {
  const members = await db.all(
    'SELECT * FROM members WHERE family_id = ? ORDER BY position ASC, id ASC',
    [req.user.family_id]
  );
  res.json(members);
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 80);
  if (!name) {
    return res.status(400).json({ error: 'O nome da pessoa é obrigatório' });
  }

  const email = normalizeEmail(body.email);
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }

  const countRow = await db.get(
    'SELECT COUNT(*) AS count FROM members WHERE family_id = ?',
    [req.user.family_id]
  );
  const position = Number(countRow.count) || 0;

  const result = await db.run(
    `INSERT INTO members
      (user_id, family_id, name, relationship, email, color, emoji, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      req.user.id,
      req.user.family_id,
      name,
      cleanText(body.relationship, 40) || '',
      email || null,
      cleanText(body.color, 20) || MEMBER_COLORS[position % MEMBER_COLORS.length],
      cleanText(body.emoji, 8) || '🙂',
      position
    ]
  );

  const member = await db.get('SELECT * FROM members WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(member);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ? AND family_id = ?', [
    req.params.id,
    req.user.family_id
  ]);
  if (!member) {
    return res.status(404).json({ error: 'Pessoa não encontrada' });
  }

  const body = req.body || {};
  const fields = [];
  const params = [];

  if (hasOwn(body, 'name')) {
    const name = cleanText(body.name, 80);
    if (!name) {
      return res.status(400).json({ error: 'O nome não pode ficar vazio' });
    }
    fields.push('name = ?');
    params.push(name);
  }
  if (hasOwn(body, 'relationship')) {
    fields.push('relationship = ?');
    params.push(cleanText(body.relationship, 40) || '');
  }
  if (hasOwn(body, 'color')) {
    fields.push('color = ?');
    params.push(cleanText(body.color, 20) || null);
  }
  if (hasOwn(body, 'emoji')) {
    fields.push('emoji = ?');
    params.push(cleanText(body.emoji, 8) || '🙂');
  }
  if (hasOwn(body, 'email')) {
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) {
      return res.status(400).json({ error: 'E-mail inválido' });
    }
    if (member.linked_user_id && email !== normalizeEmail(member.email)) {
      return res.status(400).json({
        error: 'O e-mail de quem tem login é alterado em Ajustes da conta.'
      });
    }
    fields.push('email = ?');
    params.push(email || null);
  }

  if (fields.length) {
    params.push(member.id);
    await db.run(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  res.json(await db.get('SELECT * FROM members WHERE id = ?', [member.id]));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ? AND family_id = ?', [
    req.params.id,
    req.user.family_id
  ]);
  if (!member) {
    return res.status(404).json({ error: 'Pessoa não encontrada' });
  }
  if (member.linked_user_id) {
    return res.status(409).json({
      error: 'Esta pessoa tem login próprio e não pode ser removida. Edite o nome ou o papel dela.'
    });
  }

  await db.run('DELETE FROM card_members WHERE member_id = ?', [member.id]);
  await db.run('UPDATE cards SET member_id = NULL WHERE member_id = ?', [member.id]);
  await db.run('DELETE FROM members WHERE id = ?', [member.id]);
  res.json({ ok: true });
}));

module.exports = router;
