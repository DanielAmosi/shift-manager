const path = require('path');

async function init() {
  // שים לב: אנחנו מייבאים רק את createClient
  const { createClient } = require('@libsql/client/http'); 

  const url = process.env.DB_URL;
  const authToken = process.env.DB_AUTH_TOKEN;

  if (!url || !url.startsWith('https')) {
    console.log("⚠️ שים לב: משנה את הפרוטוקול ל-https לצורך חיבור HTTP יציב");
  }

  // Turso מעדיף https:// כשעובדים עם ה-HTTP client
  const httpUrl = url.replace('libsql://', 'https://');

  const client = createClient({ 
    url: httpUrl, 
    authToken: authToken 
  });

  try {
    console.log("🔄 מתחבר ל-Turso באמצעות HTTP...");
    
    // יצירת טבלאות
    await client.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");
    await client.execute("CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, allow_overlap INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");
    await client.execute("CREATE TABLE IF NOT EXISTS registrations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, activity_id INTEGER NOT NULL, registered_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, activity_id))");

    // בדיקת אדמין
    const adminCheck = await client.execute("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      await client.execute("INSERT INTO users (username, is_admin) VALUES ('admin', 1)");
    }

    console.log("✅ הזרקת נתונים ל-Turso הצליחה!");
  } catch (err) {
    console.error("❌ שגיאה ב-Turso HTTP:", err.message);
    throw err;
  }

  return {
    async get(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows.length ? r.rows[0] : null;
    },
    async all(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows;
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