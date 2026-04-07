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

  function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Generate all dates between start and end (inclusive), YYYY-MM-DD strings
  function dateRange(startStr, endStr) {
    const dates = [];
    const cur = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr   + 'T00:00:00');
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  // GET /api/activities
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { week_start, week_end, period } = req.query;
      const userId = req.session.userId;
      const today  = getToday();

      let sql = `
        SELECT a.*,
          (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id) AS registrations_count,
          (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id AND r.user_id = ?) AS user_registered,
          (SELECT GROUP_CONCAT(u.username, ', ')
            FROM registrations r2
            JOIN users u ON u.id = r2.user_id
            WHERE r2.activity_id = a.id) AS registered_names
        FROM activities a
      `;
      const args = [userId];

      if (week_start && week_end) {
        sql += ' WHERE a.date >= ? AND a.date <= ?';
        args.push(week_start, week_end);
      } else if (period === 'future') {
        sql += ' WHERE a.date >= ?';
        args.push(today);
      } else if (period === 'past') {
        sql += ' WHERE a.date < ?';
        args.push(today);
      }

      sql += period === 'past'
        ? ' ORDER BY a.date DESC, a.start_time DESC'
        : ' ORDER BY a.date ASC, a.start_time ASC';

      const activities = await db.all(sql, args);
      res.json(activities);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // GET /api/activities/:id
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const activity = await db.get('SELECT * FROM activities WHERE id = ?', [req.params.id]);
      if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

      const registrations = await db.all(`
        SELECT u.id, u.username FROM registrations r
        JOIN users u ON u.id = r.user_id
        WHERE r.activity_id = ?
        ORDER BY u.username ASC
      `, [req.params.id]);

      res.json({ ...activity, registrations });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // POST /api/activities — supports single day or date range
  router.post('/', requireAdmin, async (req, res) => {
    try {
      const { title, start_date, end_date, start_time, end_time, allow_overlap, lock_unregistration } = req.body;

      if (!title || !start_date || !start_time || !end_time)
        return res.status(400).json({ error: 'נא למלא את כל השדות החובה' });
      if (start_time >= end_time)
        return res.status(400).json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });

      const finalEndDate = end_date || start_date;

      if (finalEndDate < start_date)
        return res.status(400).json({ error: 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה' });

      const dates    = dateRange(start_date, finalEndDate);
      const overlap  = allow_overlap       ? 1 : 0;
      const lockUnreg = lock_unregistration ? 1 : 0;

      const created = [];
      const skipped = [];

      for (const date of dates) {
        // Skip if exact duplicate (same title + date + start + end) already exists
        const existing = await db.get(
          'SELECT id FROM activities WHERE title = ? AND date = ? AND start_time = ? AND end_time = ?',
          [title, date, start_time, end_time]
        );
        if (existing) {
          skipped.push(date);
          continue;
        }

        const result = await db.run(
          'INSERT INTO activities (title, date, start_time, end_time, allow_overlap, lock_unregistration) VALUES (?, ?, ?, ?, ?, ?)',
          [title, date, start_time, end_time, overlap, lockUnreg]
        );
        created.push({ id: result.lastInsertRowid, date });
      }

      const msg = created.length === 1
        ? 'הפעילות נוצרה בהצלחה'
        : `נוצרו ${created.length} פעילויות${skipped.length ? ` (${skipped.length} כבר קיימות, דולגו)` : ''}`;

      res.status(201).json({ message: msg, created, skipped });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  // DELETE /api/activities/:id
  router.delete('/:id', requireAdmin, async (req, res) => {
    try {
      const activity = await db.get('SELECT * FROM activities WHERE id = ?', [req.params.id]);
      if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

      await db.run('DELETE FROM registrations WHERE activity_id = ?', [req.params.id]);
      await db.run('DELETE FROM activities WHERE id = ?', [req.params.id]);
      res.json({ message: 'הפעילות נמחקה בהצלחה' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'שגיאת שרת' });
    }
  });

  return router;
};
