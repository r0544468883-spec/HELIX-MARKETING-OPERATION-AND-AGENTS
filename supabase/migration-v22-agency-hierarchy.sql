-- migration-v22 — Agency → Client hierarchy (white-label multi-tenancy)
-- A parent workspace (the AGENCY) owns child workspaces (its CLIENTS).
-- The agency's admins see/manage every client; each client sees only itself.
-- Run once in the Supabase SQL editor, AFTER v21. Same file mirrors to helix-sdr-bdr-bot.
--
-- Design: instead of teaching every table about agencies, we widen ONE function —
-- is_member(ws) — so agency admins inherit access to their clients' rows. Every RLS
-- policy that already calls is_member(workspace_id) (requests, creatives, performance…)
-- picks this up automatically. No per-table changes.

-- ── 1) Self-referential parent link (the agency → client edge) ──
alter table workspaces
  add column if not exists parent_workspace_id uuid references workspaces(id) on delete set null;
create index if not exists workspaces_parent_idx on workspaces(parent_workspace_id);

-- ── 2) New role: agency_admin (a seat in the agency/parent workspace) ──
alter table memberships drop constraint if exists memberships_role_check;
alter table memberships add constraint memberships_role_check
  check (role in ('admin','member','approver','guest','agency_admin'));

-- ── 3) Is the current user an agency admin OVER this workspace? ──
--    True when the caller is an admin/agency_admin of THIS workspace's parent.
--    Queries base tables directly (not is_member) → no recursion.
create or replace function is_agency_admin(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from workspaces w
    join memberships m on m.workspace_id = w.parent_workspace_id
    where w.id = ws
      and m.user_id = auth.uid()
      and m.role in ('admin','agency_admin')
  );
$$;

-- ── 4) Widen is_member: direct member OR agency admin of the parent ──
--    This single change grants agency admins access to every child-workspace row
--    across all tables whose RLS uses is_member(workspace_id).
create or replace function is_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from memberships m where m.workspace_id = ws and m.user_id = auth.uid()
  ) or is_agency_admin(ws);
$$;

-- ── 5) Create a client workspace under an agency (atomic, authorized) ──
--    Only an admin/agency_admin of the agency may add a client beneath it.
create or replace function create_client_workspace(agency_id uuid, ws_name text)
returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  if not exists (
    select 1 from memberships m
    where m.workspace_id = agency_id and m.user_id = auth.uid()
      and m.role in ('admin','agency_admin')
  ) then
    raise exception 'not an agency admin of %', agency_id;
  end if;
  insert into workspaces (name, created_by, parent_workspace_id)
    values (ws_name, auth.uid(), agency_id) returning id into new_id;
  insert into memberships (workspace_id, user_id, role)
    values (new_id, auth.uid(), 'agency_admin');
  return new_id;
end; $$;

-- ── 6) Resolve effective branding: child inherits the agency's brand unless it set its own ──
--    Used by white-label reports / Nav / login so a client page shows the AGENCY's brand.
create or replace function resolve_branding(ws uuid)
returns jsonb language sql security definer stable as $$
  select coalesce(
    nullif(child.branding, '{}'::jsonb),
    parent.branding,
    '{}'::jsonb
  )
  from workspaces child
  left join workspaces parent on parent.id = child.parent_workspace_id
  where child.id = ws;
$$;
