const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    if (!req.session.userId || !req.session.isAdmin)
      return res.status(403).json({ error: 'גישה מותרת למנהל בלבד' });
    next();
  }

  router.get('/', requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  });

  router.post('/', requireAdmin, (req, res) => {
    const { username } = req.body;
    if (!username || !username.trim())
      return res.status(400).json({ error: 'נא להזין שם משתמש' });

    const trimmed = username.trim();
    if (trimmed.toLowerCase() === 'admin')
      return res.status(400).json({ error: 'לא ניתן ליצור משתמש עם שם "admin"' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(trimmed);
    if (existing)
      return res.status(409).json({ error: 'משתמש עם שם זה כבר קיים' });

    const result = db.prepare('INSERT INTO users (username, is_admin) VALUES (?, 0)').run(trimmed);
    res.status(201).json({ id: result.lastInsertRowid, username: trimmed, is_admin: 0 });
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
    if (user.is_admin) return res.status(400).json({ error: 'לא ניתן למחוק את חשבון המנהל' });

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'המשתמש נמחק בהצלחה' });
  });

  return router;
};
