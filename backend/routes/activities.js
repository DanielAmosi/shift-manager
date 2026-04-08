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

  function dateRange(startStr, endStr) {
    const dates = [];
    const cur = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr   + 'T00:00:00');
    while (cur <= end) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  function timesOverlap(s1, e1, s2, e2) { return s1 < e2 && e1 > s2; }

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

  // POST /api/activities — create (supports multi-day)
  router.post('/', requireAdmin, async (req, res) => {
    try {
      const {
        title, start_date, end_date, start_time, end_time,
        allow_overlap, lock_unregistration, capacity, notes
      } = req.body;

      if (!title || !start_date || !start_time || !end_time)
        return res.status(400).json({ error: 'נא למלא את כל השדות החובה' });
      if (start_time >= end_time)
        return res.status(400).json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });

      const finalEndDate = end_date || start_date;
      if (finalEndDate < start_date)
        return res.status(400).json({ error: 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה' });

      const capVal    = capacity != null && capacity !== '' ? parseInt(capacity) : null;
      const overlap   = allow_overlap        ? 1 : 0;
      const lockUnreg = lock_unregistration  ? 1 : 0;
      const notesVal  = notes || null;

      if (capVal !== null && (isNaN(capVal) || capVal < 1))
        return res.status(400).json({ error: 'כמות משתתפים חייבת להיות מספר חיובי' });

      const dates   = dateRange(start_date, finalEndDate);
      const created = [];
      const skipped = [];

      for (const date of dates) {
        const existing = await db.get(
          'SELECT id FROM activities WHERE title = ? AND date = ? AND start_time = ? AND end_time = ?',
          [title, date, start_time, end_time]
        );
        if (existing) { skipped.push(date); continue; }

        const result = await db.run(
          `INSERT INTO activities (title, date, start_time, end_time, allow_overlap, lock_unregistration, capacity, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [title, date, start_time, end_time, overlap, lockUnreg, capVal, notesVal]
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

  // PUT /api/activities/:id — edit activity (admin only)
  router.put('/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const activity = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
      if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

      const {
        title, date, start_time, end_time,
        allow_overlap, lock_unregistration, capacity, notes
      } = req.body;

      if (!title || !date || !start_time || !end_time)
        return res.status(400).json({ error: 'נא למלא את כל השדות החובה' });
      if (start_time >= end_time)
        return res.status(400).json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });

      const capVal = capacity != null && capacity !== '' ? parseInt(capacity) : null;
      if (capVal !== null && (isNaN(capVal) || capVal < 1))
        return res.status(400).json({ error: 'כמות משתתפים חייבת להיות מספר חיובי' });

      // Get current registrations count
      const countRow = await db.get(
        'SELECT COUNT(*) as cnt FROM registrations WHERE activity_id = ?', [id]
      );
      const currentCount = countRow ? countRow.cnt : 0;

      // Validate: new capacity < current registrations
      if (capVal !== null && capVal < currentCount) {
        return res.status(400).json({
          error: `לא ניתן להגדיר כמות ${capVal} — כבר יש ${currentCount} משתתפים רשומים`
        });
      }

      // Validate time change: check overlap for registered users
      const timeChanged = start_time !== activity.start_time ||
                          end_time   !== activity.end_time   ||
                          date       !== activity.date;

      if (timeChanged) {
        const registeredUsers = await db.all(
          'SELECT user_id FROM registrations WHERE activity_id = ?', [id]
        );

        for (const { user_id } of registeredUsers) {
          const otherActivities = await db.all(`
            SELECT a.* FROM activities a
            JOIN registrations r ON r.activity_id = a.id
            WHERE r.user_id = ? AND a.date = ? AND a.id != ?
          `, [user_id, date, id]);

          const newOverlapAllowed = allow_overlap ? 1 : 0;

          for (const other of otherActivities) {
            if (timesOverlap(start_time, end_time, other.start_time, other.end_time)) {
              if (!newOverlapAllowed && !other.allow_overlap) {
                const user = await db.get('SELECT username FROM users WHERE id = ?', [user_id]);
                return res.status(409).json({
                  error: `שינוי הזמן יוצר חפיפה עבור ${user?.username || 'משתמש'} עם "${other.title}" (${other.start_time}–${other.end_time})`
                });
              }
            }
          }
        }
      }

      await db.run(
        `UPDATE activities SET
           title = ?, date = ?, start_time = ?, end_time = ?,
           allow_overlap = ?, lock_unregistration = ?, capacity = ?, notes = ?
         WHERE id = ?`,
        [
          title, date, start_time, end_time,
          allow_overlap ? 1 : 0,
          lock_unregistration ? 1 : 0,
          capVal,
          notes || null,
          id
        ]
      );

      const updated = await db.get('SELECT * FROM activities WHERE id = ?', [id]);
      res.json({ message: 'הפעילות עודכנה בהצלחה', activity: updated });
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
