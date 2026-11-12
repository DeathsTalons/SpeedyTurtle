-- "Available now" (same-day ASAP) is per area: Cody can't be in Avon/Brownsburg and Greencastle at once.
-- Each store belongs to an area; a customer's area is the area of the Kroger store nearest their address.
alter table stores add column area text not null default 'hendricks' check (area in ('hendricks', 'greencastle'));
update stores set area = 'greencastle' where name like '%Greencastle%';

-- Which area Cody is taking same-day orders in right now (null = everywhere, only from before this change).
alter table settings add column available_area text check (available_area in ('hendricks', 'greencastle'));
