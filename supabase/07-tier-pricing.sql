-- ============================================================
-- TANAWIN KITCHEN — per-size costing & hand-set prices
-- Retires the "cost ×3" auto-price. `tiers` holds each size's
-- cost and its HAND-SET menu price (mirroring the Tanawin Menu
-- app, the authority on final prices/sizes). `cost_lines` holds
-- Lexi's costing grid (peso per line per size, incl. gas).
-- cost_per_serving / menu_price become legacy (kept, unused).
-- Run once in the Supabase SQL Editor. Kitchen table only.
-- ============================================================
alter table recipes add column if not exists tiers      jsonb default '[]'::jsonb;
alter table recipes add column if not exists cost_lines jsonb default '[]'::jsonb;
