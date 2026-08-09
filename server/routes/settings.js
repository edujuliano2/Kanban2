const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/me', (req, res) => {
  const user = db
    .prepare('SELECT id, name, email FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  res.json(user);
});

router.put('/profile', (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  if (newPassword && !bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(400).json({ error: 'A senha atual está incorreta' });
  }

  const newName = (name && name.trim()) || user.name;
  const newEmail = (email && email.trim()) || user.email;

  if (newEmail !== user.email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, user.id);
    if (existing) {
      return res.status(409).json({ error: 'Este email já está em uso' });
    }
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(newName, newEmail, user.id);

  if (newPassword) {
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  }

  res.json({ id: user.id, name: newName, email: newEmail });
});

module.exports = router;
