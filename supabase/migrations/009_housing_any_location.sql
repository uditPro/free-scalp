begin;

-- The rental product started with an Ahmedabad pilot. Keep existing data,
-- but allow a renter to search any city, metro, or town going forward.
alter table public.housing_preferences drop constraint if exists housing_preferences_city_check;
alter table public.housing_listings drop constraint if exists housing_listings_city_check;

alter table public.housing_preferences
  add constraint housing_preferences_city_check check (char_length(btrim(city)) between 2 and 160);

alter table public.housing_listings
  add constraint housing_listings_city_check check (char_length(btrim(city)) between 2 and 160);

create index if not exists housing_listings_city_area_seen
  on public.housing_listings (city, area, last_seen_at desc);

commit;
