const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  function requireAuth(req, res, next) {
    if (!req.session.userId)
      return res.status(401).json({ error: 'נדרשת התחברות' });
    next();
  }

  function timesOverlap(s1, e1, s2, e2) {
    return s1 < e2 && e1 > s2;
  }

  router.get('/my', requireAuth, (req, res) => {
    const { week_start, week_end } = req.query;
    const userId = req.session.userId;

    let activities;
    if (week_start && week_end) {
      activities = db.prepare(`
        SELECT a.*, r.registered_at FROM activities a
        JOIN registrations r ON r.activity_id = a.id
        WHERE r.user_id = ? AND a.date >= ? AND a.date <= ?
        ORDER BY a.date ASC, a.start_time ASC
      `).all(userId, week_start, week_end);
    } else {
      activities = db.prepare(`
        SELECT a.*, r.registered_at FROM activities a
        JOIN registrations r ON r.activity_id = a.id
        WHERE r.user_id = ?
        ORDER BY a.date ASC, a.start_time ASC
      `).all(userId);
    }

    res.json(activities);
  });

  router.post('/', requireAuth, (req, res) => {
    const { activity_id } = req.body;
    const userId = req.session.userId;

    if (!activity_id)
      return res.status(400).json({ error: 'נא לציין פעילות' });

    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity_id);
    if (!activity)
      return res.status(404).json({ error: 'פעילות לא נמצאה' });

    const alreadyRegistered = db.prepare(
      'SELECT id FROM registrations WHERE user_id = ? AND activity_id = ?'
    ).get(userId, activity_id);

    if (alreadyRegistered)
      return res.status(409).json({ error: 'כבר רשום לפעילות זו' });

    // Check overlaps with other registered activities on same date
    const userActivities = db.prepare(`
      SELECT a.* FROM activities a
      JOIN registrations r ON r.activity_id = a.id
      WHERE r.user_id = ? AND a.date = ? AND a.id != ?
    `).all(userId, activity.date, activity_id);

    for (const existing of userActivities) {
      const overlaps = timesOverlap(
        activity.start_time, activity.end_time,
        existing.start_time, existing.end_time
      );

      if (overlaps) {
        const overlapAllowed = activity.allow_overlap === 1 || existing.allow_overlap === 1;
        if (!overlapAllowed) {
          return res.status(409).json({
            error: `לא ניתן להירשם — קיימת חפיפה עם "${existing.title}" (${existing.start_time}–${existing.end_time}). אף אחת מהפעילויות לא מאפשרת חפיפה.`
          });
        }
      }
    }

    db.prepare('INSERT INTO registrations (user_id, activity_id) VALUES (?, ?)').run(userId, activity_id);
    res.status(201).json({ message: 'נרשמת לפעילות בהצלחה' });
  });

  router.delete('/:activity_id', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const { activity_id } = req.params;

    const reg = db.prepare(
      'SELECT id FROM registrations WHERE user_id = ? AND activity_id = ?'
    ).get(userId, activity_id);

    if (!reg)
      return res.status(404).json({ error: 'לא רשום לפעילות זו' });

    db.prepare('DELETE FROM registrations WHERE user_id = ? AND activity_id = ?').run(userId, activity_id);
    res.json({ message: 'הרשמה בוטלה בהצלחה' });
  });

  return router;
};
