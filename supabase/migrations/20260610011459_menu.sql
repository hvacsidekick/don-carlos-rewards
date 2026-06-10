-- Phase 2 · Migration 09 — menu_categories / menu_items
-- BLUEPRINT.md §4.7

create table public.menu_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order integer not null default 0,
  active     boolean not null default true
);

create table public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.menu_categories(id) on delete cascade,
  name         text not null,
  description  text,
  price_cents  integer not null check (price_cents >= 0),
  image_url    text,
  dietary_tags text[] not null default '{}',
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index menu_items_category_idx on public.menu_items (category_id, sort_order);

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

-- Public read of active rows only (the menu is non-sensitive).
create policy "menu_cat_public_read" on public.menu_categories
  for select using (active);
create policy "menu_item_public_read" on public.menu_items
  for select using (active);
-- Writes via admin (service role / admin-guarded action) — no client policy.

grant select on public.menu_categories, public.menu_items to anon, authenticated;
