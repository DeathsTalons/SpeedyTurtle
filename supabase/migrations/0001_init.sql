-- Speedy Turtle — initial database schema
-- Run this in the Supabase SQL editor (or with `supabase db push`).

-- ───────────────────────────── Enums ─────────────────────────────
create type chain as enum ('kroger', 'meijer');
create type user_role as enum ('customer', 'admin');
create type order_status as enum (
  'placed',        -- customer checked out, card authorized
  'shopping',      -- Cody is in the store
  'delivering',    -- on the way
  'delivered',     -- dropped off, final amount captured
  'canceled'
);
create type item_status as enum ('pending', 'found', 'substituted', 'out_of_stock');
create type sub_pref as enum ('best_match', 'contact_me', 'refund');

-- ───────────────────────────── People ─────────────────────────────
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  phone       text,
  role        user_role not null default 'customer',
  created_at  timestamptz not null default now()
);

create table addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles on delete cascade,
  line1           text not null,
  line2           text,
  city            text not null,
  state           text not null default 'IN',
  zip             text not null,
  delivery_notes  text,               -- "gate code 1234", "leave by side door"
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ───────────────────────────── Stores & catalog ─────────────────────────────
create table stores (
  id                    uuid primary key default gen_random_uuid(),
  chain                 chain not null,
  name                  text not null,           -- "Kroger – Fishers 116th St"
  external_location_id  text,                    -- Kroger locationId; null for Meijer
  address               text,
  active                boolean not null default true
);

create table products (
  id                uuid primary key default gen_random_uuid(),
  chain             chain not null,
  external_id       text not null,          -- Kroger productId / Meijer item id
  upc               text,
  name              text not null,
  brand             text,
  size              text,                   -- "1 gal", "16 oz"
  image_url         text,
  department        text,
  aisle             text,                   -- used to sort Cody's shopping list
  price_cents       integer,
  sale_price_cents  integer,
  price_updated_at  timestamptz,
  active            boolean not null default true,
  unique (chain, external_id)
);
create index products_name_search on products using gin (to_tsvector('english', name || ' ' || coalesce(brand, '')));

-- ───────────────────────────── Scheduling ─────────────────────────────
-- The two fixed delivery windows.
create table slot_templates (
  id          smallint primary key generated always as identity,
  label       text not null,               -- "Morning"
  start_time  time not null,
  end_time    time not null,
  capacity    smallint not null default 5, -- max orders in this window
  sort_order  smallint not null default 0,
  active      boolean not null default true
);

-- Default week: 0 = Sunday … 6 = Saturday.
create table weekly_schedule (
  weekday  smallint primary key check (weekday between 0 and 6),
  is_open  boolean not null
);

-- Calendar toggles. slot_template_id null = the whole day.
create table schedule_overrides (
  id                uuid primary key default gen_random_uuid(),
  date              date not null,
  slot_template_id  smallint references slot_templates on delete cascade,
  is_open           boolean not null,
  note              text,                   -- "Traveling", "Picked up extra day"
  unique nulls not distinct (date, slot_template_id)
);

-- ───────────────────────────── Pricing ─────────────────────────────
create table fee_tiers (
  id         smallint primary key generated always as identity,
  min_items  integer not null,
  max_items  integer,                       -- null = no upper limit
  fee_cents  integer not null,
  label      text not null
);

create table settings (
  id                   boolean primary key default true check (id), -- single row
  auth_buffer_pct      smallint not null default 15,  -- extra % held on the card
  order_cutoff_hours   smallint not null default 3,   -- stop booking a window this long before it starts
  booking_days_ahead   smallint not null default 14,
  max_orders_per_week  smallint not null default 35,
  service_area_zips    text[] not null default '{}'
);

-- ───────────────────────────── Orders ─────────────────────────────
create table orders (
  id                        uuid primary key default gen_random_uuid(),
  customer_id               uuid not null references profiles,
  address_id                uuid not null references addresses,
  delivery_date             date not null,
  slot_template_id          smallint not null references slot_templates,
  status                    order_status not null default 'placed',
  substitution_pref         sub_pref not null default 'contact_me',
  customer_notes            text,
  unique_item_count         integer not null,
  service_fee_cents         integer not null,
  estimated_subtotal_cents  integer not null,
  tip_cents                 integer not null default 0,
  authorized_amount_cents   integer not null,
  final_subtotal_cents      integer,          -- from the receipt(s)
  final_total_cents         integer,
  stripe_payment_intent_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index orders_by_slot on orders (delivery_date, slot_template_id) where status <> 'canceled';

create table order_items (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references orders on delete cascade,
  chain                     chain not null,
  product_id                uuid references products,   -- null for free-text requests
  free_text                 text,                       -- "the good sourdough from the bakery"
  name_snapshot             text not null,
  unit_price_cents_snapshot integer,                    -- price shown at checkout
  quantity                  numeric(8,2) not null default 1,
  item_note                 text,                       -- "green bananas please"
  status                    item_status not null default 'pending',
  substitute_name           text,
  actual_price_cents        integer,
  shopper_note              text,
  check (product_id is not null or free_text is not null)
);

-- ───────────────────────────── Security (row-level) ─────────────────────────────
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

alter table profiles           enable row level security;
alter table addresses          enable row level security;
alter table stores             enable row level security;
alter table products           enable row level security;
alter table slot_templates     enable row level security;
alter table weekly_schedule    enable row level security;
alter table schedule_overrides enable row level security;
alter table fee_tiers          enable row level security;
alter table settings           enable row level security;
alter table orders             enable row level security;
alter table order_items        enable row level security;

-- Customers manage their own stuff; Cody (admin) sees everything.
create policy own_profile    on profiles  for all using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
create policy own_addresses  on addresses for all using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
create policy own_orders_read on orders   for select using (customer_id = auth.uid() or is_admin());
create policy admin_orders_write on orders for all using (is_admin()) with check (is_admin());
create policy own_items_read on order_items for select using (
  is_admin() or exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid())
);
create policy admin_items_write on order_items for all using (is_admin()) with check (is_admin());
-- Orders are created by the server (checkout route) with the service key, never directly by customers,
-- so prices and fees can't be tampered with.

-- Public-readable reference data, admin-editable.
do $$
declare t text;
begin
  foreach t in array array['stores','products','slot_templates','weekly_schedule','schedule_overrides','fee_tiers','settings'] loop
    execute format('create policy %I on %I for select using (true)', t || '_read', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Auto-create a profile when someone signs up.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────────── Starting data (all editable later) ─────────────────────────────
insert into settings default values;

insert into weekly_schedule (weekday, is_open) values
  (0, true), (1, false), (2, false), (3, true), (4, true), (5, true), (6, true);  -- Mon & Tue off

insert into slot_templates (label, start_time, end_time, capacity, sort_order) values
  ('Morning',   '10:00', '13:00', 5, 1),
  ('Afternoon', '15:00', '18:00', 5, 2);

insert into fee_tiers (min_items, max_items, fee_cents, label) values
  (1,  15,   1000, 'Small (1–15 items)'),
  (16, 35,   1500, 'Medium (16–35 items)'),
  (36, null, 2000, 'Large (36+ items)');
