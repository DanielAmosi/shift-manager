const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    if (!req.session.userId || !req.session.isAdmin)
      return res.status(403).json({ error: 'גישה מותרת למנהל בלבד' });
    next();
  }

  function requireAuth(req, res, next) {
    if (!req.session.userId)
      return res.status(401).json({ error: 'נדרשת התחברות' });
    next();
  }

  // GET /api/teams — all teams (any auth)
  router.get('/', requireAuth, async (req, res) => {
    try {
      const teams = await db.all(`
        SELECT t.*, (SELECT COUNT(*) FROM user_teams ut WHERE ut.team_id = t.id) as member_count
        FROM teams t ORDER BY t.name ASC
      `);
      res.json(teams);
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  // GET /api/teams/my — teams of current user (must be before /:id)
  router.get('/my', requireAuth, async (req, res) => {
    try {
      const teams = await db.all(`
        SELECT t.* FROM teams t
        JOIN user_teams ut ON ut.team_id = t.id
        WHERE ut.user_id = ?
        ORDER BY t.name ASC
      `, [req.session.userId]);
      res.json(teams);
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  // POST /api/teams — create team (admin)
  router.post('/', requireAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim())
        return res.status(400).json({ error: 'נא להזין שם קבוצה' });

      const existing = await db.get('SELECT id FROM teams WHERE name = ? COLLATE NOCASE', [name.trim()]);
      if (existing)
        return res.status(409).json({ error: 'קבוצה עם שם זה כבר קיימת' });

      const result = await db.run('INSERT INTO teams (name) VALUES (?)', [name.trim()]);
      res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), member_count: 0 });
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  // DELETE /api/teams/:id — delete team (admin)
  router.delete('/:id', requireAdmin, async (req, res) => {
    try {
      const team = await db.get('SELECT * FROM teams WHERE id = ?', [req.params.id]);
      if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

      await db.run('DELETE FROM user_teams WHERE team_id = ?', [req.params.id]);
      // Unlink activities from this team
      await db.run('UPDATE activities SET team_id = NULL WHERE team_id = ?', [req.params.id]);
      await db.run('DELETE FROM teams WHERE id = ?', [req.params.id]);
      res.json({ message: `הקבוצה "${team.name}" נמחקה` });
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  // POST /api/teams/:id/users/:userId — add user to team (admin)
  router.post('/:id/users/:userId', requireAdmin, async (req, res) => {
    try {
      const { id, userId } = req.params;
      const team = await db.get('SELECT id FROM teams WHERE id = ?', [id]);
      if (!team) return res.status(404).json({ error: 'קבוצה לא נמצאה' });

      const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
      if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

      const existing = await db.get(
        'SELECT id FROM user_teams WHERE user_id = ? AND team_id = ?', [userId, id]
      );
      if (existing) return res.status(409).json({ error: 'המשתמש כבר בקבוצה זו' });

      await db.run('INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)', [userId, id]);
      res.status(201).json({ message: 'המשתמש נוסף לקבוצה' });
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  // DELETE /api/teams/:id/users/:userId — remove user from team (admin)
  router.delete('/:id/users/:userId', requireAdmin, async (req, res) => {
    try {
      const { id, userId } = req.params;
      await db.run('DELETE FROM user_teams WHERE user_id = ? AND team_id = ?', [userId, id]);
      res.json({ message: 'המשתמש הוסר מהקבוצה' });
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  return router;
};
