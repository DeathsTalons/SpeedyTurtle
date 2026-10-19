-- Meijer store numbers (from the meijer-selected-store cookie) and Meijer-sourced aisle data.
update stores set external_location_id = '338' where chain = 'meijer' and name like '%Brownsburg%';
-- Avon: fill in once known, e.g.  update stores set external_location_id = '###' where chain='meijer' and name like '%Avon%';

alter table product_locations drop constraint if exists product_locations_source_check;
alter table product_locations add constraint product_locations_source_check check (source in ('kroger', 'meijer', 'cody'));
