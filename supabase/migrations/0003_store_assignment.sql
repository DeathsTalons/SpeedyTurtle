-- Nearest-store assignment, with Cody able to change it after the order is placed.

alter table stores    add column latitude double precision, add column longitude double precision;
alter table addresses add column latitude double precision, add column longitude double precision;

-- Each order gets one store per chain. Set automatically to the nearest at checkout.
alter table orders
  add column kroger_store_id uuid references stores,
  add column meijer_store_id uuid references stores,
  add column store_reassigned_at timestamptz;   -- set when Cody changes it by hand

-- Guard: the Kroger slot must point at a Kroger store, and the Meijer slot at a Meijer.
create function check_order_stores() returns trigger language plpgsql as $$
begin
  if new.kroger_store_id is not null and (select chain from stores where id = new.kroger_store_id) <> 'kroger' then
    raise exception 'kroger_store_id must be a Kroger store';
  end if;
  if new.meijer_store_id is not null and (select chain from stores where id = new.meijer_store_id) <> 'meijer' then
    raise exception 'meijer_store_id must be a Meijer store';
  end if;
  if tg_op = 'UPDATE' and (new.kroger_store_id is distinct from old.kroger_store_id
                        or new.meijer_store_id is distinct from old.meijer_store_id) then
    new.store_reassigned_at := now();
  end if;
  return new;
end $$;
create trigger orders_check_stores before insert or update on orders
  for each row execute function check_order_stores();
