const { newDb } = require('pg-mem');
const SCHEMA = require('../server/schema');

const db = newDb();
const pg = db.adapters.createPg();
const pool = new pg.Pool();
db.public.none(SCHEMA);

const q = (sql, params = []) => pool.query(sql, params);

(async () => {
  const checks = [];

  async function run(name, fn) {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (err) {
      checks.push({ name, ok: false, message: err.message });
    }
  }

  await run('registro de usuário com RETURNING', async () => {
    const r = await q(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['Eduardo', 'e@e.com', 'hash']
    );
    if (!r.rows[0]?.id) throw new Error('RETURNING id não retornado');
  });

  await run('consulta usuário por email', async () => {
    await q('SELECT * FROM users WHERE email = $1', ['e@e.com']);
  });

  await run('criar quadro', async () => {
    const r = await q(
      'INSERT INTO boards (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      [1, 'Board', 'desc']
    );
    await q('SELECT * FROM boards WHERE id = $1', [r.rows[0].id]);
  });

  await run('listar quadros do usuário', async () => {
    await q('SELECT * FROM boards WHERE user_id = $1 ORDER BY created_at DESC', [1]);
  });

  await run('criar lista + posição', async () => {
    const cnt = await q('SELECT COUNT(*) AS count FROM lists WHERE board_id = $1', [1]);
    const pos = Number(cnt.rows[0].count);
    const r = await q(
      'INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) RETURNING id',
      [1, 'A', pos]
    );
    await q('SELECT * FROM lists WHERE id = $1', [r.rows[0].id]);
  });

  await run('listas do quadro', async () => {
    await q('SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC, id ASC', [1]);
  });

  await run('posse de quadro', async () => {
    await q('SELECT id FROM boards WHERE id = $1 AND user_id = $2', [1, 1]);
  });

  await run('criar cartão', async () => {
    const r = await q(
      'INSERT INTO cards (list_id, title, position) VALUES ($1, $2, $3) RETURNING id',
      [1, 'Tarefa', 0]
    );
    await q('SELECT * FROM cards WHERE id = $1', [r.rows[0].id]);
  });

  await run('detalhe do cartão com board_id', async () => {
    await q(
      `SELECT cards.*, lists.board_id FROM cards
       JOIN lists ON lists.id = cards.list_id
       WHERE cards.id = $1`,
      [1]
    );
  });

  await run('cartões de uma lista', async () => {
    await q('SELECT * FROM cards WHERE list_id = $1 ORDER BY position ASC, id ASC', [1]);
  });

  await run('cartão pertencente a usuário (3 joins)', async () => {
    await q(
      `SELECT cards.* FROM cards
       JOIN lists ON lists.id = cards.list_id
       JOIN boards ON boards.id = lists.board_id
       WHERE cards.id = $1 AND boards.user_id = $2`,
      [1, 1]
    );
  });

  await run('lista alvo pertencente ao usuário', async () => {
    await q(
      `SELECT lists.* FROM lists
       JOIN boards ON boards.id = lists.board_id
       WHERE lists.id = $1 AND boards.user_id = $2`,
      [1, 1]
    );
  });

  await run('contagem de listas para posição', async () => {
    await q('SELECT COUNT(*) AS count FROM lists WHERE board_id = $1', [1]);
  });

  await run('comentário', async () => {
    await q('INSERT INTO comments (card_id, content) VALUES ($1, $2)', [1, 'oi']);
    await q('SELECT * FROM comments WHERE card_id = $1 ORDER BY created_at ASC, id ASC', [1]);
  });

  await run('checklist + toggle', async () => {
    await q('INSERT INTO checklist_items (card_id, text) VALUES ($1, $2)', [1, 'item']);
    await q('UPDATE checklist_items SET checked = $1 WHERE id = $2', [1, 1]);
    await q('SELECT * FROM checklist_items WHERE card_id = $1 ORDER BY id ASC', [1]);
  });

  await run('criar lista #2 para teste de mover', async () => {
    await q('INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) RETURNING id', [1, 'B', 1]);
  });

  await run('lista com cor', async () => {
    const r = await q(
      'INSERT INTO lists (board_id, title, position, color) VALUES ($1, $2, $3, $4) RETURNING id',
      [1, 'C', 2, '#2196f3']
    );
    const row = await q('SELECT * FROM lists WHERE id = $1', [r.rows[0].id]);
    if (row.rows[0].color !== '#2196f3') throw new Error('cor da lista não salva');
    await q('UPDATE lists SET color = $1, title = $2 WHERE id = $3', ['#ff9800', 'C2', r.rows[0].id]);
  });

  await run('cartão com cor', async () => {
    const r = await q(
      'INSERT INTO cards (list_id, title, position, color) VALUES ($1, $2, $3, $4) RETURNING id',
      [1, 'Tarefa cor', 1, '#4caf50']
    );
    await q('UPDATE cards SET color = $1 WHERE id = $2', ['#ff5252', r.rows[0].id]);
  });

  await run('mover cartão (update lista/posição)', async () => {
    await q('UPDATE cards SET list_id = $1, position = $2 WHERE id = $3', [2, 0, 1]);
    await q('UPDATE cards SET position = $1 WHERE id = $2', [0, 1]);
  });

  await run('atualizar cartão', async () => {
    await q('UPDATE cards SET title = $1 WHERE id = $2', ['novo', 1]);
    await q('UPDATE cards SET description = $1 WHERE id = $2', ['d', 1]);
  });

  await run('membro da família', async () => {
    const r = await q(
      `INSERT INTO members (user_id, name, relationship, color, emoji, position)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [1, 'Ana', 'Esposa', '#e91e63', '👩', 0]
    );
    const row = await q('SELECT * FROM members WHERE id = $1 AND user_id = $2', [
      r.rows[0].id,
      1
    ]);
    if (row.rows[0].name !== 'Ana') throw new Error('membro não salvo');
    await q('UPDATE members SET name = $1, relationship = $2 WHERE id = $3', [
      'Ana Paula',
      'Mãe',
      r.rows[0].id
    ]);
  });

  await run('cartão com campos de agenda', async () => {
    const r = await q(
      `INSERT INTO cards
        (list_id, title, position, member_id, event_date, start_time, end_time, location, category, done)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [1, 'Natação', 0, 1, '2026-10-19', '08:30', '09:30', 'Clube', 'esporte', 0]
    );
    await q('UPDATE cards SET event_date = $1, done = $2 WHERE id = $3', [
      '2026-10-20',
      1,
      r.rows[0].id
    ]);
    const row = await q(
      `SELECT cards.*, lists.board_id, boards.name AS board_name
       FROM cards
       JOIN lists ON lists.id = cards.list_id
       JOIN boards ON boards.id = lists.board_id
       WHERE boards.user_id = $1 AND cards.event_date BETWEEN $2 AND $3
       ORDER BY cards.event_date ASC, cards.start_time ASC`,
      [1, '2026-10-19', '2026-10-25']
    );
    if (!row.rows.length) throw new Error('agenda não retornou o compromisso');
  });

  await run('tarefa com tipo e sem horário', async () => {
    const r = await q(
      `INSERT INTO cards (list_id, title, position, card_type, event_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [1, 'Tarefa', 0, 'task', '2026-10-22']
    );
    const row = await q(
      'SELECT card_type, event_date, start_time, end_time FROM cards WHERE id = $1',
      [r.rows[0].id]
    );
    if (
      row.rows[0].card_type !== 'task' ||
      row.rows[0].start_time !== null ||
      row.rows[0].end_time !== null
    ) {
      throw new Error('tarefa não salva corretamente');
    }
  });

  await run('família, login vinculado e múltiplos participantes', async () => {
    const family = await q(
      'INSERT INTO families (name, invite_code, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['Família Teste', 'ABC12345', 1]
    );
    const familyId = family.rows[0].id;

    await q('UPDATE users SET family_id = $1 WHERE id = $2', [familyId, 1]);
    await q('UPDATE boards SET family_id = $1 WHERE id = $2', [familyId, 1]);

    const member = await q(
      `INSERT INTO members
        (user_id, family_id, name, relationship, email, color, emoji, position, linked_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [1, familyId, 'Ana', 'Esposa', 'ana@exemplo.com', '#e91e63', '👩', 1, 1]
    );

    await q('INSERT INTO card_members (card_id, member_id) VALUES ($1, $2)', [
      1,
      member.rows[0].id
    ]);

    const linked = await q(
      `SELECT users.id, families.name AS family_name, families.invite_code
       FROM users
       JOIN families ON families.id = users.family_id
       WHERE users.id = $1`,
      [1]
    );
    if (linked.rows[0].family_name !== 'Família Teste') {
      throw new Error('família não vinculada ao usuário');
    }

    const memberships = await q(
      'SELECT card_id, member_id FROM card_members WHERE card_id = $1',
      [1]
    );
    if (!memberships.rows.length) throw new Error('participantes não salvos');

    const agenda = await q(
      `SELECT cards.*, boards.name AS board_name
       FROM cards
       JOIN lists ON lists.id = cards.list_id
       JOIN boards ON boards.id = lists.board_id
       WHERE boards.family_id = $1 AND cards.event_date >= $2
       ORDER BY cards.event_date ASC, cards.start_time ASC`,
      [familyId, '2026-10-01']
    );
    if (!agenda.rows.length) throw new Error('agenda da família não retornou compromissos');
  });

  await run('atualizar perfil', async () => {
    await q('UPDATE users SET name = $1, email = $2 WHERE id = $3', ['X', 'x@x.com', 1]);
    await q('UPDATE users SET password_hash = $1 WHERE id = $2', ['h', 1]);
    await q('SELECT id, name, email FROM users WHERE id = $1', [1]);
  });

  await run('deletes em cascata', async () => {
    await q('DELETE FROM boards WHERE id = $1', [1]);
  });

  let failures = 0;
  for (const c of checks) {
    if (c.ok) console.log(`  OK  ${c.name}`);
    else {
      failures++;
      console.log(`FAIL  ${c.name}: ${c.message.replace(/\n+/g, ' ')}`);
    }
  }
  console.log(failures ? `\n${failures} falha(s)` : '\nTodas as queries Postgres válidas.');
  process.exit(failures ? 1 : 0);
})();