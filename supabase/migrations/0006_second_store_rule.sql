-- Can an order that STARTS at this store add items from the other chain?
-- Greencastle Kroger: no (no Meijer nearby). Every other store: yes.
alter table stores add column allow_second_store boolean not null default true;
update stores set allow_second_store = false where chain = 'kroger' and name like '%Greencastle%';
