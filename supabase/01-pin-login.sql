-- ============================================================
-- TANAWIN KITCHEN — switch to PIN login (mirrors Tanawin Finance)
-- Run once in the Supabase SQL Editor. Touches Kitchen tables ONLY.
-- Safe to re-run.
-- ============================================================

-- 1) Users table for PIN login (name + role + 4-digit PIN).
create table if not exists kitchen_users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null default 'staff' check (role in ('admin','staff','guest')),
  pin        text not null,
  created_at timestamptz default now()
);

-- 2) Starter accounts. Change the PINs later (in-app or here).
insert into kitchen_users (name, role, pin) values
  ('Lexi',  'admin', '1234'),
  ('Maria', 'staff', '2345'),
  ('Jun',   'staff', '3456'),
  ('Guest', 'guest', '0000')
on conflict do nothing;

-- 3) PIN login uses the public/anon key (no Supabase Auth), so relax RLS on
--    the Kitchen tables — same model as Tanawin Finance. (No Finance tables
--    are referenced here.)
alter table kitchen_users      disable row level security;
alter table suppliers          disable row level security;
alter table ingredients        disable row level security;
alter table recipes            disable row level security;
alter table recipe_ingredients disable row level security;
alter table menu_items         disable row level security;
alter table purchases          disable row level security;
alter table waste_log          disable row level security;
alter table approvals          disable row level security;
alter table activity_log       disable row level security;
-- profiles is left in place but unused now that login is PIN-based.

-- 4) The "who did this" columns originally pointed at profiles (Supabase-Auth
--    ids). Repoint them at kitchen_users so logs and approvals can name the
--    actual person.
alter table purchases    drop constraint if exists purchases_recorded_by_fkey;
alter table purchases    add  constraint purchases_recorded_by_fkey
  foreign key (recorded_by) references kitchen_users(id) on delete set null;

alter table waste_log    drop constraint if exists waste_log_logged_by_fkey;
alter table waste_log    add  constraint waste_log_logged_by_fkey
  foreign key (logged_by) references kitchen_users(id) on delete set null;

alter table approvals    drop constraint if exists approvals_requested_by_fkey;
alter table approvals    add  constraint approvals_requested_by_fkey
  foreign key (requested_by) references kitchen_users(id) on delete set null;

alter table approvals    drop constraint if exists approvals_resolved_by_fkey;
alter table approvals    add  constraint approvals_resolved_by_fkey
  foreign key (resolved_by) references kitchen_users(id) on delete set null;

alter table activity_log drop constraint if exists activity_log_actor_fkey;
alter table activity_log add  constraint activity_log_actor_fkey
  foreign key (actor) references kitchen_users(id) on delete set null;

-- ============================================================
-- DONE. PIN login is ready: Lexi (admin), Maria & Jun (staff), Guest.
-- ============================================================
