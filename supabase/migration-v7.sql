-- ============================================================
-- HELIX STAGE — Migration v7
-- פרופיל מורחב (bio + אתר) + סרטון למוצר
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- פרופיל: תקציר אישי + אתר
alter table public.profiles
  add column if not exists bio text,
  add column if not exists website_url text;

-- מוצר: קישור לסרטון (YouTube / Vimeo / MP4)
alter table public.products
  add column if not exists video_url text;
