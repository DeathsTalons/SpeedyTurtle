-- Delivery windows can be limited to one area (null = every area).
-- Mornings (10–12, 12–2) are Greencastle-only; a new 6–8pm window is open everywhere.
alter table slot_templates add column area text check (area in ('hendricks', 'greencastle'));

update slot_templates set area = 'greencastle' where active and start_time in ('10:00', '12:00') and end_time in ('12:00', '14:00');

insert into slot_templates (label, start_time, end_time, capacity, sort_order, active)
select '6–8pm', '18:00', '20:00', 3, 5, true
where not exists (select 1 from slot_templates where start_time = '18:00' and end_time = '20:00');
