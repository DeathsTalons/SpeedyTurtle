-- Phones/browsers that get push notifications (Cody's new-order alerts).
-- Only the server (service role) reads or writes this; customers and visitors get nothing.
create table push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
alter table push_subscriptions enable row level security;   -- no policies: no access except the service role
revoke all on push_subscriptions from anon, authenticated;
grant all on push_subscriptions to service_role;
grant usage, select on sequence push_subscriptions_id_seq to service_role;
