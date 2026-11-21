-- Sample bookings for testing the Bookings page with your own account.
-- Not a migration: run it by hand in the SQL Editor, and never in production.
--
-- 1. Use a test user (Authentication → Users → Add user → Create new user,
--    with "Auto Confirm User" ticked), or any account you have signed in
--    with. Either way its profile already exists.
-- 2. Replace you@example.com below with that account's email.
-- 3. Run this whole file. Then pull down on the Bookings tab to refresh.
--    Running it again keeps the existing samples.
--
-- It adds one upcoming booking (professional assigned, with an extra part
-- waiting for your approval), one completed job to rate, and one cancelled
-- job. The "Remove the samples" block at the bottom deletes them again.

do $$
declare
  my_email text := 'you@example.com';  -- <-- change this
  me uuid;
  addr uuid;
  pro uuid;
  kathmandu_today timestamptz := (date_trunc('day', now() at time zone 'Asia/Kathmandu')) at time zone 'Asia/Kathmandu';
  upcoming uuid;
begin
  select id into me from public.profiles where lower(email) = lower(my_email);
  if me is null then
    raise exception 'No profile with email %. Sign in to the app with it first.', my_email;
  end if;

  if exists (select 1 from public.addresses where customer_id = me and label = 'Home (sample)') then
    raise notice 'Samples already exist for this account.';
    return;
  end if;

  insert into public.addresses (customer_id, label, area, city, landmark)
  values (me, 'Home (sample)', 'Baneshwor', 'Kathmandu', 'near the temple')
  returning id into addr;

  insert into public.professionals (full_name, phone, area, verification_status, verified_at)
  values ('Ram (sample)', '+9779800000000', 'Baneshwor', 'verified', now())
  on conflict (phone) do update set full_name = excluded.full_name
  returning id into pro;

  -- Ram covers every service and is available, so "As soon as possible" can
  -- be tested in Baneshwor during working hours (8 am to 4 pm Nepal time).
  insert into public.professional_services (professional_id, service_id)
  select pro, s.id from public.services s on conflict do nothing;

  -- Upcoming: tomorrow 10 am to 12 noon, professional assigned.
  insert into public.bookings (customer_id, service_id, address_id, professional_id, status,
                               slot_start, slot_end, description, assigned_at)
  select me, s.id, addr, pro, 'assigned',
         kathmandu_today + interval '1 day 10 hours',
         kathmandu_today + interval '1 day 12 hours',
         'Leaking kitchen tap', now()
  from public.services s where s.slug = 'tap-repair'
  returning id into upcoming;

  insert into public.extra_parts (booking_id, description, amount)
  values (upcoming, 'New washer', 50);

  -- Completed six days ago, waiting for your rating.
  insert into public.bookings (customer_id, service_id, address_id, professional_id, status,
                               slot_start, slot_end, description, price, assigned_at, started_at, completed_at)
  select me, s.id, addr, pro, 'completed',
         kathmandu_today - interval '6 days' + interval '11 hours',
         kathmandu_today - interval '6 days' + interval '13 hours',
         'Ceiling fan in the bedroom', 600,
         now() - interval '7 days', now() - interval '6 days', now() - interval '6 days'
  from public.services s where s.slug = 'fan-install';

  -- Cancelled by the customer.
  insert into public.bookings (customer_id, service_id, address_id, status,
                               slot_start, slot_end, description, cancelled_at, cancelled_by, cancel_reason)
  select me, s.id, addr, 'cancelled',
         kathmandu_today - interval '12 days' + interval '9 hours',
         kathmandu_today - interval '12 days' + interval '11 hours',
         'Paint one bedroom', now() - interval '13 days', 'customer', 'Wrong time'
  from public.services s where s.slug = 'room-paint';

  raise notice 'Added 3 sample bookings for %', my_email;
end $$;

-- Remove the samples (run on its own when you are done testing):
--
-- delete from public.bookings b using public.addresses a
--   where b.address_id = a.id and a.label = 'Home (sample)';
-- delete from public.addresses where label = 'Home (sample)';
-- delete from public.professionals where full_name = 'Ram (sample)';
