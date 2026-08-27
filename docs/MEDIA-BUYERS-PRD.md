# HELIX Media Buyers — PRD

מודול רכש וניהול מדיה בתוך HELIX Marketing OPS. צוות סוכני AI שמתכנן, קונה, מבצע אופטימיזציה ומדווח על מדיה, על פני פלטפורמות ביצועים (API) ופאבלישרים ישראליים (דיל ידני), כולל יצירת creatives.

סטטוס: טיוטה לאישור · עודכן 2026-08-27 · בעלים: OPS

---

## 1. הבעיה והמיצוב

מיפוי השוק ([דוח מלא](https://claude.ai/code/artifact/219e7894-a409-4497-9ce1-e519a0327778)) מראה פיצול חד:

- **כלי מוצר גלובליים** (Madgicx, Revealbot/Birch, Ryze, AdStellar, Superscale, Smartly) — חזקים ב‑Meta/Google, ממוקדי API, אין להם צד ישראלי ואין ניהול דיל ישיר מול פאבלישר.
- **סוכנויות ישראליות** (מוקד הפרסום, יוניון מדיה, אטומי) — יודעות לסגור דיל מול Ynet/Walla/טלוויזיה, אבל ידני, לא מוצר, לא אוטונומי.

**אף אחד לא סוגר את כל השורה.** זו העמדה של HELIX Media Buyers:

| | אוטומציה (API) | דיל פאבלישר ישראלי | Creatives | מודל |
|---|:---:|:---:|:---:|---|
| Madgicx / Ryze / AdStellar | ✅ | ❌ | חלקי | מוצר |
| מוקד / יוניון מדיה | חלקי | ✅ | ✅ (אנושי) | שירות |
| **HELIX Media Buyers** | ✅ | ✅ | ✅ (AI+voice) | **מוצר multi-tenant** |

**התובנה המרכזית:** חצי מהשוק אוטומטי (API) וחצי נסגר בדיל אנושי. המודול חייב שני מסלולי הפעלה.

---

## 2. מטרות ולא-מטרות

**מטרות**
- מסלול Auto: תכנון, השקה, kill&scale, fatigue, דיווח על Meta/Google/TikTok/Taboola/Outbrain דרך API, אוטונומי.
- מסלול Managed: pipeline לניהול דילים ישירים מול פאבלישרים ישראליים (IO/PMP/PG) עד רמת מעקב הופעות מול הבטחה וחשבוניות.
- Media Planner שמפצל תקציב בין הערוצים לפני קנייה.
- יצירת creatives (באנר/כתבה/וידאו) מחוברת ל‑voice cloning הקיים.
- Multi-tenant: סוכנות רב‑לקוחות + עסק יחיד, workspace לכל לקוח.
- עטיפת Autonomy: advisor → approve → autopilot לכל buy.

**DV360 — בסקופ (נוסף 2026-08-27)**
- קונקטור DV360 קיים (`lib/performance/connectors/dv360.ts`): pause + setBudget ברמת line-item. הקנייה עצמה מופעלת מול **Deal ID** מהפאבלישר (PMP/PG/Preferred) דרך ה‑Managed pipeline, לא spec self-serve.
- DV360 **דורש חשבון (seat)** שנפתח דרך שותף מוסמך של Google. מסך החיבורים (`ChannelConnections`) מציג הודעת "צריך לפתוח חשבון" בכרטיס DV360, והערוץ נשאר לא פעיל עד שמחוברים Advertiser ID + Access Token.
- `fetchInsights` מחזיר null בשלב זה (דיווח Bid Manager אסינכרוני, יחובר בהמשך).

**לא-מטרות (בשלב הזה)**
- דיווח live מ‑DV360 (Bid Manager async) — יחובר בהמשך; בינתיים pacing מנוהל ידנית ב‑Managed.
- רכש מדיה מסורתי לא-דיגיטלי (טלוויזיה/רדיו/שילוט) — מעקב בלבד ב‑Managed, בלי אוטומציה.
- מודל attribution חדש — נשען על ה‑attribution הקיים ב‑OPS.

---

## 3. Reuse-before-build — מה כבר קיים ב‑OPS

עיקרון: המודול יושב **מעל** רכיבים קיימים, לא מחליף אותם.

| יכולת | קיים ב | מצב |
|-------|--------|-----|
| Kill & Scale loop | `lib/budget-optimizer.ts`, `api/cron/budget-optimizer` | ✅ עובד (Meta CTR-based) |
| Fatigue detection | `lib/performance/fatigue.ts`, `api/performance/fatigue` | ✅ קיים |
| Performance engine | `lib/performance/` (engine, scoring, report, notify) | ✅ קיים |
| **AdConnector SPI אחיד** | `lib/performance/connectors/types.ts` | ✅ pause/setBudget/uploadCreative/fetchInsights/createCampaign |
| קונקטורים | Meta, Google, TikTok, **Taboola, Outbrain**, LinkedIn, Microsoft | ✅ קיימים (`docs/OPS-CONNECTORS.md`) |
| OAuth פלטפורמות | `api/oauth/[platform]` | ✅ גנרי |
| Autonomy Switch | `app/[locale]/autonomy`, `lib/autonomy` | ✅ advisor/approve/autopilot |
| Multi-tenant + סוכנויות | `migration-v22-agency-hierarchy.sql`, workspaces/memberships/client_profiles | ✅ קיים |
| יצירת creatives + voice | `lib/content-agent.ts`, `lib/performance/voice.ts`, `campaign-builder.ts` | ✅ קיים |
| Agent runtime | `lib/agentos`, `lib/agents` | ✅ קיים |
| Channel connections | `channel_connections.config` per workspace | ✅ קיים |

**מסקנה:** המסלול Auto בנוי בערך 70%. הפער האמיתי הוא המסלול Managed + Planner + cockpit מאחד.

---

## 4. מה בונים (הפער)

1. **מסלול Managed** — טבלאות + UI + לוגיקה ל‑pipeline דילים ישירים מול פאבלישרים. חדש לגמרי, זה הבידול.
2. **Media Planner agent** — מפצל יעד+תקציב בין performance/פרימיום/נייטיב.
3. **Media Buying cockpit** — משטח `/[locale]/media-buying` שמאחד את שני המסלולים, במקום `/media` (ספריית assets) ו‑`/performance` הנפרדים.
4. **DV360 connector** — Phase מאוחר, להפוך דיל Managed לאוטומטי דרך Deal ID.

---

## 5. ארכיטקטורה — צוות הסוכנים

בקו ה-intra-department architecture (Researcher/Maker/Critic/Orchestrator), על גבי `lib/agentos`:

| סוכן | תפקיד | נשען על |
|------|-------|---------|
| **Planner** | יעד+תקציב → media plan (פיצול ערוצים, KPI יעד לכל ערוץ) | חדש + insights קיים |
| **Buyer** | מבצע: Auto דרך AdConnector.createCampaign, Managed דרך pipeline דילים | connectors קיימים + pipeline חדש |
| **Optimizer** | הלולאה: fatigue + kill&scale + CPA/ROAS alerts + pacing מול IO | `budget-optimizer` + `fatigue` קיימים |
| **Reporter** | דיווח מאוחד "החלטה קודם" על פני כל הערוצים | `performance/report` קיים |

כל פעולה עוברת דרך Autonomy Switch: **advisor** (ממליץ בלבד) → **approve** (ממתין לאישור) → **autopilot** (מבצע לבד בתוך guardrails).

---

## 6. מודל דאטה (מיגרציה חדשה, idempotent)

כל הטבלאות עם `workspace_id` + RLS בקו הטבלאות הקיימות. `migration-v23-media-buying.sql`.

```
media_plans
  id, workspace_id, client_id, name, objective (awareness|traffic|leads|sales),
  total_budget, currency, start_date, end_date, status, created_by

media_buys
  id, workspace_id, plan_id, client_id,
  lane (auto|managed), channel (meta|google|tiktok|taboola|outbrain|ynet|walla|sport5|...),
  status (draft|pending_approval|live|paused|ended),
  budget, target_kpi (jsonb: {metric, value}),
  autonomy_mode (advisor|approve|autopilot),
  external_ref (jsonb: campaignId/adsetId or dealId), created_by

publisher_deals            -- הצד ה-Managed בלבד
  id, workspace_id, buy_id, publisher, contact_name, contact_email,
  deal_type (io|pmp|pg|preferred), unit (cpm|cpd|fixed),
  rate, guaranteed_impressions, inventory (jsonb: formats/placements),
  deadline, io_document_url, invoice_status (none|received|paid), notes

buy_metrics
  id, workspace_id, buy_id, date,
  impressions, clicks, spend, conversions,      -- בפועל
  promised_impressions,                          -- Managed: מול הבטחה
  source (connector|manual|csv)

buy_creatives              -- קישור creatives לקנייה
  id, workspace_id, buy_id, asset_id (→ media library הקיים),
  variant_label, status (testing|winner|paused), voice_profile_id
```

---

## 7. פירוט פיצ'רים לפי Phase (שני המסלולים במקביל)

### Phase 1 (במקביל)

**מסלול Managed — Publisher Deal Pipeline**
- לוח דילים (kanban: הצעה → מו"מ → אושר → live → הסתיים) לכל פאבלישר.
- כרטיס דיל: פאבלישר, פורמט, CPM/מחיר, נפח מובטח, deadline, מסמך IO, איש קשר.
- מעקב **הופעות בפועל מול הבטחה** (pacing) עם התראה על under-delivery.
- הזנת מדדים ידנית / CSV import.
- מעקב חשבוניות (received/paid).
- דוח לקוח מאוחד (משתמש ב‑`performance/report`).

**מסלול Auto — Cockpit על הקיים**
- איחוד `budget-optimizer` + `fatigue` + `performance/metrics` למשטח media buyer אחד.
- טבלת buys חיה: channel, spend, ROAS, frequency, סטטוס fatigue, מצב autonomy.
- כפתורי pause/scale ידניים (דרך AdConnector הקיים) + הצגת מה ה‑autopilot עשה.
- alert CPA spike ב‑1.5x break-even (חדש, על גבי `performance/notify`).

### Phase 2
- **Media Planner agent** מלא — פיצול תקציב מומלץ בין ערוצים לפי יעד.
- יצירת creatives מחוברת ל‑voice: variant generation + A/B, סימון winner ב‑`buy_creatives`.
- דיווח שבועי אוטומטי (cron) לכל לקוח.

### Phase 3
- **DV360** — הקונקטור כבר קיים (pause+budget). נשאר: חיבור Bid Manager insights + זרימת הפעלת Deal ID מ‑`publisher_deals` (הפיכת דיל Managed לאוטומטי).
- אופטימיזציה חוצת‑ערוצים (הזזת תקציב בין Auto ל‑Managed).
- guardrails מתקדמים ל‑autopilot.

---

## 8. משטחי UI

- `/[locale]/media-buying` — cockpit ראשי (שני המסלולים, מסונן לפי לקוח).
- `/[locale]/media-buying/plans` — media plans.
- `/[locale]/media-buying/deals` — pipeline דילים (Managed).
- `/[locale]/media-buying/[buyId]` — כרטיס קנייה: מדדים, creatives, autonomy, timeline.
- RTL מלא, עברית, לפי checklist ה‑UX של HELIX (heuristics, loading/error/empty, mobile 44px, a11y).
- קידוד צבע לפי lane: Auto (טורקיז), Managed (זהב), Native (אלמוג) — עקבי עם דוח השוק.

---

## 9. קונקטורים — כיסוי ופער

קיים (SPI אחיד, `docs/OPS-CONNECTORS.md`): Meta, Google, TikTok, Taboola, Outbrain, LinkedIn, Microsoft, **DV360** (חדש — pause+budget ברמת line-item, דורש seat + הודעת פתיחת חשבון ב‑UI).

פאבלישרים ישראליים בדיל ישיר אינם קונקטור — הם pipeline ידני (Managed) עד שממופים ל‑Deal ID, ואז DV360 מבצע אותם אוטומטית. `fetchInsights` ל‑DV360 (Bid Manager) יחובר בהמשך.

---

## 10. מדדי הצלחה

- זמן להשקת קמפיין רב‑ערוצי (יעד: מתחת ל‑30 דק' מ‑brief ל‑live ב‑Auto).
- % קניות ב‑autopilot בלי התערבות ידנית.
- under-delivery שנתפס לפני סוף הדיל (Managed pacing).
- fatigue שנתפס 4–7 ימים לפני נפילת ROAS (בנצ'מרק השוק).
- לקוחות פעילים לכל workspace (multi-tenant adoption).

---

## 11. סיכונים

- **דיל פאבלישר ידני = הזנה ידנית.** סיכון לדאטה חלקית. מיטיגציה: CSV import + תזכורות pacing.
- **autopilot על כסף אמיתי.** מיטיגציה: guardrails קשיחים (תקרת scale <20%, CPA cap), ברירת מחדל advisor.
- **OAuth לחשבונות לקוח.** קיים ב‑`api/oauth`, אבל דורש הרשאות פרסום לכל פלטפורמה.
- **RLS multi-tenant.** כל טבלה חדשה חייבת policies מדוקדקות — בדיקה לפי supabase-postgres-best-practices.

---

## 12. אבני דרך

1. מיגרציה `v23-media-buying` + RLS.
2. Managed pipeline UI + CRUD דילים + pacing.
3. Auto cockpit מאחד (חיבור budget-optimizer/fatigue הקיימים).
4. CPA alert + דוח לקוח מאוחד.
5. Planner agent + creatives+voice (Phase 2).
6. DV360 + cross-lane optimize (Phase 3).

---

## נספח: מקורות מחקר השוק
AdStellar, Superscale, Get-Ryze, Adlibrary (תמחור), Times of Israel (Taboola/Outbrain IL), e-dialog (DV360), Superside (creatives), מוקד הפרסום, יוניון מדיה.
