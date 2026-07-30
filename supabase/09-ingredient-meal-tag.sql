-- ============================================================
-- TANAWIN KITCHEN — meal tag on stock items
-- Which meal an ingredient is mainly used for:
-- breakfast | lunch_dinner | both (null = not set / all-purpose).
-- Loose grouping only — nothing enforces it.
-- Run once in the Supabase SQL Editor (EXPENSES project).
-- ============================================================
alter table ingredients add column if not exists meal_tag text;
