-- Orders are meant to be one store. Adding the other store costs a flat extra fee.
alter table settings add column second_store_fee_cents integer not null default 500;
alter table orders   add column second_store_fee_cents integer not null default 0;
