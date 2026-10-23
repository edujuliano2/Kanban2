const { Pool } = require('pg');
const SCHEMA = require('./schema');
const { runFamilyMigration } = require('./family-migration');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DB_SSL === '1'
      ? { rejectUnauthorized: false }
      : undefined
});

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function initPgSchema() {
  await pool.query(SCHEMA);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS family_id INTEGER;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS family_id INTEGER;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS linked_user_id INTEGER;
    ALTER TABLE boards ADD COLUMN IF NOT EXISTS family_id INTEGER;
    ALTER TABLE lists ADD COLUMN IF NOT EXISTS color TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS color TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'event';
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS member_id INTEGER;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS event_date TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS start_time TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS end_time TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'outro';
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS done INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);
    CREATE INDEX IF NOT EXISTS idx_members_linked_user ON members(linked_user_id);
    CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
    CREATE INDEX IF NOT EXISTS idx_boards_family ON boards(family_id);
    CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);
    CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id);
    CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
    CREATE INDEX IF NOT EXISTS idx_cards_event_date ON cards(event_date);
    CREATE INDEX IF NOT EXISTS idx_cards_remind_at ON cards(remind_at);
    CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(card_type);
    CREATE INDEX IF NOT EXISTS idx_card_members_member ON card_members(member_id);
    CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_card ON checklist_items(card_id);
  `);
}

const raw = {
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
  }
};

let schemaPromise = null;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await initPgSchema();
      await runFamilyMigration(raw);
    })().catch((err) => {
      console.error('Erro ao criar schema/migrar famílias no Postgres:', err.message);
    });
  }
  return schemaPromise;
}

const ready = ensureSchema();

module.exports = {
  async get(sql, params = []) {
    await ready;
    return raw.get(sql, params);
  },
  async all(sql, params = []) {
    await ready;
    return raw.all(sql, params);
  },
  async run(sql, params = []) {
    await ready;
    return raw.run(sql, params);
  },
  async exec(sql, params = []) {
    await ready;
    return raw.exec(sql, params);
  },
  async initSchema() {
    await ensureSchema();
  },
  pool
};
