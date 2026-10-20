const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const { getUserWithFamily, normalizeEmail } = require('../family-helpers');

const router = express.Router();
router.use(requireAuth);

router.get('/me', asyncHandler(async (req, res) => {
  const user = await getUserWithFamily(db, req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  res.json(user);
}));

router.put('/profile', asyncHandler(async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body || {};
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  if (newPassword && !bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(400).json({ error: 'A senha atual está incorreta' });
  }

  const newName = (name && name.trim()) || user.name;
  const newEmail = email ? normalizeEmail(email) : user.email;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }

  if (newEmail !== user.email) {
    const existing = await db.get(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [newEmail, user.id]
    );
    if (existing) {
      return res.status(409).json({ error: 'Este email já está em uso' });
    }
  }

  await db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', [
    newName,
    newEmail,
    user.id
  ]);

  await db.run('UPDATE members SET name = ?, email = ? WHERE linked_user_id = ?', [
    newName,
    newEmail,
    user.id
  ]);

  if (newPassword) {
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  }

  res.json(await getUserWithFamily(db, user.id));
}));

module.exports = router;
