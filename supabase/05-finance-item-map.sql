-- ============================================================
-- TANAWIN KITCHEN — remembered Finance item -> ingredient matches
-- Once "Repolyo" is imported as an ingredient, future Repolyo rows
-- come pre-matched; ingredient_id NULL means "not an ingredient"
-- (auto-skip). Kitchen table only. Run once in the SQL Editor.
-- ============================================================
create table if not exists finance_item_map (
  item_key      text primary key,             -- normalized item name, e.g. 'silipula'
  ingredient_id uuid references ingredients(id) on delete cascade,  -- null = not an ingredient
  created_by    uuid references kitchen_users(id) on delete set null,
  updated_at    timestamptz default now()
);

alter table finance_item_map disable row level security;
