-- Photos of the paper store receipts (shown to the customer, attached to their emailed receipt),
-- and when the receipt email went out.
alter table orders
  add column receipt_photos jsonb not null default '[]',   -- [{ "path": "orderId/kroger-1731...jpg", "chain": "kroger", "at": "..." }]
  add column receipt_emailed_at timestamptz;

-- Private storage for the photos. Only the server (service role) reads or writes it; customers see them
-- through short-lived signed links after the app checks the order is theirs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
