-- 1) New service fee tiers (by number of unique items).
--    Orders already placed keep the fee they were quoted; this only affects new orders.
delete from fee_tiers;
insert into fee_tiers (min_items, max_items, fee_cents, label) values
  (1,  10,   1500, 'Quick Trip'),
  (11, 25,   3000, 'Regular Run'),
  (26, 40,   4000, 'Big Shop'),
  (41, 60,   5000, 'Stock-Up'),
  (61, null, 6000, 'Full Haul');

-- 2) The fee breakdown screen shown once after creating an account.
alter table profiles add column fees_seen_at timestamptz;

-- 3) Tips added after delivery (a separate charge on the saved card).
alter table orders
  add column later_tip_cents integer not null default 0,
  add column later_tip_payment_intent_id text,
  add column later_tip_at timestamptz;
create index orders_later_tip_payment_intent_idx on orders (later_tip_payment_intent_id);

-- 4) Security fix: customers could previously edit ANY column of their own profile from the browser,
--    including `role` (making themselves admin) and `stripe_customer_id`. Now they can only change
--    their name, phone, and the "seen the fees" flag. Profiles are created by the sign-up trigger,
--    and the server (service role) is unaffected.
revoke insert, update, delete on profiles from anon, authenticated;
grant update (full_name, phone, fees_seen_at) on profiles to authenticated;
