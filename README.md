# 📋 מנהל משמרות — Shift Manager v2

מערכת ניהול משמרות עובדים עם Turso (libSQL) ושיבוץ עובדים על ידי מנהל.

---

## 🚀 הרצה מקומית

### התקנה
```bash
npm install
npm start
# http://localhost:3000
```

בלי Turso — האפליקציה תשתמש אוטומטית בקובץ SQLite מקומי.

---

## 🗄️ הגדרת Turso (בסיס נתונים בענן)

### שלב 1 — התקן את Turso CLI
```bash
# Mac / Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell)
winget install chiselstrike.turso
```

### שלב 2 — התחבר
```bash
turso auth login
```

### שלב 3 — צור בסיס נתונים
```bash
turso db create shift-manager
```

### שלב 4 — קבל URL ו-Token
```bash
# URL
turso db show shift-manager --url

# Token
turso db tokens create shift-manager
```

### שלב 5 — הגדר משתני סביבה

צור קובץ `.env` בשורש הפרויקט (או הגדר ב-Render):

```env
DB_URL=libsql://shift-manager-YOUR-USERNAME.turso.io
DB_AUTH_TOKEN=YOUR_TOKEN_HERE
SESSION_SECRET=any-long-random-string
```

לטעינת `.env` מקומית — התקן dotenv:
```bash
npm install dotenv
```
והוסף בתחילת `backend/server.js`:
```js
require('dotenv').config();
```

---

## ☁️ פריסה ב-Render

| שדה | ערך |
|-----|-----|
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

**Environment Variables ב-Render:**
```
DB_URL          = libsql://...
DB_AUTH_TOKEN   = eyJ...
SESSION_SECRET  = מחרוזת-סודית-כלשהי
NODE_ENV        = production
```

---

## 📁 מבנה הפרויקט

```
shift-manager/
├── package.json
├── backend/
│   ├── server.js
│   ├── database.js              ← Turso/libSQL
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       ├── activities.js
│       ├── registrations.js
│       └── assignments.js       ← חדש: שיבוץ עובדים
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
```

---

## ✨ פיצ'רים חדשים בגרסה זו

### שיבוץ עובדים על ידי מנהל
- לחץ על כל פעילות בלוח השבועי
- בחלונית הפעילות → בחר עובד מהרשימה → לחץ **שבץ**
- ניתן להסיר עובד על ידי לחיצה על × ליד שמו
- כל חוקי החפיפות נשמרים גם בשיבוץ ידני

### API Endpoints חדשים
| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/assignments/available/:activity_id` | עובדים זמינים לשיבוץ |
| POST | `/api/assignments` | שיבוץ עובד לפעילות (admin) |
| DELETE | `/api/assignments/:activity_id/:user_id` | הסרת עובד מפעילות (admin) |
