-- Second-store fee placeholder: $10.
alter table settings alter column second_store_fee_cents set default 1000;
update settings set second_store_fee_cents = 1000;
