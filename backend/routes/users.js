const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    if (!req.session.userId || !req.session.isAdmin)
      return res.status(403).json({ error: 'גישה מותרת למנהל בלבד' });
    next();
  }

  // GET /api/users
  router.get('/', requireAdmin, async (req, res) => {
    try {
      const users = await db.all(
        'SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC'
      );
      res.json(users);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // POST /api/users
  router.post('/', requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      if (!username || !username.trim())
        return res.status(400).json({ error: 'נא להזין שם משתמש' });

      const trimmed = username.trim();

      if (trimmed.toLowerCase() === 'admin')
        return res.status(400).json({ error: 'לא ניתן ליצור משתמש עם שם "admin"' });

      const existing = await db.get(
        'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
        [trimmed]
      );
      if (existing)
        return res.status(409).json({ error: 'משתמש עם שם זה כבר קיים' });

      const result = await db.run(
        'INSERT INTO users (username, is_admin) VALUES (?, 0)',
        [trimmed]
      );
      res.status(201).json({ id: result.lastInsertRowid, username: trimmed, is_admin: 0 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // DELETE /api/users/:id
  router.delete('/:id', requireAdmin, async (req, res) => {
    try {
      const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
      if (user.is_admin) return res.status(400).json({ error: 'לא ניתן למחוק את חשבון המנהל' });

      await db.run('DELETE FROM registrations WHERE user_id = ?', [req.params.id]);
      await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
      res.json({ message: 'המשתמש נמחק בהצלחה' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  return router;
};
