-- Milestone 1: customers create bookings in the app.
--
-- * booking_settings: one row of amounts and rules the team can change in the
--   Table Editor without an app update (placeholders until the team decides).
-- * service_tasks: the jobs under each trade (Plumber -> Tap repair, ...),
--   each with its own price and duration.
-- * Home cleaning, General cleaning and "Other services" join the catalogue.
-- * create_booking(): the only way to make a booking. It checks the slot,
--   address and task and sets the price, ASAP charge and advance itself.
-- * submit_advance_payment(): the customer reports their eSewa/Khalti
--   transaction ID; the team checks it and marks the payment paid.
--
-- Time slots are in Nepal time (Asia/Kathmandu) wherever the phone is.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table public.booking_settings (
  id boolean primary key default true check (id),   -- exactly one row
  advance_amount numeric(10, 2) not null default 200, -- paid when booking, counts towards the bill
  asap_fee numeric(10, 2) not null default 100,       -- extra charge for "as soon as possible"
  travel_fee numeric(10, 2) not null default 150,     -- kept if cancelled after the professional set off
  visit_charge numeric(10, 2) not null default 200,   -- kept if cancelled after arrival
  free_cancel_hours integer not null default 3,       -- free cancellation up to this long before the slot
  min_notice_hours integer not null default 2,        -- earliest a normal slot can start
  slot_hours integer not null default 2,
  day_start_hour integer not null default 8,          -- first slot starts 8 am Nepal time
  day_end_hour integer not null default 18,           -- last slot ends 6 pm
  days_ahead integer not null default 7,
  slot_capacity integer not null default 2,           -- bookings per slot per area
  asap_promise_hours integer not null default 2,      -- "a professional within about 2 hours"
  esewa_id text,                                      -- company eSewa ID shown on the payment screen
  khalti_id text,
  updated_at timestamptz not null default now()
);

insert into public.booking_settings default values;

create trigger booking_settings_updated_at
  before update on public.booking_settings
  for each row execute function public.set_updated_at();

alter table public.booking_settings enable row level security;

create policy "anyone reads booking settings" on public.booking_settings
  for select to anon, authenticated using (true);
create policy "admins update booking settings" on public.booking_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Catalogue: service details and tasks
-- ---------------------------------------------------------------------------

alter table public.services
  add column includes text[] not null default '{}',
  add column excludes text[] not null default '{}';

create table public.service_tasks (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  slug text not null,
  name text not null,
  name_ne text not null,
  price numeric(10, 2) check (price >= 0),  -- null until real prices are agreed
  duration_minutes integer check (duration_minutes > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (service_id, slug)
);

alter table public.service_tasks enable row level security;

create policy "anyone reads active tasks" on public.service_tasks
  for select to anon, authenticated using (is_active);
create policy "admins manage tasks" on public.service_tasks
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.services (slug, name, name_ne, pricing_type, icon, sort_order, includes, excludes) values
  ('home-cleaning', 'Home cleaning', 'घर सफाइ', 'fixed_price', 'home', 80,
    '{"Deep clean of rooms, kitchen and bathrooms","Cleaning materials and equipment","Dusting fans, windows and shelves"}',
    '{"Moving heavy furniture","Outside walls and roof"}'),
  ('general-cleaning', 'General cleaning', 'सामान्य सफाइ', 'fixed_price', 'check-square', 85,
    '{"Sweeping, mopping and dusting","Kitchen and bathroom wipe-down","Cleaning materials"}',
    '{"Deep stain removal","Moving heavy furniture"}'),
  ('other', 'Other services', 'अन्य सेवाहरू', 'quote_first', 'grid', 999,
    '{"A professional visits and checks the job","A clear price before any work starts"}',
    '{"Work you have not approved"}')
on conflict (slug) do nothing;

insert into public.service_tasks (service_id, slug, name, name_ne, duration_minutes, sort_order)
select s.id, t.slug, t.name, t.name_ne, t.minutes, t.sort_order
from (values
  ('plumber', 'tap-repair', 'Tap repair', 'धारा मर्मत', 60, 10),
  ('plumber', 'pipe-leak', 'Pipe leak repair', 'पाइप चुहावट मर्मत', 90, 20),
  ('plumber', 'tap-fitting', 'New tap fitting', 'नयाँ धारा जडान', 60, 30),
  ('plumber', 'toilet', 'Toilet repair', 'शौचालय मर्मत', 90, 40),
  ('plumber', 'geyser', 'Geyser repair', 'गिजर मर्मत', 90, 50),
  ('electrician', 'switch-socket', 'Switch or socket repair', 'स्विच वा सकेट मर्मत', 45, 10),
  ('electrician', 'fan', 'Fan installation', 'पंखा जडान', 60, 20),
  ('electrician', 'light', 'Light fitting', 'बत्ती जडान', 45, 30),
  ('electrician', 'wiring', 'Wiring fault', 'वायरिङ समस्या', 90, 40),
  ('painter', 'one-room', 'One room painting', 'एक कोठा रङ', 480, 10),
  ('painter', 'touch-up', 'Wall touch-up', 'भित्ता मर्मत रङ', 180, 20),
  ('painter', 'outside', 'Outside walls', 'बाहिरी भित्ता', 480, 30),
  ('tile-marble', 'inspection', 'Visit and quote', 'निरीक्षण र मूल्य', 60, 10),
  ('tile-marble', 'broken-tile', 'Broken tile replacement', 'टुटेको टायल फेर्ने', 120, 20),
  ('ac-appliance', 'ac-service', 'AC service', 'एसी सर्भिस', 60, 10),
  ('ac-appliance', 'ac-repair', 'AC repair', 'एसी मर्मत', 90, 20),
  ('ac-appliance', 'fridge', 'Fridge repair', 'फ्रिज मर्मत', 90, 30),
  ('ac-appliance', 'washing-machine', 'Washing machine repair', 'वासिङ मेसिन मर्मत', 90, 40),
  ('ac-appliance', 'heater', 'Room heater repair', 'हिटर मर्मत', 60, 50),
  ('water-purifier', 'service', 'Filter change and service', 'फिल्टर सर्भिस', 45, 10),
  ('water-purifier', 'install', 'New purifier installation', 'नयाँ फिल्टर जडान', 60, 20),
  ('water-purifier', 'repair', 'Purifier repair', 'फिल्टर मर्मत', 60, 30),
  ('labour-mistri', 'helper-half', 'Helper, half day', 'ज्यामी, आधा दिन', 240, 10),
  ('labour-mistri', 'helper-full', 'Helper, full day', 'ज्यामी, पूरा दिन', 480, 20),
  ('labour-mistri', 'mistri-full', 'Mistri, full day', 'मिस्त्री, पूरा दिन', 480, 30),
  ('home-cleaning', '1bhk', '1 BHK deep clean', '१ बीएचके सफाइ', 180, 10),
  ('home-cleaning', '2bhk', '2 BHK deep clean', '२ बीएचके सफाइ', 240, 20),
  ('home-cleaning', '3bhk', '3 BHK deep clean', '३ बीएचके सफाइ', 300, 30),
  ('home-cleaning', 'full-house', 'Full house deep clean', 'पूरा घर सफाइ', 480, 40),
  ('general-cleaning', '2-hours', '2 hours', '२ घण्टा', 120, 10),
  ('general-cleaning', '4-hours', '4 hours', '४ घण्टा', 240, 20),
  ('general-cleaning', 'full-day', 'Full day', 'पूरा दिन', 480, 30),
  ('other', 'describe', 'Tell us what you need', 'के चाहिन्छ भन्नुहोस्', 60, 10)
) as t (service_slug, slug, name, name_ne, minutes, sort_order)
join public.services s on s.slug = t.service_slug
on conflict (service_id, slug) do nothing;

-- Every trade also gets a "Something else" task for jobs not on the list.
insert into public.service_tasks (service_id, slug, name, name_ne, duration_minutes, sort_order)
select s.id, 'something-else', 'Something else', 'अन्य काम', 60, 900
from public.services s
where s.slug in ('plumber', 'electrician', 'painter', 'tile-marble', 'ac-appliance', 'water-purifier')
on conflict (service_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- Bookings: tasks, ASAP and advance
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column task_id uuid references public.service_tasks (id) on delete set null,
  add column is_urgent boolean not null default false,
  add column urgent_fee numeric(10, 2) not null default 0 check (urgent_fee >= 0);

-- Bookings are now only created through create_booking(), which checks the
-- slot and sets the price, so customers lose direct insert rights.
drop policy "customers create own bookings" on public.bookings;

-- Is at least one verified, available professional for this service working
-- in this area (or anywhere)? Used for the ASAP option.
create or replace function public.asap_available(p_service_id uuid, p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professionals p
    join public.professional_services ps on ps.professional_id = p.id
    where ps.service_id = p_service_id
      and p.is_available
      and p.verification_status = 'verified'
      and (p.area is null or lower(p.area) = lower(p_area))
  );
$$;

-- How many bookings each upcoming slot already has in an area, so the app
-- can grey out full slots. Shares counts only, never who booked.
create or replace function public.slot_counts(p_area text)
returns table (slot_start timestamptz, booked integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.slot_start, count(*)::integer
  from public.bookings b
  join public.addresses a on a.id = b.address_id
  where b.status <> 'cancelled'
    and not b.is_urgent
    and b.slot_start >= now()
    and lower(a.area) = lower(p_area)
  group by b.slot_start;
$$;

create or replace function public.create_booking(
  p_task_id uuid,
  p_address_id uuid,
  p_slot_start timestamptz,
  p_is_urgent boolean default false,
  p_description text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.booking_settings;
  task record;
  addr public.addresses;
  local_now timestamp := now() at time zone 'Asia/Kathmandu';
  local_start timestamp;
  start_at timestamptz;
  end_at timestamptz;
  taken integer;
  advance numeric(10, 2);
  fee numeric(10, 2) := 0;
  result public.bookings;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in to book.' using errcode = 'P0001';
  end if;

  select * into settings from public.booking_settings limit 1;

  select st.id, st.price, st.service_id into task
  from public.service_tasks st
  join public.services s on s.id = st.service_id
  where st.id = p_task_id and st.is_active and s.is_active;
  if not found then
    raise exception 'This service is not available right now.' using errcode = 'P0001';
  end if;

  select * into addr from public.addresses
  where id = p_address_id and customer_id = (select auth.uid());
  if not found then
    raise exception 'Please choose one of your addresses.' using errcode = 'P0001';
  end if;

  if length(coalesce(p_description, '')) > 500 then
    raise exception 'Please keep the description under 500 characters.' using errcode = 'P0001';
  end if;

  if p_is_urgent then
    if extract(hour from local_now) < settings.day_start_hour
       or extract(hour from local_now) >= settings.day_end_hour - settings.asap_promise_hours then
      raise exception 'As soon as possible is only available during working hours. Please pick a time slot.'
        using errcode = 'P0001';
    end if;
    if not public.asap_available(task.service_id, addr.area) then
      raise exception 'No professional is free right now. Please pick a time slot.' using errcode = 'P0001';
    end if;
    fee := settings.asap_fee;
    start_at := now();
    end_at := now() + make_interval(hours => settings.asap_promise_hours);
  else
    local_start := p_slot_start at time zone 'Asia/Kathmandu';
    if p_slot_start is null
       or extract(minute from local_start) <> 0
       or extract(second from local_start) <> 0
       or extract(hour from local_start) < settings.day_start_hour
       or extract(hour from local_start) + settings.slot_hours > settings.day_end_hour
       or (extract(hour from local_start)::integer - settings.day_start_hour) % settings.slot_hours <> 0 then
      raise exception 'Please pick one of the listed time slots.' using errcode = 'P0001';
    end if;
    if p_slot_start < now() + make_interval(hours => settings.min_notice_hours) then
      raise exception 'That time is too soon. Please pick a later slot.' using errcode = 'P0001';
    end if;
    if p_slot_start > now() + make_interval(days => settings.days_ahead) then
      raise exception 'That date is too far ahead. Please pick a closer day.' using errcode = 'P0001';
    end if;
    select count(*) into taken
    from public.bookings b
    join public.addresses a on a.id = b.address_id
    where b.slot_start = p_slot_start
      and b.status <> 'cancelled'
      and not b.is_urgent
      and lower(a.area) = lower(addr.area);
    if taken >= settings.slot_capacity then
      raise exception 'That time slot is full. Please pick another.' using errcode = 'P0001';
    end if;
    start_at := p_slot_start;
    end_at := p_slot_start + make_interval(hours => settings.slot_hours);
  end if;

  -- The advance counts towards the bill, so it never exceeds the known total.
  advance := case
    when task.price is null then settings.advance_amount
    else least(settings.advance_amount, task.price + fee)
  end;

  insert into public.bookings (
    customer_id, service_id, task_id, address_id, slot_start, slot_end,
    description, price, deposit_amount, is_urgent, urgent_fee
  ) values (
    (select auth.uid()), task.service_id, task.id, addr.id, start_at, end_at,
    nullif(trim(p_description), ''), task.price, advance, p_is_urgent, fee
  )
  returning * into result;

  return result;
end;
$$;

-- The customer reports the eSewa / Khalti / IME Pay / bank transaction they
-- made for the advance. The team checks it and sets the payment to 'paid'.
-- Sending again replaces a reference that is still being checked.
create or replace function public.submit_advance_payment(
  p_booking_id uuid,
  p_method public.payment_method,
  p_reference text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  existing public.payments;
  result public.payments;
begin
  select * into booking from public.bookings
  where id = p_booking_id and customer_id = (select auth.uid());
  if not found or booking.status <> 'requested' or booking.deposit_amount <= 0 then
    raise exception 'This booking does not need an advance payment.' using errcode = 'P0001';
  end if;
  if p_method = 'cash' then
    raise exception 'The advance is paid online. Please choose eSewa, Khalti, IME Pay or bank.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reference, ''))) not between 4 and 64 then
    raise exception 'Please enter the transaction ID from your payment app.' using errcode = 'P0001';
  end if;

  select * into existing from public.payments
  where booking_id = p_booking_id and kind = 'deposit' and status in ('pending', 'paid')
  order by created_at desc
  limit 1;

  if found and existing.status = 'paid' then
    raise exception 'The advance for this booking is already paid.' using errcode = 'P0001';
  elsif found then
    update public.payments
    set method = p_method, provider_reference = trim(p_reference), created_at = now()
    where id = existing.id
    returning * into result;
  else
    insert into public.payments (booking_id, kind, method, amount, status, provider_reference)
    values (p_booking_id, 'deposit', p_method, booking.deposit_amount, 'pending', trim(p_reference))
    returning * into result;
  end if;

  return result;
end;
$$;

revoke execute on function public.create_booking(uuid, uuid, timestamptz, boolean, text) from public, anon;
revoke execute on function public.submit_advance_payment(uuid, public.payment_method, text) from public, anon;
grant execute on function public.create_booking(uuid, uuid, timestamptz, boolean, text) to authenticated;
grant execute on function public.submit_advance_payment(uuid, public.payment_method, text) to authenticated;
grant execute on function public.asap_available(uuid, text) to anon, authenticated;
grant execute on function public.slot_counts(text) to anon, authenticated;
