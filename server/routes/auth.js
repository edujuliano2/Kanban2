const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const {
  generateInviteCode,
  getUserWithFamily,
  ensureUserMember,
  normalizeEmail
} = require('../family-helpers');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, inviteCode } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  const cleanName = String(name).trim().slice(0, 120);
  const cleanEmail = normalizeEmail(email);
  if (!cleanName || !cleanEmail) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios' });
  }

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existing) {
    return res.status(409).json({ error: 'Este email já está cadastrado' });
  }

  let family = null;
  if (inviteCode && String(inviteCode).trim()) {
    family = await db.get('SELECT * FROM families WHERE invite_code = ?', [
      String(inviteCode).trim().toUpperCase()
    ]);
    if (!family) {
      return res.status(400).json({ error: 'Código de convite inválido' });
    }
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await db.run(
    'INSERT INTO users (family_id, name, email, password_hash) VALUES (?, ?, ?, ?) RETURNING id',
    [family ? family.id : null, cleanName, cleanEmail, hash]
  );

  const userId = result.lastInsertRowid;

  if (!family) {
    const firstName = cleanName.split(/\s+/)[0] || 'Família';
    const code = await generateInviteCode(db);
    const familyResult = await db.run(
      'INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?) RETURNING id',
      [`Família ${firstName}`, code, userId]
    );
    await db.run('UPDATE users SET family_id = ? WHERE id = ?', [
      familyResult.lastInsertRowid,
      userId
    ]);
  }

  const createdUser = await getUserWithFamily(db, userId);
  await ensureUserMember(db, createdUser, createdUser.family_id, {
    relationship: family ? 'Membro' : 'Eu'
  });

  const user = await getUserWithFamily(db, userId);
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const user = await db.get('SELECT * FROM users WHERE email = ?', [normalizeEmail(email)]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  }

  const publicUser = await getUserWithFamily(db, user.id);
  res.json({ token: signToken(publicUser), user: publicUser });
}));

module.exports = router;
