const express = require('express');

module.exports = function(db) {
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

  router.get('/', requireAuth, (req, res) => {
    const { week_start, week_end } = req.query;
    const userId = req.session.userId;

    let activities;
    if (week_start && week_end) {
      activities = db.prepare(`
        SELECT a.*,
          (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id) as registrations_count,
          (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id AND r.user_id = ?) as user_registered
        FROM activities a
        WHERE a.date >= ? AND a.date <= ?
        ORDER BY a.date ASC, a.start_time ASC
      `).all(userId, week_start, week_end);
    } else {
      activities = db.prepare(`
        SELECT a.*,
          (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id) as registrations_count,
          (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id AND r.user_id = ?) as user_registered
        FROM activities a
        ORDER BY a.date ASC, a.start_time ASC
      `).all(userId);
    }

    res.json(activities);
  });

  router.get('/:id', requireAuth, (req, res) => {
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

    const registrations = db.prepare(`
      SELECT u.id, u.username FROM registrations r
      JOIN users u ON u.id = r.user_id
      WHERE r.activity_id = ?
    `).all(req.params.id);

    res.json({ ...activity, registrations });
  });

  router.post('/', requireAdmin, (req, res) => {
    const { title, date, start_time, end_time, allow_overlap } = req.body;

    if (!title || !date || !start_time || !end_time)
      return res.status(400).json({ error: 'נא למלא את כל השדות החובה' });

    if (start_time >= end_time)
      return res.status(400).json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });

    const result = db.prepare(`
      INSERT INTO activities (title, date, start_time, end_time, allow_overlap)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, date, start_time, end_time, allow_overlap ? 1 : 0);

    res.status(201).json({ id: result.lastInsertRowid, title, date, start_time, end_time, allow_overlap: allow_overlap ? 1 : 0 });
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    if (!activity) return res.status(404).json({ error: 'פעילות לא נמצאה' });

    db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
    res.json({ message: 'הפעילות נמחקה בהצלחה' });
  });

  return router;
};
