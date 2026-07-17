-- ============================================================
-- HELIX STAGE — Migration v4
-- אינדקס אלטרנטיבות: "חלופה ישראלית ל-X" (השראה מ-AlternativeTo)
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- רשימת הכלים הגלובליים שהמוצר מהווה חלופה ישראלית להם (למשל: {'Notion','Asana'})
alter table public.products
  add column if not exists alternative_to text[] not null default '{}';
