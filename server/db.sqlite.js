const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { runFamilyMigration } = require('./family-migration');

const dataDir = path.join(__dirname, 'data');
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.error('[SQLite] Não foi possível criar o diretório de dados:', err.message);
}

const db = new DatabaseSync(path.join(dataDir, 'kanban.db'));

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    family_id INTEGER,
    name TEXT NOT NULL,
    relationship TEXT DEFAULT '',
    email TEXT,
    color TEXT,
    emoji TEXT DEFAULT '🙂',
    position INTEGER NOT NULL DEFAULT 0,
    linked_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    family_id INTEGER,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT,
    member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    event_date TEXT,
    start_time TEXT,
    end_time TEXT,
    location TEXT DEFAULT '',
    category TEXT DEFAULT 'outro',
    done INTEGER NOT NULL DEFAULT 0,
    remind_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS card_members (
    card_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    PRIMARY KEY (card_id, member_id),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
  );
`);

// Migrações de colunas para bancos já existentes.
const cardColumns = {
  color: 'TEXT',
  member_id: 'INTEGER',
  event_date: 'TEXT',
  start_time: 'TEXT',
  end_time: 'TEXT',
  location: "TEXT DEFAULT ''",
  category: "TEXT DEFAULT 'outro'",
  done: 'INTEGER NOT NULL DEFAULT 0',
  remind_at: 'TEXT'
};

const existingCardColumns = db.prepare('PRAGMA table_info(cards)').all();
for (const [name, type] of Object.entries(cardColumns)) {
  if (!existingCardColumns.some((col) => col.name === name)) {
    db.exec(`ALTER TABLE cards ADD COLUMN ${name} ${type}`);
  }
}

const membershipColumns = {
  user_id: 'INTEGER',
  family_id: 'INTEGER',
  name: 'TEXT',
  relationship: "TEXT DEFAULT ''",
  email: 'TEXT',
  color: 'TEXT',
  emoji: "TEXT DEFAULT '🙂'",
  position: 'INTEGER NOT NULL DEFAULT 0',
  linked_user_id: 'INTEGER'
};
const existingMemberColumns = db.prepare('PRAGMA table_info(members)').all();
for (const [name, type] of Object.entries(membershipColumns)) {
  if (!existingMemberColumns.some((col) => col.name === name)) {
    db.exec(`ALTER TABLE members ADD COLUMN ${name} ${type}`);
  }
}

const existingUserColumns = db.prepare('PRAGMA table_info(users)').all();
if (!existingUserColumns.some((col) => col.name === 'family_id')) {
  db.exec('ALTER TABLE users ADD COLUMN family_id INTEGER');
}

const existingBoardColumns = db.prepare('PRAGMA table_info(boards)').all();
if (!existingBoardColumns.some((col) => col.name === 'family_id')) {
  db.exec('ALTER TABLE boards ADD COLUMN family_id INTEGER');
}

const existingListColumns = db.prepare('PRAGMA table_info(lists)').all();
if (!existingListColumns.some((col) => col.name === 'color')) {
  db.exec('ALTER TABLE lists ADD COLUMN color TEXT');
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);
  CREATE INDEX IF NOT EXISTS idx_boards_family ON boards(family_id);
  CREATE INDEX IF NOT EXISTS idx_cards_event_date ON cards(event_date);
  CREATE INDEX IF NOT EXISTS idx_cards_remind_at ON cards(remind_at);
  CREATE INDEX IF NOT EXISTS idx_card_members_member ON card_members(member_id);
`);

const raw = {
  async get(sql, params = []) {
    return db.prepare(sql).get(...params) ?? null;
  },
  async all(sql, params = []) {
    return db.prepare(sql).all(...params);
  },
  async run(sql, params = []) {
    const result = db.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
  },
  async exec(sql, params = []) {
    db.prepare(sql).run(...params);
  }
};

const ready = runFamilyMigration(raw).catch((err) => {
  console.error('Erro na migração de famílias:', err.message);
});

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
  }
};
