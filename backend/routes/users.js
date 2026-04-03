const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    if (!req.session.userId || !req.session.isAdmin)
      return res.status(403).json({ error: 'גישה מותרת למנהל בלבד' });
    next();
  }

  // GET /api/users — with attributes
  router.get('/', requireAdmin, async (req, res) => {
    try {
      const users = await db.all(
        'SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC'
      );
      const attrs = await db.all(
        'SELECT id, user_id, attribute FROM user_attributes ORDER BY id ASC'
      );
      users.forEach(u => {
        u.attributes = attrs.filter(a => a.user_id === u.id);
      });
      res.json(users);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // POST /api/users — create user
  router.post('/', requireAdmin, async (req, res) => {
    try {
      const { username } = req.body;
      if (!username || !username.trim())
        return res.status(400).json({ error: 'נא להזין שם משתמש' });

      const trimmed = username.trim();
      if (trimmed.toLowerCase() === 'admin')
        return res.status(400).json({ error: 'לא ניתן ליצור משתמש עם שם "admin"' });

      const existing = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [trimmed]);
      if (existing) return res.status(409).json({ error: 'משתמש עם שם זה כבר קיים' });

      const result = await db.run('INSERT INTO users (username, is_admin) VALUES (?, 0)', [trimmed]);
      res.status(201).json({ id: result.lastInsertRowid, username: trimmed, is_admin: 0, attributes: [] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // DELETE /api/users/:id — delete user
  router.delete('/:id', requireAdmin, async (req, res) => {
    try {
      const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
      if (user.is_admin) return res.status(400).json({ error: 'לא ניתן למחוק את חשבון המנהל' });

      await db.run('DELETE FROM registrations WHERE user_id = ?', [req.params.id]);
      await db.run('DELETE FROM user_attributes WHERE user_id = ?', [req.params.id]);
      await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
      res.json({ message: 'המשתמש נמחק בהצלחה' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // POST /api/users/:id/attributes — add attribute
  router.post('/:id/attributes', requireAdmin, async (req, res) => {
    try {
      const { attribute } = req.body;
      if (!attribute || !attribute.trim())
        return res.status(400).json({ error: 'נא להזין תכונה' });

      const user = await db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
      if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

      const result = await db.run(
        'INSERT INTO user_attributes (user_id, attribute) VALUES (?, ?)',
        [req.params.id, attribute.trim()]
      );
      res.status(201).json({ id: result.lastInsertRowid, user_id: Number(req.params.id), attribute: attribute.trim() });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // DELETE /api/users/:id/attributes/:attrId — remove attribute
  router.delete('/:id/attributes/:attrId', requireAdmin, async (req, res) => {
    try {
      const attr = await db.get(
        'SELECT id FROM user_attributes WHERE id = ? AND user_id = ?',
        [req.params.attrId, req.params.id]
      );
      if (!attr) return res.status(404).json({ error: 'תכונה לא נמצאה' });

      await db.run('DELETE FROM user_attributes WHERE id = ?', [req.params.attrId]);
      res.json({ message: 'התכונה נמחקה בהצלחה' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  return router;
};
