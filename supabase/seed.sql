-- Starter menu for a fresh deployment.
--
-- Without this, a newly migrated database has no categories, no items, and no
-- campaign — the terminal renders an empty grid with no way in, because every
-- creation flow in the UI assumes a campaign already exists to attach things
-- to. This gets a new tenant to a usable screen, and gives them a worked
-- example of how categories/items/modifiers/campaigns fit together before they
-- replace it with a real menu.
--
-- WHEN IT RUNS
--   Automatically on `supabase db reset` against a local stack (config.toml's
--   [db.seed] points at this file). It is NOT applied by `supabase db push`,
--   so it will never touch a hosted project by accident.
--
--   To seed a fresh hosted project, paste this into the Supabase dashboard's
--   SQL editor once (Dashboard → SQL Editor → New query). Run it as a single
--   query — the temporary table below lives for the length of one session.
--
-- SAFETY
--   Every statement is idempotent: it only inserts rows that are missing by
--   name, so re-running adds nothing and changes no prices, and running it
--   against a project that already has a real menu is a no-op rather than a
--   clobber. It never touches orders.
--
-- The menu itself is a deliberately generic coffee-and-bagels counter. Replace
-- it with your own; nothing in the app depends on these particular rows.

-- Categories — these become the kitchen's queues/swimlanes.
--
-- Targetless `on conflict` because `name` and `slug` are each independently
-- unique and either could collide. The inserts below can't use it: their
-- tables have no unique constraint to conflict on, so they test with
-- `where not exists` instead.
insert into public.categories (name, slug, display_order) values
  ('Bagels',   'bagels',   1),
  ('Drinks',   'drinks',   2),
  ('Pastries', 'pastries', 3)
on conflict do nothing;

-- Modifiers — the shared catalog. Attached to items further down.
insert into public.modifiers (name, description, price_delta)
select v.name, v.description, v.price_delta
from (values
  ('Toasted'::text, 'Run through the toaster'::text, 0.00),
  ('Extra Cheese',  null,                            1.00),
  ('No Butter',     null,                            0.00),
  ('Extra Shot',    'One more espresso shot',        0.75),
  ('Oat Milk',      null,                            0.60),
  ('Iced',          'Served over ice',               0.00)
) as v(name, description, price_delta)
where not exists (
  select 1 from public.modifiers m where m.name = v.name
);

-- The starter items, held in one place because two statements need them: the
-- insert into public.items, and the campaign link at the bottom. Listing them
-- twice would mean a ninth item could be added to the menu and silently never
-- reach the campaign — invisible in the terminal, which is the exact failure
-- this file exists to prevent.
create temporary table seed_items (
  category_slug  text,
  category_name  text,
  name           text,
  description    text,
  base_price     numeric(10,2),
  no_prep_needed boolean
);

-- Both the category slug and its name are carried so the join below can match
-- either. The categories insert above skips on *any* unique collision, so a
-- project that already has a 'Bagels' under a different slug keeps its own row
-- — and matching on slug alone would then quietly drop every bagel here.
--
-- `no_prep_needed` marks things handed over straight from the counter: they're
-- created already 'done' and never appear on the kitchen display.
insert into seed_items values
  ('bagels',   'Bagels',   'Plain Bagel',        'Fresh-baked, choice of spread', 3.50, false),
  ('bagels',   'Bagels',   'Everything Bagel',   'Sesame, poppy, garlic, onion',  3.75, false),
  ('bagels',   'Bagels',   'Bacon Egg & Cheese', 'On your choice of bagel',       7.50, false),
  ('drinks',   'Drinks',   'Drip Coffee',        null,                            2.75, false),
  ('drinks',   'Drinks',   'Latte',              'Double shot, steamed milk',     4.50, false),
  ('drinks',   'Drinks',   'Orange Juice',       'Bottled',                       3.00, true),
  ('pastries', 'Pastries', 'Butter Croissant',   null,                            3.25, true),
  ('pastries', 'Pastries', 'Blueberry Muffin',   null,                            3.25, true);

insert into public.items (category_id, name, description, base_price, no_prep_needed)
select c.id, s.name, s.description, s.base_price, s.no_prep_needed
from seed_items s
join public.categories c
  on c.slug = s.category_slug or lower(c.name) = lower(s.category_name)
where not exists (
  select 1 from public.items i where i.name = s.name
);

-- Which modifiers each item offers at the terminal.
insert into public.item_modifiers (item_id, modifier_id)
select i.id, m.id
from (values
  ('Plain Bagel'::text,  'Toasted'::text),
  ('Plain Bagel',        'No Butter'),
  ('Everything Bagel',   'Toasted'),
  ('Everything Bagel',   'No Butter'),
  ('Bacon Egg & Cheese', 'Toasted'),
  ('Bacon Egg & Cheese', 'Extra Cheese'),
  ('Drip Coffee',        'Iced'),
  ('Drip Coffee',        'Oat Milk'),
  ('Latte',              'Iced'),
  ('Latte',              'Oat Milk'),
  ('Latte',              'Extra Shot')
) as v(item_name, modifier_name)
join public.items i on i.name = v.item_name
join public.modifiers m on m.name = v.modifier_name
on conflict (item_id, modifier_id) do nothing;

-- An open campaign, so the terminal has somewhere to put orders on first load.
-- Campaigns are how this app scopes a menu to an event or a service period.
insert into public.campaigns (name, starts_at, is_active)
select 'Opening Day', now(), true
where not exists (
  select 1 from public.campaigns where name = 'Opening Day'
);

-- Put the starter menu on that campaign. Stock is left NULL (untracked); set a
-- number per item in the terminal's "Manage Items" screen to have the app count
-- units down and mark things sold out.
--
-- Only runs while the campaign is still empty. `on conflict do nothing` alone
-- wouldn't be enough: it suppresses duplicate rows, but not the re-insertion of
-- a row the operator deleted, so a re-run would silently put 'Orange Juice'
-- back on the terminal mid-service. Once anything has been linked or unlinked,
-- the campaign is the operator's and the seed leaves it alone.
insert into public.campaign_items (campaign_id, item_id)
select c.id, i.id
from public.campaigns c
join public.items i on i.name in (select name from seed_items)
where c.name = 'Opening Day'
  and not exists (
    select 1 from public.campaign_items ci where ci.campaign_id = c.id
  )
on conflict (campaign_id, item_id) do nothing;

drop table seed_items;
