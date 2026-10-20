const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../helpers');
const { cleanText } = require('../event-fields');
const {
  generateInviteCode,
  getFamily,
  getUserWithFamily,
  ensureUserMember
} = require('../family-helpers');

const router = express.Router();
router.use(requireAuth);

async function familyWithMembers(familyId) {
  const family = await getFamily(db, familyId);
  if (!family) return null;
  const members = await db.all(
    'SELECT * FROM members WHERE family_id = ? ORDER BY position ASC, id ASC',
    [familyId]
  );
  return { ...family, members };
}

router.get('/', asyncHandler(async (req, res) => {
  const family = await familyWithMembers(req.user.family_id);
  if (!family) {
    return res.status(404).json({ error: 'Família não encontrada' });
  }
  res.json(family);
}));

router.put('/', asyncHandler(async (req, res) => {
  const name = cleanText((req.body || {}).name, 120);
  if (!name) {
    return res.status(400).json({ error: 'O nome da família não pode ficar vazio' });
  }

  await db.run('UPDATE families SET name = ? WHERE id = ?', [
    name,
    req.user.family_id
  ]);

  res.json(await familyWithMembers(req.user.family_id));
}));

router.post('/invite-code', asyncHandler(async (req, res) => {
  const code = await generateInviteCode(db);
  await db.run('UPDATE families SET invite_code = ? WHERE id = ?', [
    code,
    req.user.family_id
  ]);
  res.json(await familyWithMembers(req.user.family_id));
}));

router.post('/join', asyncHandler(async (req, res) => {
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: 'Informe o código de convite' });
  }

  const targetFamily = await db.get('SELECT * FROM families WHERE invite_code = ?', [code]);
  if (!targetFamily) {
    return res.status(404).json({ error: 'Código de convite inválido' });
  }

  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

  if (user.family_id === targetFamily.id) {
    return res.json({
      joined: false,
      user: await getUserWithFamily(db, user.id),
      family: await familyWithMembers(targetFamily.id)
    });
  }

  const boardCount = await db.get(
    'SELECT COUNT(*) AS count FROM boards WHERE family_id = ?',
    [user.family_id]
  );
  const memberCount = await db.get(
    'SELECT COUNT(*) AS count FROM members WHERE family_id = ?',
    [user.family_id]
  );

  if (Number(boardCount.count) > 0 || Number(memberCount.count) > 1) {
    return res.status(409).json({
      error:
        'Sua conta já tem agendas ou outras pessoas na família atual. Para entrar em outra família sem perder esses dados, isso precisa ser feito manualmente.'
    });
  }

  const oldFamilyId = user.family_id;

  await db.run('UPDATE users SET family_id = ? WHERE id = ?', [targetFamily.id, user.id]);
  await db.run('DELETE FROM members WHERE family_id = ?', [oldFamilyId]);
  await db.run('DELETE FROM families WHERE id = ?', [oldFamilyId]);

  const targetUser = await getUserWithFamily(db, user.id);
  await ensureUserMember(db, targetUser, targetFamily.id, { relationship: 'Membro' });

  res.json({
    joined: true,
    user: await getUserWithFamily(db, user.id),
    family: await familyWithMembers(targetFamily.id)
  });
}));

module.exports = router;
