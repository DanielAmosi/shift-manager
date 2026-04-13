const express = require('express');
const router = express.Router();
const db = require('../database');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim())
    return res.status(400).json({ error: 'נא להזין שם משתמש' });

  if (!password)
    return res.status(400).json({ error: 'נא להזין סיסמה' });

  const trimmed    = username.trim();
  const isAdmin    = trimmed.toLowerCase() === 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
  const USER_PASS  = process.env.USER_PASS  || 'user';

  // Check password based on user type
  const expectedPass = isAdmin ? ADMIN_PASS : USER_PASS;
  if (password !== expectedPass)
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });

  // Verify user exists in DB
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(trimmed);
  if (!user)
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });

  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.isAdmin  = user.is_admin === 1;

  res.json({
    id:      user.id,
    username: user.username,
    isAdmin: user.is_admin === 1
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'התנתקת בהצלחה' }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: 'לא מחובר' });
  res.json({
    id:      req.session.userId,
    username: req.session.username,
    isAdmin:  req.session.isAdmin
  });
});

module.exports = router;
