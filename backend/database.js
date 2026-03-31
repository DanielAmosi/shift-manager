const path = require('path');
const fs = require('fs');

async function init() {
  const { createClient } = require('@libsql/client');

  const url = process.env.DB_URL || (() => {
    // Local fallback: SQLite file
    const dbDir = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    return 'file:' + path.join(dbDir, 'shifts.db');
  })();

  const authToken = process.env.DB_AUTH_TOKEN || undefined;

  const client = createClient({ url, authToken });

  // Enable foreign keys
  //await client.execute('PRAGMA foreign_keys = ON');

  // Create tables one by one (compatible with Turso remote)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      allow_overlap INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      registered_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      UNIQUE(user_id, activity_id)
    )
  `);

  // Ensure admin user exists
  const adminCheck = await client.execute(
    "SELECT id FROM users WHERE username = 'admin' COLLATE NOCASE"
  );
  if (adminCheck.rows.length === 0) {
    await client.execute({
      sql: "INSERT INTO users (username, is_admin) VALUES ('admin', 1)",
      args: []
    });
  }

  // ── Helper: convert libsql Row → plain JS object (handles BigInt) ──
  function toObj(row) {
    if (!row) return null;
    const obj = {};
    for (const [k, v] of Object.entries(row)) {
      obj[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    return obj;
  }

  // ── Public async DB API ──
  return {
    /** Returns first matching row as plain object, or null */
    async get(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows.length ? toObj(r.rows[0]) : null;
    },

    /** Returns all matching rows as array of plain objects */
    async all(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows.map(toObj);
    },

    /** Execute write (INSERT/UPDATE/DELETE). Returns { lastInsertRowid, changes } */
    async run(sql, args = []) {
      const r = await client.execute({ sql, args });
      return {
        lastInsertRowid: r.lastInsertRowid !== undefined ? Number(r.lastInsertRowid) : null,
        changes: r.rowsAffected || 0
      };
    }
  };
}

module.exports = { init };
