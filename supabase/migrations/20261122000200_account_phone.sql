-- No booking without a mobile number saved on the customer's account.
--
-- People who sign in with a phone code already have one (profiles.phone,
-- the verified sign-in number, which the app can never change). People who
-- sign in with email or Google are not asked at sign-up; the number they
-- give at their first booking is saved on their account
-- (profiles.contact_phone), and they can change it later under Account.
-- Each booking still keeps its own "phone number for this job", which can be
-- someone at the house.

begin;

alter table public.profiles
  add column if not exists contact_phone text
  check (contact_phone is null or contact_phone ~ '^\+977(97|98)[0-9]{8}$');

-- "98 0000 0001", "+977 9800000001", "९८०००००००१" -> "+9779800000001",
-- or null when it is not a Nepali mobile number.
create or replace function public.normalize_mobile(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  with digits as (
    select regexp_replace(translate(coalesce(p_value, ''), '०१२३४५६७८९', '0123456789'), '[^0-9]', '', 'g') as d
  ), local as (
    select case when length(d) = 13 and left(d, 3) = '977' then substr(d, 4) else d end as d from digits
  )
  select case when d ~ '^(97|98)[0-9]{8}$' then '+977' || d end from local;
$$;

create or replace function public.create_booking(
  p_task_id uuid,
  p_address_id uuid,
  p_slot_start timestamptz,
  p_is_urgent boolean default false,
  p_description text default null,
  p_contact_phone text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  account_phone text;
  job_phone text;
  result public.bookings;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in to book.' using errcode = 'P0001';
  end if;
  select * into me from public.profiles where id = (select auth.uid());
  account_phone := coalesce(me.phone, me.contact_phone);

  if nullif(trim(coalesce(p_contact_phone, '')), '') is not null then
    job_phone := public.normalize_mobile(p_contact_phone);
  else
    job_phone := public.normalize_mobile(account_phone);
  end if;
  if job_phone is null then
    raise exception 'Please give a mobile number (10 digits, starting 98 or 97) so the professional can call you.'
      using errcode = 'P0001';
  end if;

  result := public.create_booking_base(p_task_id, p_address_id, p_slot_start, p_is_urgent, p_description);
  update public.bookings set contact_phone = job_phone where id = result.id returning * into result;

  -- First booking without a number on the account: keep this one there.
  if account_phone is null then
    update public.profiles set contact_phone = job_phone where id = me.id;
  end if;
  return result;
end;
$$;

-- Account: add or change the mobile number (email and Google sign-ins).
create or replace function public.set_my_contact_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_phone text := public.normalize_mobile(p_phone);
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;
  if new_phone is null then
    raise exception 'Please write a mobile number: 10 digits, starting 98 or 97.' using errcode = 'P0001';
  end if;
  update public.profiles set contact_phone = new_phone where id = (select auth.uid());
  return new_phone;
end;
$$;

-- The number can only be set through the function above (which checks it),
-- not by editing the profile directly.
create or replace function public.protect_profile_contact_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() and current_user = 'authenticated' then
    new.contact_phone := old.contact_phone;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_contact_phone on public.profiles;
create trigger profiles_protect_contact_phone
  before update on public.profiles
  for each row execute function public.protect_profile_contact_phone();

revoke execute on function public.create_booking(uuid, uuid, timestamptz, boolean, text, text) from public, anon;
grant execute on function public.create_booking(uuid, uuid, timestamptz, boolean, text, text) to authenticated;
revoke execute on function public.set_my_contact_phone(text) from public, anon;
grant execute on function public.set_my_contact_phone(text) to authenticated;

commit;
