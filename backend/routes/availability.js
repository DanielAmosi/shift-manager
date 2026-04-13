const express = require('express');
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const VALID_STATUSES = ['AVAILABLE', 'UNAVAILABLE', 'LIMITED'];

module.exports = function (db) {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    if (!req.session.userId || !req.session.isAdmin)
      return res.status(403).json({ error: 'גישה מותרת למנהל בלבד' });
    next();
  }

  // GET /api/availability/:user_id
  router.get('/:user_id', requireAdmin, async (req, res) => {
    try {
      const rows = await db.all('SELECT day_of_week, status FROM user_availability WHERE user_id = ? ORDER BY day_of_week ASC', [req.params.user_id]);
      const result = Array.from({ length: 7 }, (_, i) => {
        const found = rows.find(r => r.day_of_week === i);
        return { day_of_week: i, day_name: DAY_NAMES[i], status: found ? found.status : 'AVAILABLE' };
      });
      res.json(result);
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  // PUT /api/availability/:user_id/:day
  router.put('/:user_id/:day', requireAdmin, async (req, res) => {
    try {
      const userId = req.params.user_id;
      const day    = parseInt(req.params.day);
      const { status } = req.body;
      if (isNaN(day) || day < 0 || day > 6) return res.status(400).json({ error: 'יום לא תקין (0–6)' });
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });
      const existing = await db.get('SELECT id FROM user_availability WHERE user_id = ? AND day_of_week = ?', [userId, day]);
      if (existing) {
        await db.run('UPDATE user_availability SET status = ? WHERE user_id = ? AND day_of_week = ?', [status, userId, day]);
      } else {
        await db.run('INSERT INTO user_availability (user_id, day_of_week, status) VALUES (?, ?, ?)', [userId, day, status]);
      }
      res.json({ message: `זמינות עודכנה ליום ${DAY_NAMES[day]}`, day_of_week: day, status });
    } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
  });

  return router;
};
