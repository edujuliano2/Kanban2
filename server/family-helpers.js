const crypto = require('crypto');

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateInviteCode(db) {
  for (let attempt = 0; attempt < 25; attempt++) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
    }
    const existing = await db.get('SELECT id FROM families WHERE invite_code = ?', [code]);
    if (!existing) return code;
  }
  throw new Error('Não foi possível gerar um código de convite');
}

async function getFamily(db, familyId) {
  return db.get('SELECT * FROM families WHERE id = ?', [familyId]);
}

async function getUserWithFamily(db, userId) {
  return db.get(
    `SELECT users.id, users.name, users.email, users.family_id,
            families.name AS family_name,
            families.invite_code AS family_invite_code,
            (SELECT members.id FROM members
              WHERE members.linked_user_id = users.id
              LIMIT 1) AS member_id
     FROM users
     LEFT JOIN families ON families.id = users.family_id
     WHERE users.id = ?`,
    [userId]
  );
}

async function ensureUserMember(db, user, familyId, { relationship = 'Membro' } = {}) {
  let member = await db.get(
    'SELECT * FROM members WHERE family_id = ? AND linked_user_id = ? LIMIT 1',
    [familyId, user.id]
  );
  if (member) return member;

  member = await db.get(
    `SELECT * FROM members
     WHERE family_id = ?
       AND (linked_user_id IS NULL OR linked_user_id = 0)
       AND lower(email) = lower(?)
     ORDER BY position ASC, id ASC
     LIMIT 1`,
    [familyId, user.email]
  );

  if (!member) {
    // Ajuda a vincular cadastros feitos pelo organizador antes do primeiro login da pessoa.
    member = await db.get(
      `SELECT * FROM members
       WHERE family_id = ?
         AND (linked_user_id IS NULL OR linked_user_id = 0)
         AND (email IS NULL OR email = '')
         AND lower(name) = lower(?)
       ORDER BY position ASC, id ASC
       LIMIT 1`,
      [familyId, user.name]
    );
  }

  if (member) {
    await db.run(
      'UPDATE members SET linked_user_id = ?, email = ? WHERE id = ?',
      [user.id, user.email, member.id]
    );
    return db.get('SELECT * FROM members WHERE id = ?', [member.id]);
  }

  const countRow = await db.get(
    'SELECT COUNT(*) AS count FROM members WHERE family_id = ?',
    [familyId]
  );
  const position = Number(countRow.count) || 0;

  const result = await db.run(
    `INSERT INTO members
      (user_id, family_id, name, relationship, email, color, emoji, position, linked_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      user.id,
      familyId,
      user.name,
      relationship,
      user.email,
      '#3b6cf6',
      '🧑',
      position,
      user.id
    ]
  );

  return db.get('SELECT * FROM members WHERE id = ?', [result.lastInsertRowid]);
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

function validPhone(value) {
  return !value || (value.length >= 12 && value.length <= 15);
}

module.exports = {
  generateInviteCode,
  getFamily,
  getUserWithFamily,
  ensureUserMember,
  normalizeEmail,
  normalizePhone,
  validPhone
};
