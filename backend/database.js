const path = require('path');
const fs = require('fs');

async function init() {
  const { createClient } = require('@libsql/client');

  // שימוש ב-Keys שהגדרת ב-Render (DB_URL ו-DB_AUTH_TOKEN)
  const url = process.env.DB_URL;
  const authToken = process.env.DB_AUTH_TOKEN;

  if (!url) {
    console.error("❌ שגיאה: המשתנה DB_URL לא מוגדר ב-Render!");
  }

  const client = createClient({ 
    url: url, 
    authToken: authToken 
  });

  // יצירת טבלאות בצורה ישירה (מונע את שגיאת ה-Migration 400)
  try {
    console.log("🔄 בודק טבלאות ב-Turso...");
    
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
        UNIQUE(user_id, activity_id)
      )
    `);

    // וודא שיש אדמין
    const adminCheck = await client.execute("SELECT id FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      await client.execute("INSERT INTO users (username, is_admin) VALUES ('admin', 1)");
      console.log("👤 משתמש אדמין נוצר בהצלחה");
    }

    console.log("✅ חיבור ל-Turso עבר בהצלחה!");
  } catch (err) {
    console.error("❌ שגיאה בביצוע שאילתה מול Turso:", err);
    throw err;
  }

  // עזר להמרת נתונים
  function toObj(row) {
    if (!row) return null;
    const obj = {};
    for (const key in row) {
      const v = row[key];
      obj[key] = typeof v === 'bigint' ? Number(v) : v;
    }
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
        lastInsertRowid: r.lastInsertRowid !== undefined ? Number(r.lastInsertRowid) : null,
        changes: r.rowsAffected || 0
      };
    }
  };
}

module.exports = { init };