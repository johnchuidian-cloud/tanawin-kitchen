-- ============================================================
-- TANAWIN KITCHEN — recipe media: YouTube video, photo, links
-- The photo doubles as the future menu item's image (single
-- source of truth — the menu app reads it via recipe_id).
-- Run once in the Supabase SQL Editor. Kitchen table only.
-- ============================================================
alter table recipes add column if not exists video_url text;
alter table recipes add column if not exists image_url text;
alter table recipes add column if not exists links jsonb default '[]'::jsonb;
