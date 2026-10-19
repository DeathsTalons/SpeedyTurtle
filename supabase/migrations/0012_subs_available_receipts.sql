-- 1) Specific products the customer approved as substitutes: [{ name, externalId, upc, priceCents }]
alter table order_items add column approved_subs jsonb not null default '[]';

-- 2) "Available now": Cody is out and can take same-day (ASAP) orders until this time.
alter table settings
  add column available_until timestamptz,
  add column asap_capacity smallint not null default 2;   -- open ASAP orders at once
alter table orders
  add column asap boolean not null default false,
  alter column slot_template_id drop not null;            -- ASAP orders have no 2-hour window

-- 3) Receipt totals, per store, entered after shopping.
alter table orders
  add column receipt_kroger_cents integer,
  add column receipt_meijer_cents integer,
  add column finalized_at timestamptz;
