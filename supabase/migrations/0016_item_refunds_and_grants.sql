-- 1) Item refunds (missing / damaged / wrong items reported after delivery).
alter table order_items
  add column refunded_cents integer not null default 0,
  add column refund_note text,
  add column refunded_at timestamptz;
-- Running total of item refunds on the order, so re-saving the receipt total doesn't try to charge them back.
alter table orders add column item_refunds_cents integer not null default 0;

-- 2) Which database this is. "live" = real customers. The separate test database is set to "test"
--    (supabase/test-database-setup.sql does that), and the app refuses test-mode Stripe checkouts on "live".
alter table settings add column environment text not null default 'live' check (environment in ('live', 'test'));

-- 3) Data API access for every table.
--    Supabase stopped granting this automatically for tables created after Oct 30, 2026, so a NEW project
--    (like a separate test database) built from these migrations would otherwise answer "permission denied".
--    On a project that already has these grants this changes nothing. Row Level Security still decides
--    which rows each person can see.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- 4) Re-apply the profile lockdown from 0015 (the grant above would otherwise undo it):
--    customers may only change their own name, phone and "seen the fees" flag.
revoke insert, update, delete on profiles from anon, authenticated;
grant update (full_name, phone, fees_seen_at) on profiles to authenticated;
