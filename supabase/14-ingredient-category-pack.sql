-- ============================================================
-- TANAWIN KITCHEN — food category + pack size on each stock item
--
-- category              Groups the Inventory list (Proteins, Produce,
--                       Dry Goods…). Plain text: a custom category is just
--                       a new name typed in the app, with no lookup table
--                       to keep in sync.
-- pack_size, pack_unit  How much is in one counted unit — 250 + 'g' for a
--                       250 g pack. A real number this time, unlike the
--                       free-text note from migration 13, because the
--                       list's Unit column and the CSV export need it on
--                       its own. The note stays for the messy cases a
--                       number can't say ("big pack ~1kg, small ~400g").
--
-- Also fills both in for the items that already exist:
--   * pack sizes are copied from notes written exactly as "1 pack = 300 g"
--     (the note itself is left as it is);
--   * each item gets a suggested category by name. Only where it has none,
--     so running this again never undoes a correction made in the app.
--     Wrong guesses are fixed per item: Inventory → Edit → Category.
--
-- Safe to re-run. Run once in the Supabase SQL Editor (EXPENSES project).
-- ============================================================
alter table ingredients add column if not exists category text;
alter table ingredients add column if not exists pack_size numeric;
alter table ingredients add column if not exists pack_unit text;

-- Pack sizes from notes like "1 pack = 300 g". Only items counted in
-- containers; an item counted in kg doesn't need one.
-- \s{0,} is \s* written without an asterisk: this SQL is sent to the owner
-- by chat, and WhatsApp reads asterisks as bold and drops them.
with parsed as (
  select id, regexp_match(notes, '^\s{0,}1\s{0,}[a-z]+\s{0,}=\s{0,}([0-9]+(?:\.[0-9]+)?)\s{0,}(kg|g|ml|l)\s{0,}$', 'i') as m
  from ingredients
  where pack_size is null and notes is not null and unit not in ('kg', 'g', 'L', 'ml')
)
update ingredients as i
set pack_size = p.m[1]::numeric,
    pack_unit = case lower(p.m[2]) when 'l' then 'L' else lower(p.m[2]) end
from parsed as p
where i.id = p.id and p.m is not null;

-- Suggested categories (the 82 items as of 2026-11-11).
update ingredients set category = 'Proteins' where category is null and name in ('Bacon', 'Bangus (sinigang)', 'Beef', 'Beef (bulalo)', 'Beef tapa', 'Chicken', 'Chicken (native)', 'Chicken longganisa', 'Chicken tocino', 'Hotdog', 'Kapak daing', 'Kapak tinapa', 'Pork (sisig)', 'Salmon', 'Shrimp', 'Squid', 'Tahong', 'Tinapa galunggong', 'Tuyo');
update ingredients set category = 'Produce' where category is null and name in ('Beans (string)', 'Bell pepper', 'Cabbage', 'Calamansi', 'Carrots', 'Cauliflower', 'Celery', 'Corn', 'Cucumber', 'Eggplant', 'Fruit (assorted)', 'Garlic', 'Ginger', 'Kang Kong', 'Leaks', 'Okra', 'Onion', 'Pechay', 'Potatoes', 'Raddish', 'Sampaloc', 'Sayote', 'Sili panigang', 'Sitsaro', 'Tomato', 'Turmeric (luyang dilaw)', 'Vegetables (assorted)');
update ingredients set category = 'Dairy & Eggs' where category is null and name in ('Butter', 'Cream cheese', 'Egg', 'Milk (pasteurized)');
update ingredients set category = 'Dry Goods' where category is null and name in ('All purpose flour', 'Bigas', 'Black pepper', 'Bread (loaf / sliced)', 'Corned beef', 'Pancake mix', 'Pancit (bihon or canton)', 'Pandesal', 'Salt', 'Spam luncheon meat', 'Sugar', 'Tuna');
update ingredients set category = 'Condiments & Sauces' where category is null and name in ('Alamang', 'Chili sauce', 'Ketchup banana', 'Ketchup tomato', 'Knorr cub', 'Mayonnaise', 'Oil', 'Oyster sauce', 'Pancake syrup', 'Patis / fish sauce', 'Peanut butter', 'Sesame oil', 'Soy sauce', 'Ube jam', 'Vinegar');
update ingredients set category = 'Beverages' where category is null and name in ('Chocolate tableya', 'Coffee', 'Coffee mate', 'Milo', 'Tea lipton');
