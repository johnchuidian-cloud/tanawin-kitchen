-- ============================================================
-- TANAWIN KITCHEN — alternative names for stock items
-- Lets one item answer to several spellings/languages, e.g.
-- Onion also known as "sibuyas". The app learns these as people
-- type: pick "use the existing item" and the spelling is saved.
-- Keeps the list from growing duplicates.
-- Run once in the Supabase SQL Editor (EXPENSES project).
-- ============================================================
alter table ingredients add column if not exists aliases jsonb default '[]'::jsonb;
