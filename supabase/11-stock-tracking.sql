-- ============================================================
-- TANAWIN KITCHEN — stock movement history
--
-- One row every time an item's on-hand quantity changes, whatever
-- the cause. `ingredients.quantity` stays the live number; this is
-- the history behind it, so the app can answer:
--   - how much of each item we had, day by day
--   - when it was bought / replenished
--   - when it was used, and by which dish
--   - how long since anyone touched it
--
-- kind:
--   add        item created with starting stock
--   purchase   restock (manual or pulled from the Expenses app)
--   count      physical recount — the observed truth
--   use        deducted because a dish was cooked
--   waste      spoilage/loss logged (informational: waste does NOT
--              move on-hand stock, the next count absorbs it)
--   undo       a restock was reversed
--
-- delta      signed change (+2.5 / -400). Null when unknowable.
-- qty_after  on-hand once this movement was applied.
--
-- For kind='count', delta is counted-minus-expected — i.e. the gap
-- between what the app thought was there and what actually was.
-- Once dishes are being logged, that gap is the unexplained loss
-- (spoilage, spillage, unlogged use) rather than usage itself.
--
-- Run once in the Supabase SQL Editor (EXPENSES project).
-- ============================================================

create table if not exists stock_movements (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  occurred_at   timestamptz not null default now(),
  kind          text not null,
  delta         numeric,
  qty_after     numeric,
  actor         uuid references kitchen_users(id),
  recipe_id     uuid references recipes(id) on delete set null,
  servings      numeric,
  source_table  text,
  source_id     text,
  note          text
);

-- The two reads the app actually makes: one item's timeline, and
-- everything that happened recently across all items.
create index if not exists stock_movements_item_time_idx
  on stock_movements (ingredient_id, occurred_at desc);
create index if not exists stock_movements_time_idx
  on stock_movements (occurred_at desc);

-- Stops a double-tap or a re-run of the backfill creating the same
-- movement twice (rows with no source are unconstrained).
create unique index if not exists stock_movements_source_idx
  on stock_movements (source_table, source_id)
  where source_table is not null and source_id is not null;

-- "When was each item last counted / last restocked?" — one row per
-- item per kind, newest only. Without this the app would have to pull
-- thousands of movements to the phone just to work out an age.
create or replace view stock_item_status as
  select distinct on (ingredient_id, kind)
    ingredient_id, kind, occurred_at, qty_after
  from stock_movements
  order by ingredient_id, kind, occurred_at desc;

-- Roughly how many days this item keeps once delivered. Optional —
-- when it's set the app shows it as plain information next to the
-- item's age. It never flags or blocks anything.
alter table ingredients add column if not exists shelf_life_days integer;
