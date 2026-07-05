-- ============================================================
-- TANAWIN KITCHEN — team settings (key/value)
-- Run once in the Supabase SQL Editor. Kitchen table only.
-- ============================================================
create table if not exists kitchen_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

-- Same anon-key model as the rest of Kitchen.
alter table kitchen_settings disable row level security;

-- Default: staff restocks require Lexi's approval (toggle it on in Settings).
insert into kitchen_settings (key, value) values
  ('staff_direct_restock', 'false'::jsonb)
on conflict do nothing;
