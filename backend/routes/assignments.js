const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    if (!req.session.userId || !req.session.isAdmin)
      return res.status(403).json({ error: 'גישה מותרת למנהל בלבד' });
    next();
  }

  function timesOverlap(s1, e1, s2, e2) { return s1 < e2 && e1 > s2; }

  // GET /api/assignments/available/:activity_id
  // Returns users NOT yet registered, with availability_status for the activity's day
  router.get('/available/:activity_id', requireAdmin, async (req, res) => {
    try {
      const { activity_id } = req.params;

      const activity = await db.get('SELECT date FROM activities WHERE id = ?', [activity_id]);
      if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

      // day_of_week: 0=Sunday ... 6=Saturday (same as JS Date.getDay())
      const actDate   = new Date(activity.date + 'T00:00:00');
      const dayOfWeek = actDate.getDay();

      const users = await db.all(`
        SELECT u.id, u.username FROM users u
        WHERE u.is_admin = 0
          AND u.id NOT IN (SELECT r.user_id FROM registrations r WHERE r.activity_id = ?)
        ORDER BY u.username ASC
      `, [activity_id]);

      // Attach availability status for each user
      for (const user of users) {
        const avail = await db.get(
          'SELECT status FROM user_availability WHERE user_id = ? AND day_of_week = ?',
          [user.id, dayOfWeek]
        );
        user.availability_status = avail ? avail.status : 'AVAILABLE';
      }

      // Sort: AVAILABLE first, LIMITED second, UNAVAILABLE last
      const ORDER = { AVAILABLE: 0, LIMITED: 1, UNAVAILABLE: 2 };
      users.sort((a, b) => {
        const diff = ORDER[a.availability_status] - ORDER[b.availability_status];
        return diff !== 0 ? diff : a.username.localeCompare(b.username, 'he');
      });

      res.json(users);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // POST /api/assignments — admin assigns a user (no capacity block for admin)
  router.post('/', requireAdmin, async (req, res) => {
    try {
      const { user_id, activity_id } = req.body;
      if (!user_id || !activity_id)
        return res.status(400).json({ error: 'נא לציין עובד ופעילות' });

      const activity = await db.get('SELECT * FROM activities WHERE id = ?', [activity_id]);
      if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

      const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
      if (!user) return res.status(404).json({ error: 'עובד לא נמצא' });

      const already = await db.get('SELECT id FROM registrations WHERE user_id = ? AND activity_id = ?', [user_id, activity_id]);
      if (already) return res.status(409).json({ error: `${user.username} כבר משובץ לפעילות זו` });

      const userActivities = await db.all(`
        SELECT a.* FROM activities a
        JOIN registrations r ON r.activity_id = a.id
        WHERE r.user_id = ? AND a.date = ? AND a.id != ?
      `, [user_id, activity.date, activity_id]);

      for (const existing of userActivities) {
        if (timesOverlap(activity.start_time, activity.end_time, existing.start_time, existing.end_time)) {
          if (!activity.allow_overlap && !existing.allow_overlap) {
            return res.status(409).json({
              error: `לא ניתן לשבץ את ${user.username} — חפיפה עם "${existing.title}" (${existing.start_time}–${existing.end_time})`
            });
          }
        }
      }

      await db.run('INSERT INTO registrations (user_id, activity_id) VALUES (?, ?)', [user_id, activity_id]);
      res.status(201).json({ message: `${user.username} שובץ לפעילות בהצלחה` });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // DELETE /api/assignments/:activity_id/:user_id
  router.delete('/:activity_id/:user_id', requireAdmin, async (req, res) => {
    try {
      const { activity_id, user_id } = req.params;
      const reg = await db.get('SELECT id FROM registrations WHERE user_id = ? AND activity_id = ?', [user_id, activity_id]);
      if (!reg) return res.status(404).json({ error: 'עובד לא משובץ לפעילות זו' });

      const user = await db.get('SELECT username FROM users WHERE id = ?', [user_id]);
      await db.run('DELETE FROM registrations WHERE user_id = ? AND activity_id = ?', [user_id, activity_id]);
      res.json({ message: `${user ? user.username : 'העובד'} הוסר מהפעילות בהצלחה` });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  return router;
};
