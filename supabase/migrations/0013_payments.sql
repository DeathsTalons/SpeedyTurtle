-- Card payments (Stripe).
alter table profiles add column stripe_customer_id text;

alter table orders
  add column payment_status text not null default 'none'
    check (payment_status in ('none', 'card_saved', 'authorized', 'captured', 'failed', 'canceled')),
  add column stripe_payment_method_id text,
  add column payment_error text,
  add column authorized_at timestamptz,
  add column captured_cents integer,
  add column extra_charge_payment_intent_id text,
  add column refunded_cents integer not null default 0;
