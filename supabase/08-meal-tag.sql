-- ============================================================
-- TANAWIN KITCHEN — meal tag on recipes
-- breakfast | lunch_dinner | both (null = not set yet).
-- Run once in the Supabase SQL Editor (EXPENSES project).
-- ============================================================
alter table recipes add column if not exists meal_tag text;
