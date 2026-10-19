-- Finer location inside an aisle (Kroger sometimes sends bay/shelf/side; Cody can type it too).
alter table product_locations
  add column bay integer,        -- position along the aisle, for walking order
  add column detail text;        -- "Left side · Bay 4 · Shelf 3"
