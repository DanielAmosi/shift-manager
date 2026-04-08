const path = require('path');
const fs   = require('fs');

async function init() {
  const { createClient } = require('@libsql/client');

  let url         = process.env.DB_URL;
  const authToken = process.env.DB_AUTH_TOKEN;

  if (!url) {
    const dbDir = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    url = 'file:' + path.join(dbDir, 'shifts.db');
    console.log('💾 מסד נתונים מקומי:', url);
  } else {
    url = url.replace(/^https:\/\//, 'libsql://');
    console.log('📡 מתחבר ל-Turso:', url);
  }

  const isRemote = !url.startsWith('file:');
  if (isRemote && !authToken)
    throw new Error('DB_AUTH_TOKEN חסר! הגדר אותו ב-Render תחת Environment Variables.');

  const client = createClient(isRemote ? { url, authToken } : { url });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      is_admin   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS activities (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      title               TEXT    NOT NULL,
      date                TEXT    NOT NULL,
      start_time          TEXT    NOT NULL,
      end_time            TEXT    NOT NULL,
      allow_overlap       INTEGER NOT NULL DEFAULT 0,
      lock_unregistration INTEGER NOT NULL DEFAULT 0,
      capacity            INTEGER,
      notes               TEXT,
      created_at          TEXT    DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS registrations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      activity_id   INTEGER NOT NULL,
      registered_at TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, activity_id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_attributes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      attribute  TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);

  // Safe migrations for existing DBs
  const migrations = [
    'ALTER TABLE activities ADD COLUMN lock_unregistration INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE activities ADD COLUMN capacity INTEGER',
    'ALTER TABLE activities ADD COLUMN notes TEXT',
  ];
  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch (e) {
      if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
        console.warn('Migration warning:', e.message);
      }
    }
  }

  // Seed admin
  const adminCheck = await client.execute({
    sql: "SELECT id FROM users WHERE username = 'admin' COLLATE NOCASE", args: []
  });
  if (adminCheck.rows.length === 0) {
    await client.execute({ sql: "INSERT INTO users (username, is_admin) VALUES ('admin', 1)", args: [] });
  }

  console.log('✅ בסיס הנתונים מוכן');

  function toObj(row) {
    if (!row) return null;
    const obj = {};
    for (const [k, v] of Object.entries(row))
      obj[k] = typeof v === 'bigint' ? Number(v) : v;
    return obj;
  }

  return {
    async get(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows.length ? toObj(r.rows[0]) : null;
    },
    async all(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows.map(toObj);
    },
    async run(sql, args = []) {
      const r = await client.execute({ sql, args });
      return {
        lastInsertRowid: r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null,
        changes: r.rowsAffected || 0
      };
    }
  };
}

module.exports = { init };
