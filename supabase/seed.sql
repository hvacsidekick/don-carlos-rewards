-- Phase 2 · Seed — rewards_config + Don Carlos menu
-- Idempotent: safe to re-run (stable slugs + ON CONFLICT). PLANNING_TASK §menu
-- (Tacos, burritos, quesadillas, tortas, breakfast burritos; $2–$12 range).

-- ── rewards_config (confirm the singleton values; row created by migration 08) ─
insert into public.rewards_config (id, points_per_dollar, redeem_threshold, redeem_value_cents, stamps_per_card)
values (1, 1, 100, 1000, 10)
on conflict (id) do update set
  points_per_dollar  = excluded.points_per_dollar,
  redeem_threshold   = excluded.redeem_threshold,
  redeem_value_cents = excluded.redeem_value_cents,
  stamps_per_card    = excluded.stamps_per_card,
  updated_at         = now();

-- ── Categories ──────────────────────────────────────────────────────────────
insert into public.menu_categories (name, slug, sort_order) values
  ('Tacos',             'tacos',             1),
  ('Burritos',          'burritos',          2),
  ('Breakfast Burritos','breakfast-burritos',3),
  ('Quesadillas',       'quesadillas',       4),
  ('Tortas',            'tortas',            5),
  ('Sides',             'sides',             6),
  ('Drinks',            'drinks',            7)
on conflict (slug) do update set
  name = excluded.name, sort_order = excluded.sort_order, active = true;

-- ── Items ───────────────────────────────────────────────────────────────────
-- category_id resolved by slug so the seed is stable across runs.
insert into public.menu_items (category_id, name, description, price_cents, dietary_tags, sort_order)
select c.id, v.name, v.description, v.price_cents, v.dietary_tags, v.sort_order
from (values
  -- Tacos ($2–$4)
  ('tacos','Carne Asada Taco','Grilled steak, onion, cilantro, lime on a double corn tortilla.',350,'{}'::text[],1),
  ('tacos','Al Pastor Taco','Marinated pork off the spit with pineapple, onion, and cilantro.',325,'{}'::text[],2),
  ('tacos','Pollo Asado Taco','Citrus-grilled chicken, onion, cilantro.',300,'{}'::text[],3),
  ('tacos','Carnitas Taco','Slow-braised pork, onion, cilantro, salsa verde.',325,'{}'::text[],4),
  ('tacos','Barbacoa Taco','Tender shredded beef, onion, cilantro.',375,'{}'::text[],5),
  ('tacos','Veggie Taco','Grilled peppers, onions, zucchini, black beans, cotija.',275,'{vegetarian}'::text[],6),

  -- Burritos ($8–$11)
  ('burritos','Carne Asada Burrito','Steak, rice, beans, cheese, pico, guacamole in a flour tortilla.',1050,'{}'::text[],1),
  ('burritos','Pollo Burrito','Grilled chicken, rice, beans, cheese, salsa.',950,'{}'::text[],2),
  ('burritos','Carnitas Burrito','Braised pork, rice, beans, onion, cilantro, salsa verde.',975,'{}'::text[],3),
  ('burritos','Veggie Burrito','Rice, black beans, fajita veggies, cheese, guacamole.',850,'{vegetarian}'::text[],4),
  ('burritos','Smothered Burrito','Any burrito smothered in red or green chile and cheese.',1150,'{}'::text[],5),

  -- Breakfast Burritos ($6–$9)
  ('breakfast-burritos','Classic Breakfast Burrito','Egg, hash browns, cheese, choice of bacon or sausage.',725,'{}'::text[],1),
  ('breakfast-burritos','Chorizo Breakfast Burrito','Egg, Mexican chorizo, potato, cheese, salsa roja.',795,'{}'::text[],2),
  ('breakfast-burritos','Veggie Breakfast Burrito','Egg, potato, peppers, onion, cheese.',675,'{vegetarian}'::text[],3),
  ('breakfast-burritos','Machaca Breakfast Burrito','Egg, shredded beef, peppers, onion, cheese.',895,'{}'::text[],4),

  -- Quesadillas ($5–$9)
  ('quesadillas','Cheese Quesadilla','Melted jack & cheddar in a grilled flour tortilla.',550,'{vegetarian}'::text[],1),
  ('quesadillas','Chicken Quesadilla','Grilled chicken and cheese with pico.',850,'{}'::text[],2),
  ('quesadillas','Steak Quesadilla','Carne asada and cheese with grilled onions.',925,'{}'::text[],3),

  -- Tortas ($8–$10)
  ('tortas','Milanesa Torta','Breaded chicken, beans, lettuce, tomato, avocado, mayo on telera.',975,'{}'::text[],1),
  ('tortas','Carnitas Torta','Braised pork, beans, jalapeño, avocado, queso fresco.',925,'{}'::text[],2),

  -- Sides ($2–$5)
  ('sides','Chips & Salsa','House tortilla chips with roja and verde.',250,'{vegetarian,vegan}'::text[],1),
  ('sides','Chips & Guacamole','Fresh guacamole with warm chips.',495,'{vegetarian,vegan}'::text[],2),
  ('sides','Rice & Beans','Mexican rice and refried beans.',350,'{vegetarian}'::text[],3),
  ('sides','Elote','Grilled street corn, crema, cotija, chile-lime.',400,'{vegetarian}'::text[],4),

  -- Drinks ($2–$4)
  ('drinks','Horchata','House-made cinnamon rice milk.',300,'{vegetarian}'::text[],1),
  ('drinks','Jamaica','Hibiscus agua fresca.',300,'{vegetarian,vegan}'::text[],2),
  ('drinks','Mexican Coca-Cola','Bottled Coke with cane sugar.',275,'{vegetarian,vegan}'::text[],3),
  ('drinks','Bottled Water','',200,'{vegetarian,vegan}'::text[],4)
) as v(cat_slug, name, description, price_cents, dietary_tags, sort_order)
join public.menu_categories c on c.slug = v.cat_slug
where not exists (
  select 1 from public.menu_items mi
  join public.menu_categories mc on mc.id = mi.category_id
  where mc.slug = v.cat_slug and mi.name = v.name
);
