const express = require('express');
const session = require('express-session');
const path = require('path');
const { init: initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'shift-manager-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, '..', 'frontend')));

async function start() {
  // Initialize DB first, then attach routes
  const db = await initDb();

  // Pass db into routes
  app.use('/api/auth',          require('./routes/auth')(db));
  app.use('/api/users',         require('./routes/users')(db));
  app.use('/api/activities',    require('./routes/activities')(db));
  app.use('/api/registrations', require('./routes/registrations')(db));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n✅ השרת פועל: http://localhost:${PORT}`);
    console.log(`   התחבר עם שם המשתמש: admin\n`);
  });
}

start().catch(err => {
  console.error('שגיאה בהפעלת השרת:', err);
  process.exit(1);
});
