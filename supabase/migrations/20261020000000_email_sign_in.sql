-- Customers can now sign in with an email code as well as a phone code.
-- Store the email on the profile, filled in automatically on sign-up.

alter table public.profiles add column email text unique;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, email, full_name)
  values (
    new.id,
    nullif(new.phone, ''),
    nullif(lower(new.email), ''),
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

-- Customers may change their name, but not their role, phone or email
-- (those come from the sign-in itself).
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() and current_user = 'authenticated' then
    new.role := old.role;
    new.phone := old.phone;
    new.email := old.email;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
