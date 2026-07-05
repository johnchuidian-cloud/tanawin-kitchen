-- ============================================================
-- TANAWIN KITCHEN — enable Undo for restocks
-- Adds a "before" snapshot + an undone marker to purchases.
-- Run once in the Supabase SQL Editor. Kitchen table only.
-- ============================================================
alter table purchases add column if not exists prev_quantity      numeric;
alter table purchases add column if not exists prev_cost_per_unit numeric;
alter table purchases add column if not exists undone_at          timestamptz;
