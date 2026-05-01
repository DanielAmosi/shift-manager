# 📋 מנהל משמרות — Shift Manager v3

מערכת ניהול משמרות עובדים עם Turso (libSQL), שיבוץ עובדים, וניהול קבוצות.

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
ADMIN_PASS=הסיסמה-לאדמין
USER_PASS=הסיסמה-לעובדים
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
ADMIN_PASS      = סיסמה-לאדמין
USER_PASS       = סיסמה-לעובדים
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
│       ├── auth.js              ← התחברות עם סיסמה (ENV)
│       ├── users.js             ← ניהול משתמשים + תכונות
│       ├── teams.js             ← ניהול קבוצות
│       ├── activities.js        ← פעילויות + multi-day + capacity
│       ├── registrations.js     ← הרשמה + בדיקת קבוצה
│       ├── assignments.js       ← שיבוץ ע"י אדמין
│       └── availability.js     ← זמינות שבועית
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
```

---

## ✨ פיצ'רים

### ניהול קבוצות (Teams)
- יצירה ומחיקה של קבוצות (שטח, חפ"ק, אלגוריתמיקה...)
- שיוך עובדים לקבוצות אחת או יותר
- פעילות משויכת לקבוצה אחת
- הרשמה מותרת רק לחברי הקבוצה (נאכף ב-backend)
- סינון לוח שבועי לפי קבוצה

### שיבוץ עובדים על ידי מנהל
- לחץ על פעילות בלוח השבועי → בחר עובד → שבץ
- מציג רק עובדי הקבוצה הרלוונטית
- מציג סטטוס זמינות (זמין 🟢 / מוגבל 🟠 / לא זמין 🔴)
- כל חוקי החפיפות נשמרים

### אימות סיסמה
- כניסה עם שם משתמש + סיסמה
- סיסמות מוגדרות ב-ENV (לא נשמרות ב-DB)

### פיצ'רים נוספים
- פעילויות לטווח תאריכים (multi-day)
- הגבלת כמות משתתפים (capacity)
- נעילת ביטול הרשמה
- הערות לפעילות
- עריכת פעילות
- תכונות למשתמשים
- זמינות שבועית לכל עובד

---

## 🔌 API Endpoints

### Auth
| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/auth/login` | התחברות |
| POST | `/api/auth/logout` | התנתקות |
| GET  | `/api/auth/me` | המשתמש הנוכחי |

### Teams
| Method | Path | תיאור |
|--------|------|-------|
| GET    | `/api/teams` | כל הקבוצות |
| GET    | `/api/teams/my` | הקבוצות של המשתמש המחובר |
| POST   | `/api/teams` | יצירת קבוצה (admin) |
| DELETE | `/api/teams/:id` | מחיקת קבוצה (admin) |
| POST   | `/api/teams/:id/users/:userId` | הוספת עובד לקבוצה (admin) |
| DELETE | `/api/teams/:id/users/:userId` | הסרת עובד מקבוצה (admin) |

### Assignments
| Method | Path | תיאור |
|--------|------|-------|
| GET    | `/api/assignments/available/:activity_id` | עובדים זמינים לשיבוץ |
| POST   | `/api/assignments` | שיבוץ עובד (admin) |
| DELETE | `/api/assignments/:activity_id/:user_id` | הסרת עובד (admin) |
