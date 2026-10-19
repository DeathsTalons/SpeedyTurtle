-- Save the phone number entered at sign-up (it arrives with the account, before email confirmation).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', nullif(new.raw_user_meta_data->>'phone', ''));
  return new;
end $$;
