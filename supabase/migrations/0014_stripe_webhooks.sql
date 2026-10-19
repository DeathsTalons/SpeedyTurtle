-- Stripe webhooks: remember which events were handled, and track disputes.
create table stripe_events (
  id text primary key,            -- Stripe's event id (evt_...)
  type text not null,
  received_at timestamptz not null default now()
);
-- Only the server (service role) touches this table; no policies means the public key can't.
alter table stripe_events enable row level security;

alter table orders add column dispute_status text;   -- null, 'open', 'won', 'lost', ...

-- Webhooks look orders up by their payment intents.
create index orders_stripe_payment_intent_idx on orders (stripe_payment_intent_id);
create index orders_extra_charge_payment_intent_idx on orders (extra_charge_payment_intent_id);
