const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'shifts.db');

let _db = null;

// Save DB to disk after every write
function save() {
  const data = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// Mimic better-sqlite3's synchronous API
function createWrapper(db) {
  return {
    pragma(str) {
      db.run('PRAGMA ' + str);
    },

    exec(sql) {
      db.run(sql);
      save();
    },

    prepare(sql) {
      return {
        // Returns first matching row as plain object, or undefined
        get(...args) {
          const params = flattenParams(args);
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return convertRow(row);
          }
          stmt.free();
          return undefined;
        },

        // Returns all matching rows as array of plain objects
        all(...args) {
          const params = flattenParams(args);
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) {
            rows.push(convertRow(stmt.getAsObject()));
          }
          stmt.free();
          return rows;
        },

        // Execute write operation, returns { lastInsertRowid, changes }
        run(...args) {
          const params = flattenParams(args);
          db.run(sql, params);
          const rowid = db.exec('SELECT last_insert_rowid() as id')[0];
          save();
          return {
            lastInsertRowid: rowid ? rowid.values[0][0] : null,
            changes: db.getRowsModified()
          };
        }
      };
    }
  };
}

// sql.js wants params as array or object — normalise
function flattenParams(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) return args[0];
  return args;
}

// sql.js returns numbers for booleans — keep as-is; dates stay as strings
function convertRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v;
  }
  return out;
}

async function init() {
  const SQL = await require('sql.js')();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  const db = createWrapper(_db);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      allow_overlap INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      UNIQUE(user_id, activity_id)
    )
  `);

  save();

  // Ensure admin exists
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin' COLLATE NOCASE").get();
  if (!adminExists) {
    db.prepare("INSERT INTO users (username, is_admin) VALUES ('admin', 1)").run();
  }

  return db;
}

module.exports = { init };
