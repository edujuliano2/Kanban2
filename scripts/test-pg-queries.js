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