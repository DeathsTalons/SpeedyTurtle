-- Meijer prices come from a default store and can be ~20% off Cody's stores.
-- Hold this much EXTRA on the card for Meijer items (on top of auth_buffer_pct).
alter table settings add column meijer_extra_buffer_pct smallint not null default 10;
