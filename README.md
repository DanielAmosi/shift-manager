# 📋 מנהל משמרות — Shift Manager

מערכת ניהול משמרות עובדים מלאה בעברית, עם ממשק RTL, אימות, לוח שבועי, ובדיקות חפיפות זמן.

---

## 🚀 הרצה מקומית

### דרישות מוקדמות
- Node.js 18+
- npm

### התקנה והרצה

```bash
# 1. התקן תלויות
npm install

# 2. הרץ את השרת
npm start

# 3. פתח בדפדפן
# http://localhost:3000
```

### פיתוח עם nodemon (רענון אוטומטי)
```bash
npm run dev
```

---

## 🔐 התחברות

| שם משתמש | תפקיד |
|-----------|--------|
| `admin`   | מנהל מערכת — יצירה/מחיקה של הכל |
| כל משתמש שנוצר על ידי admin | עובד |

---

## 📁 מבנה הפרויקט

```
shift-manager/
├── package.json
├── README.md
├── backend/
│   ├── server.js          # שרת Express ראשי
│   ├── database.js        # אתחול SQLite
│   └── routes/
│       ├── auth.js        # התחברות/יציאה
│       ├── users.js       # ניהול משתמשים
│       ├── activities.js  # ניהול פעילויות
│       └── registrations.js # הרשמה לפעילויות
├── frontend/
│   ├── index.html         # דף ה-HTML הראשי
│   ├── css/
│   │   └── style.css      # עיצוב RTL
│   └── js/
│       └── app.js         # לוגיקת הלקוח
└── database/
    └── shifts.db          # נוצר אוטומטית בהרצה ראשונה
```

---

## ☁️ פריסה ב-Render (חינמי)

### שלב 1: העלה ל-GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin <YOUR_GITHUB_URL>
git push -u origin main
```

### שלב 2: צור שירות ב-Render
1. היכנס ל-[render.com](https://render.com) וצור חשבון
2. לחץ **New → Web Service**
3. חבר את ה-GitHub repository שלך

### שלב 3: הגדרות השירות
| שדה | ערך |
|-----|-----|
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### שלב 4: משתני סביבה (אופציונלי אך מומלץ)
ב-Render → Environment → Add Environment Variable:
```
SESSION_SECRET = <מחרוזת סודית ארוכה>
NODE_ENV = production
```

### שלב 5: Deploy
לחץ **Create Web Service** וחכה כ-2 דקות לבנייה.

> ⚠️ **שים לב**: ב-Render Free Tier, הנתונים נמחקים בכל deploy חדש
> (ה-disk אינו persistent). לשמירת נתונים קבועה, שדרג ל-plan בתשלום
> או השתמש ב-Render Disk / PlanetScale / Turso לבסיס הנתונים.

---

## 🔧 API Endpoints

### אימות
| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/auth/login` | התחברות עם שם משתמש |
| POST | `/api/auth/logout` | התנתקות |
| GET | `/api/auth/me` | מידע על המשתמש הנוכחי |

### משתמשים (admin בלבד)
| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/users` | רשימת כל המשתמשים |
| POST | `/api/users` | יצירת משתמש חדש |
| DELETE | `/api/users/:id` | מחיקת משתמש |

### פעילויות
| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/activities` | כל הפעילויות |
| GET | `/api/activities/:id` | פעילות ספציפית + רשומים |
| POST | `/api/activities` | יצירת פעילות (admin) |
| DELETE | `/api/activities/:id` | מחיקת פעילות (admin) |

### הרשמות
| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/registrations` | הרשמה לפעילות |
| DELETE | `/api/registrations/:activity_id` | ביטול הרשמה |
| GET | `/api/registrations/my` | הפעילויות של המשתמש הנוכחי |

---

## ✅ לוגיקת חפיפות זמן

המערכת בודקת חפיפות אוטומטית:
- **אם שתי הפעילויות לא מאפשרות חפיפה** → ההרשמה נחסמת
- **אם לפחות אחת מהפעילויות מאפשרת חפיפה** → ההרשמה מותרת
