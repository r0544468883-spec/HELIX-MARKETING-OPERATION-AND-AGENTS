-- ============================================================
-- HELIX STAGE — Migration v5
-- שכבת פורום: תגובות והצבעות על פוסטים + נושאים (השראה מ-Indie Hackers)
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1) מונים + נושא על פוסטים
alter table public.posts
  add column if not exists votes_count integer not null default 0,
  add column if not exists comments_count integer not null default 0,
  add column if not exists topic text;

-- 2) תגובות (דיון מתחת לפוסט)
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;
do $$ begin
  create policy "post_comments are public" on public.post_comments for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users insert own post_comments" on public.post_comments for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own post_comments" on public.post_comments for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 3) הצבעות על פוסטים
create table if not exists public.post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_votes enable row level security;
do $$ begin
  create policy "post_votes are public" on public.post_votes for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users insert own post_votes" on public.post_votes for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own post_votes" on public.post_votes for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 4) טריגרים לספירה
create or replace function public.bump_post_votes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set votes_count = votes_count + 1 where id = new.post_id;
    return new;
  else
    update public.posts set votes_count = greatest(votes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end; $$;

drop trigger if exists on_post_vote_change on public.post_votes;
create trigger on_post_vote_change
  after insert or delete on public.post_votes
  for each row execute function public.bump_post_votes();

create or replace function public.bump_post_comments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
    return new;
  else
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end; $$;

drop trigger if exists on_post_comment_change on public.post_comments;
create trigger on_post_comment_change
  after insert or delete on public.post_comments
  for each row execute function public.bump_post_comments();
