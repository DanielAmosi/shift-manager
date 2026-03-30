const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { username } = req.body;
    if (!username || !username.trim())
      return res.status(400).json({ error: 'נא להזין שם משתמש' });

    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
    if (!user)
      return res.status(401).json({ error: 'משתמש לא קיים במערכת' });

    req.session.userId  = user.id;
    req.session.username = user.username;
    req.session.isAdmin  = user.is_admin === 1;

    res.json({ id: user.id, username: user.username, isAdmin: user.is_admin === 1 });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ message: 'התנתקת בהצלחה' }));
  });

  router.get('/me', (req, res) => {
    if (!req.session.userId)
      return res.status(401).json({ error: 'לא מחובר' });
    res.json({ id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin });
  });

  return router;
};
