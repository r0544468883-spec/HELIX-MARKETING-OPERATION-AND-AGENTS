-- HELIX OPS (Marketing Ops Hub) — MVP schema
-- Run once in Supabase SQL editor. Covers: workspaces, memberships, requests + RLS.

create extension if not exists "pgcrypto";

-- ---------- Workspaces (client/brand). plan gates features. ----------
create table if not exists workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  plan       text not null default 'solo' check (plan in ('solo','business','agency')),
  branding   jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ---------- Memberships (user <-> workspace + role) ----------
create table if not exists memberships (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  role         text not null default 'admin' check (role in ('admin','member','approver','guest')),
  created_at   timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- ---------- Requests (creative request intake — the MVP wedge) ----------
create table if not exists requests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  title        text not null,
  brief        text,
  channels     text[] default '{}',
  due_date     date,
  priority     text default 'normal' check (priority in ('low','normal','high','urgent')),
  status       text not null default 'new' check (status in ('new','in_progress','review','approved','done')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists requests_workspace_idx on requests(workspace_id, status);

-- ---------- helpers ----------
create or replace function is_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from memberships m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

-- atomic: create a workspace AND make the creator its admin (avoids RLS chicken-and-egg)
create or replace function create_workspace(ws_name text)
returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  insert into workspaces (name, created_by) values (ws_name, auth.uid()) returning id into new_id;
  insert into memberships (workspace_id, user_id, role) values (new_id, auth.uid(), 'admin');
  return new_id;
end; $$;

-- ---------- RLS ----------
alter table workspaces  enable row level security;
alter table memberships enable row level security;
alter table requests    enable row level security;

drop policy if exists ws_select on workspaces;
create policy ws_select on workspaces for select using (is_member(id));
drop policy if exists ws_insert on workspaces;
create policy ws_insert on workspaces for insert with check (auth.uid() = created_by);

drop policy if exists mem_select on memberships;
create policy mem_select on memberships for select using (user_id = auth.uid() or is_member(workspace_id));
drop policy if exists mem_insert on memberships;
create policy mem_insert on memberships for insert with check (user_id = auth.uid());

drop policy if exists req_select on requests;
create policy req_select on requests for select using (is_member(workspace_id));
drop policy if exists req_insert on requests;
create policy req_insert on requests for insert with check (is_member(workspace_id) and requester_id = auth.uid());
drop policy if exists req_update on requests;
create policy req_update on requests for update using (is_member(workspace_id));
