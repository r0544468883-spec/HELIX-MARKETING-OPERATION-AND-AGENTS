# HELIX STAGE

הבמה של הסטארטאפים הישראלים — פלטפורמת השקות, הצבעות ופידבק. חלק ממשפחת HELIX.

מסמך האפיון המלא: `Desktop/helix/HELIX STAGE/אפיון HELIX STAGE.md`

## סטאק

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 (טוקנים של מותג HELIX)
- Supabase — DB (Postgres), Auth (Google + LinkedIn), Storage (לוגואים)
- דו-לשוני: עברית (RTL, ברירת מחדל) ואנגלית — `/he/...` ו-`/en/...`
- יום השקות שבועי: יום שלישי (אפשר לשנות ב-`lib/launch-week.ts`)

## הקמה — 4 שלבים

### 1. Supabase

1. נכנסים ל-[supabase.com](https://supabase.com) → New Project (או פרויקט קיים).
2. SQL Editor → New query → מדביקים את כל התוכן של `supabase/schema.sql` → Run.
   זה יוצר את הטבלאות, ההרשאות (RLS), הטריגרים, ה-bucket ללוגואים ואת הקטגוריות.
3. Authentication → Providers:
   - מפעילים **Google** (צריך Client ID + Secret מ-Google Cloud Console).
   - מפעילים **LinkedIn (OIDC)** (צריך אפליקציה ב-LinkedIn Developers).
   - ב-Redirect URLs (Authentication → URL Configuration) מוסיפים:
     - `http://localhost:3000/auth/callback`
     - `https://<הדומיין-של-vercel>/auth/callback`

### 2. משתני סביבה

```bash
cp .env.example .env.local
```

ממלאים מ-Supabase → Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. הרצה מקומית

```bash
npm install
npm run dev
```

פותחים http://localhost:3000 (מפנה אוטומטית ל-`/he`).

### 4. Vercel

1. דוחפים את הריפו ל-GitHub.
2. ב-Vercel: Add New Project → בוחרים את הריפו `helix-stage` (פרויקט נפרד מאתר HELIX).
3. מוסיפים את שלושת משתני הסביבה (עם `NEXT_PUBLIC_SITE_URL` = כתובת ה-Vercel).
4. Deploy. אחרי שיש כתובת — מעדכנים אותה גם ב-Redirect URLs של Supabase.

## מבנה הפרויקט

```
app/[locale]/              עמודים דו-לשוניים (he/en)
  page.tsx                 פיד ההשקות (עמוד הבית)
  products/[slug]/         עמוד מוצר: הצבעות, תגובות, waitlist
  submit/                  טופס השקת מוצר
  categories/              קטגוריות
  profile/[username]/      פרופיל משתמש
  login/ newsletter/ about/
app/auth/callback/         OAuth callback
app/actions.ts             Server Actions: הצבעה, תגובה, waitlist, יצירת מוצר
components/                Nav, LaunchCard, VoteButton, טפסים...
lib/i18n/                  מילוני עברית/אנגלית
lib/launch-week.ts         לוגיקת יום ההשקות השבועי
lib/supabase/              קליינטים ל-server/browser
supabase/schema.sql        הסכמה המלאה — מריצים פעם אחת ב-SQL Editor
```

## מה בשלבים הבאים (לפי האפיון)

- שלב 2: Build in Public, ערוץ Show IL, תגים ו-badges להטמעה
- שלב 3: ביקורות מאומתות (LinkedIn), אינדקס "חלופה ישראלית ל-X", השוואות
- ניוזלטר: חיבור Resend לשליחת דייג'סט שבועי (הרשמות כבר נשמרות ב-DB)
