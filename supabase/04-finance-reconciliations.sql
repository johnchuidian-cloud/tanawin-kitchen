-- ============================================================
-- TANAWIN KITCHEN — track which Finance purchases have been handled
-- Lets Kitchen import from Finance without ever importing the same
-- purchase twice. Kitchen table only — Finance is never written to.
-- Run once in the Supabase SQL Editor.
-- ============================================================
create table if not exists finance_reconciliations (
  finance_entry_id text primary key,          -- id of the row in Finance's entries table
  status           text not null,             -- 'synced' or 'dismissed'
  ingredient_id    uuid,                       -- Kitchen ingredient it was imported as (if synced)
  handled_by       uuid references kitchen_users(id) on delete set null,
  handled_at       timestamptz default now()
);

alter table finance_reconciliations disable row level security;
