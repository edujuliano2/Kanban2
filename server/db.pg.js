const { Pool } = require('pg');
const SCHEMA = require('./schema');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DB_SSL === '1'
      ? { rejectUnauthorized: false }
      : undefined
});

const SCHEMA = require('./schema');

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function initPgSchema() {
  await pool.query(SCHEMA);
}

initPgSchema().catch((err) => {
  console.error('Erro ao criar schema no Postgres:', err.message);
});

module.exports = {
  async get(sql, params = []) {
    const { rows } = await pool.query(toPg(sql), params);
    return rows[0] ?? null;
  },
  async all(sql, params = []) {
    const { rows } = await pool.query(toPg(sql), params);
    return rows;
  },
  async run(sql, params = []) {
    const result = await pool.query(toPg(sql), params);
    return {
      changes: result.rowCount,
      lastInsertRowid: result.rows[0] ? result.rows[0].id : null
    };
  },
  async exec(sql, params = []) {
    await pool.query(sql, params);
  },
  async initSchema() {
    await initPgSchema();
  },
  pool
};