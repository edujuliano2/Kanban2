const { generateInviteCode } = require('./family-helpers');

async function runFamilyMigration(db) {
  // 1. Cada usuário antigo ganha uma família própria.
  const usersWithoutFamily = await db.all(
    'SELECT id, name, email FROM users WHERE family_id IS NULL'
  );

  for (const user of usersWithoutFamily) {
    const inviteCode = await generateInviteCode(db);
    const firstName = (user.name || 'Família').trim().split(/\s+/)[0];
    const result = await db.run(
      'INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?) RETURNING id',
      [`Família ${firstName}`, inviteCode, user.id]
    );
    const familyId = result.lastInsertRowid;

    await db.run('UPDATE users SET family_id = ? WHERE id = ?', [familyId, user.id]);
    await db.run(
      'UPDATE members SET family_id = ? WHERE family_id IS NULL AND user_id = ?',
      [familyId, user.id]
    );
    await db.run(
      'UPDATE boards SET family_id = ? WHERE family_id IS NULL AND user_id = ?',
      [familyId, user.id]
    );
  }

  // 2. Garante que todo usuário tenha um membro vinculado na família.
  const users = await db.all(
    'SELECT id, name, email, family_id FROM users WHERE family_id IS NOT NULL'
  );

  for (const user of users) {
    const linked = await db.get(
      'SELECT id FROM members WHERE family_id = ? AND linked_user_id = ? LIMIT 1',
      [user.family_id, user.id]
    );
    if (linked) continue;

    const candidate = await db.get(
      `SELECT id FROM members
       WHERE family_id = ?
         AND (linked_user_id IS NULL OR linked_user_id = 0)
         AND (email IS NULL OR email = '')
         AND lower(name) = lower(?)
       ORDER BY position ASC, id ASC
       LIMIT 1`,
      [user.family_id, user.name]
    );

    if (candidate) {
      await db.run(
        'UPDATE members SET linked_user_id = ?, email = ? WHERE id = ?',
        [user.id, user.email, candidate.id]
      );
      continue;
    }

    const countRow = await db.get(
      'SELECT COUNT(*) AS count FROM members WHERE family_id = ?',
      [user.family_id]
    );
    const position = Number(countRow.count) || 0;

    await db.run(
      `INSERT INTO members
        (user_id, family_id, name, relationship, email, color, emoji, position, linked_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.family_id,
        user.name,
        'Eu',
        user.email,
        '#3b6cf6',
        '🧑',
        position,
        user.id
      ]
    );
  }

  // 3. Segurança para bases parcialmente migradas.
  await db.run(
    `UPDATE members
     SET family_id = (SELECT family_id FROM users WHERE users.id = members.user_id)
     WHERE family_id IS NULL`
  );
  await db.run(
    `UPDATE boards
     SET family_id = (SELECT family_id FROM users WHERE users.id = boards.user_id)
     WHERE family_id IS NULL`
  );

  // 4. Converte o antigo campo único member_id para a tabela de vários participantes.
  const cards = await db.all(
    'SELECT id, member_id FROM cards WHERE member_id IS NOT NULL'
  );
  for (const card of cards) {
    const existing = await db.get(
      'SELECT 1 AS one FROM card_members WHERE card_id = ? AND member_id = ?',
      [card.id, card.member_id]
    );
    if (!existing) {
      await db.run(
        'INSERT INTO card_members (card_id, member_id) VALUES (?, ?)',
        [card.id, card.member_id]
      );
    }
  }
}

module.exports = { runFamilyMigration };
