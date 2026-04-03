const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  function requireAuth(req, res, next) {
    if (!req.session.userId)
      return res.status(401).json({ error: 'נדרשת התחברות' });
    next();
  }

  function timesOverlap(s1, e1, s2, e2) { return s1 < e2 && e1 > s2; }

  function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // GET /api/registrations/my
  // query: period=future|past  OR  week_start+week_end
  router.get('/my', requireAuth, async (req, res) => {
    try {
      const { week_start, week_end, period } = req.query;
      const userId = req.session.userId;
      const today  = getToday();

      let sql = `
        SELECT a.*, r.registered_at FROM activities a
        JOIN registrations r ON r.activity_id = a.id
        WHERE r.user_id = ?
      `;
      const args = [userId];

      if (week_start && week_end) {
        sql += ' AND a.date >= ? AND a.date <= ?';
        args.push(week_start, week_end);
      } else if (period === 'future') {
        sql += ' AND a.date >= ?';
        args.push(today);
      } else if (period === 'past') {
        sql += ' AND a.date < ?';
        args.push(today);
      }

      sql += (period === 'past')
        ? ' ORDER BY a.date DESC, a.start_time DESC'
        : ' ORDER BY a.date ASC, a.start_time ASC';

      const activities = await db.all(sql, args);
      res.json(activities);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // POST /api/registrations — self-register
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { activity_id } = req.body;
      const userId = req.session.userId;

      if (!activity_id) return res.status(400).json({ error: 'נא לציין פעילות' });

      const activity = await db.get('SELECT * FROM activities WHERE id = ?', [activity_id]);
      if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

      // Prevent registering to past activities
      const today = getToday();
      if (activity.date < today)
        return res.status(400).json({ error: 'לא ניתן להירשם לפעילות שכבר עברה' });

      const already = await db.get(
        'SELECT id FROM registrations WHERE user_id = ? AND activity_id = ?', [userId, activity_id]
      );
      if (already) return res.status(409).json({ error: 'כבר רשום לפעילות זו' });

      const userActivities = await db.all(`
        SELECT a.* FROM activities a
        JOIN registrations r ON r.activity_id = a.id
        WHERE r.user_id = ? AND a.date = ? AND a.id != ?
      `, [userId, activity.date, activity_id]);

      for (const existing of userActivities) {
        if (timesOverlap(activity.start_time, activity.end_time, existing.start_time, existing.end_time)) {
          if (!activity.allow_overlap && !existing.allow_overlap) {
            return res.status(409).json({
              error: `לא ניתן להירשם — חפיפה עם "${existing.title}" (${existing.start_time}–${existing.end_time}). אף פעילות לא מאפשרת חפיפה.`
            });
          }
        }
      }

      await db.run('INSERT INTO registrations (user_id, activity_id) VALUES (?, ?)', [userId, activity_id]);
      res.status(201).json({ message: 'נרשמת לפעילות בהצלחה' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // DELETE /api/registrations/:activity_id — self-unregister
  router.delete('/:activity_id', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { activity_id } = req.params;

      const reg = await db.get(
        'SELECT id FROM registrations WHERE user_id = ? AND activity_id = ?', [userId, activity_id]
      );
      if (!reg) return res.status(404).json({ error: 'לא רשום לפעילות זו' });

      await db.run('DELETE FROM registrations WHERE user_id = ? AND activity_id = ?', [userId, activity_id]);
      res.json({ message: 'הרשמה בוטלה בהצלחה' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  return router;
};
