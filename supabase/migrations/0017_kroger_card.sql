-- Kroger card (Alt ID) phone number: customers can give the number on their Kroger card so their order is rung
-- up with it (their clipped digital coupons apply, they get the fuel points). Blank = Cody uses his own card.
alter table profiles add column kroger_card_phone text;  -- remembered for next time
alter table orders add column kroger_card_phone text;    -- what to use for this order

-- Customers may change their own Kroger card number too (still not role or Stripe id).
grant update (full_name, phone, fees_seen_at, kroger_card_phone) on profiles to authenticated;
