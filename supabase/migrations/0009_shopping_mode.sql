-- Shopping mode, per-item substitutions, per-store aisles, 2-hour windows.

-- ── Per-item substitutions ──
create type item_sub_choice as enum ('approved', 'codys_pick', 'store_brand', 'refund', 'other');
alter table order_items
  add column sub_choice item_sub_choice not null default 'codys_pick',
  add column scanned_upc text,                    -- what Cody scanned in the store
  add column added_by_shopper boolean not null default false,
  add column removed boolean not null default false,
  add column found_quantity numeric(8,2);         -- how many Cody actually got

-- ── Where each product sits in each store ──
-- Kroger: filled from Kroger's API. Meijer: filled in by Cody while shopping.
create table product_locations (
  store_id    uuid not null references stores on delete cascade,
  product_id  uuid not null references products on delete cascade,
  aisle       text not null,         -- "Aisle 8", "Dairy", "Produce"
  sort_key    integer,               -- for ordering the walk through the store
  source      text not null default 'cody' check (source in ('kroger', 'cody')),
  updated_at  timestamptz not null default now(),
  primary key (store_id, product_id)
);
alter table product_locations enable row level security;
create policy product_locations_admin on product_locations for all using (is_admin()) with check (is_admin());

-- ── Shopping batches (several orders shopped together) ──
create table shopping_batches (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
alter table orders add column batch_id uuid references shopping_batches on delete set null;
alter table shopping_batches enable row level security;
create policy batches_admin on shopping_batches for all using (is_admin()) with check (is_admin());

-- ── 2-hour delivery windows (replaces Morning / Afternoon; old ones kept for past orders) ──
update slot_templates set active = false;
insert into slot_templates (label, start_time, end_time, capacity, sort_order) values
  ('10am–12pm', '10:00', '12:00', 3, 1),
  ('12–2pm',    '12:00', '14:00', 3, 2),
  ('2–4pm',     '14:00', '16:00', 3, 3),
  ('4–6pm',     '16:00', '18:00', 3, 4);

-- Aisle for typed-in requests (no catalog product to attach it to).
alter table order_items add column shopper_aisle text;
