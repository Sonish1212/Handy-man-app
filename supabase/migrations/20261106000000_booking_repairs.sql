-- Repairs to existing booking/dispatch rules. No new booking states or fees.
-- Run after 20261031000000_professional_app.sql.
-- A transaction-wide scheduling lock closes the check-then-write races in
-- the pilot's existing capacity and professional overlap checks. This
-- intentionally serializes scheduling writes; replace with scoped resource
-- locks when dispatch volume warrants it, preserving all invariants.

begin;

create or replace function public.enforce_booking_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  settings public.booking_settings;
  area_name text;
  taken integer;
  changed_assignment boolean;
begin
  perform pg_advisory_xact_lock(58061106);
  select * into settings from public.booking_settings where id = true;
  if not found then raise exception 'Booking settings are unavailable. Please contact the team.' using errcode = 'P0001'; end if;

  if tg_op = 'INSERT' then
    changed_assignment := new.professional_id is not null;
  else
    changed_assignment := new.professional_id is distinct from old.professional_id
      or (new.status = 'assigned' and old.status <> 'assigned');
  end if;

  -- Count again after obtaining the lock, rather than trusting the count in
  -- create_booking() which may have run concurrently with another caller.
  if not new.is_urgent and new.status <> 'cancelled' then
    if tg_op = 'INSERT' or new.slot_start is distinct from old.slot_start
       or new.address_id is distinct from old.address_id
       or old.status = 'cancelled' then
      select area into area_name from public.addresses where id = new.address_id;
      select count(*) into taken from public.bookings b
      join public.addresses a on a.id = b.address_id
      where b.id <> new.id and b.slot_start = new.slot_start
        and b.status <> 'cancelled' and not b.is_urgent
        and lower(trim(a.area)) = lower(trim(area_name));
      if taken >= settings.slot_capacity then
        raise exception 'That time slot is full. Please pick another.' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if changed_assignment and new.status in ('assigned', 'on_the_way', 'in_progress') then
    if not exists (select 1 from public.professionals p
      join public.professional_services ps on ps.professional_id = p.id
      where p.id = new.professional_id and p.verification_status = 'verified'
        and ps.service_id = new.service_id) then
      raise exception 'This professional is not verified for this service.' using errcode = 'P0001';
    end if;
    if not public.advance_settled(new.id) then
      raise exception 'The advance is not confirmed yet.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.bookings b
      where b.id <> new.id and b.professional_id = new.professional_id
        and b.status in ('assigned', 'on_the_way', 'in_progress')
        and (public.job_window(b.slot_start, b.slot_end, b.task_id)
              && public.job_window(new.slot_start, new.slot_end, new.task_id)
             or (new.is_urgent and b.status in ('on_the_way', 'in_progress')))) then
      raise exception 'This professional already has a job at this time.' using errcode = 'P0001';
    end if;
    new.start_code_attempts := 0;
  end if;
  return new;
end;
$$;

-- Alphabetical ordering puts this after bookings_check_status.
create or replace trigger bookings_zz_integrity before insert or update on public.bookings
for each row execute function public.enforce_booking_integrity();
revoke execute on function public.enforce_booking_integrity() from public, anon, authenticated;

create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  offer public.job_offers;
  booking public.bookings;
  pro public.professionals;
  area_name text;
begin
  if p_accept is null then raise exception 'Please accept or decline the offer.' using errcode = 'P0001'; end if;
  select * into offer from public.job_offers where id = p_offer_id;
  if not found or not (public.is_admin() or coalesce(offer.professional_id = public.my_professional_id(), false)) then
    raise exception 'Job offer not found.' using errcode = 'P0001';
  end if;
  select * into booking from public.bookings where id = offer.booking_id for update;
  select * into offer from public.job_offers where id = p_offer_id for update;
  if offer.response <> 'no_reply' then
    return case when offer.response = 'accepted' and booking.professional_id = offer.professional_id
      then 'assigned' else 'taken' end;
  end if;
  if not p_accept then
    update public.job_offers set response = 'declined', responded_at = now() where id = offer.id;
    return 'declined';
  end if;
  select * into pro from public.professionals where id = offer.professional_id;
  select area into area_name from public.addresses where id = booking.address_id;
  -- Recheck the offer at acceptance: a worker may have become unavailable
  -- or lost their verification/service since it was sent.
  if booking.status <> 'requested' or not public.advance_settled(booking.id)
     or pro.verification_status <> 'verified' or not pro.is_available
     or not exists (select 1 from public.professional_services
       where professional_id = pro.id and service_id = booking.service_id)
     or (not public.is_admin() and pro.user_id is distinct from auth.uid())
     or public.professional_is_busy(pro.id, booking.id) then
    update public.job_offers set response = 'withdrawn', responded_at = now() where id = offer.id;
    return 'taken';
  end if;
  update public.bookings set professional_id = pro.id, status = 'assigned' where id = booking.id;
  return 'assigned';
end;
$$;
revoke execute on function public.respond_to_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;

create or replace function public.submit_advance_payment(
  p_booking_id uuid, p_method public.payment_method, p_reference text
)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  booking public.bookings;
  existing public.payments;
  result public.payments;
begin
  -- The parent booking is the shared lock for concurrent reports. A retry
  -- updates the one pending deposit instead of creating a second deposit.
  select * into booking from public.bookings
  where id = p_booking_id and customer_id = auth.uid() for update;
  if not found or booking.status <> 'requested' or booking.deposit_amount <= 0 then
    raise exception 'This booking does not need an advance payment.' using errcode = 'P0001';
  end if;
  if p_method is null or p_method = 'cash' then
    raise exception 'The advance is paid online. Please choose eSewa, Khalti, IME Pay or bank.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reference, ''))) not between 4 and 64 then
    raise exception 'Please enter the transaction ID from your payment app.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where booking_id = p_booking_id and kind = 'deposit' and status = 'paid') then
    raise exception 'The advance for this booking is already paid.' using errcode = 'P0001';
  end if;
  select * into existing from public.payments
  where booking_id = p_booking_id and kind = 'deposit' and status = 'pending'
  order by created_at desc limit 1 for update;
  if found then
    update public.payments set method = p_method, provider_reference = trim(p_reference), created_at = now()
    where id = existing.id returning * into result;
  else
    insert into public.payments (booking_id, kind, method, amount, status, provider_reference)
    values (p_booking_id, 'deposit', p_method, booking.deposit_amount, 'pending', trim(p_reference))
    returning * into result;
  end if;
  return result;
end;
$$;
revoke execute on function public.submit_advance_payment(uuid, public.payment_method, text) from public, anon;
grant execute on function public.submit_advance_payment(uuid, public.payment_method, text) to authenticated;

-- ASAP must exclude professionals already travelling/working, not just
-- check their manually chosen availability switch.
create or replace function public.asap_available(p_service_id uuid, p_area text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.professionals p
    join public.professional_services ps on ps.professional_id = p.id
    where ps.service_id = p_service_id and p.is_available and p.verification_status = 'verified'
      and (p.area is null or lower(trim(p.area)) = lower(trim(p_area)))
      and not exists (select 1 from public.bookings b
        where b.professional_id = p.id and b.status in ('assigned', 'on_the_way', 'in_progress')
          and (b.status in ('on_the_way', 'in_progress') or
            public.job_window(b.slot_start, b.slot_end, b.task_id) && tstzrange(now(), now() + make_interval(hours => (select asap_promise_hours from public.booking_settings where id = true))))));
$$;
revoke execute on function public.asap_available(uuid, text) from public;
grant execute on function public.asap_available(uuid, text) to anon, authenticated;

-- Earnings must count jobs by completion date, not their arrival window.
drop function public.my_jobs();
create or replace function public.my_jobs()
returns table (
  booking_id uuid,
  status public.booking_status,
  slot_start timestamptz,
  slot_end timestamptz,
  is_urgent boolean,
  service_name text,
  task_name text,
  task_name_ne text,
  description text,
  area text,
  landmark text,
  address_details text,
  customer_name text,
  customer_phone text,
  price numeric,
  urgent_fee numeric,
  paid numeric,
  start_locked boolean,
  extra_parts jsonb,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id, b.status, b.slot_start, b.slot_end, b.is_urgent, s.name, t.name, t.name_ne, b.description,
    a.area,
    case when active then a.landmark end,
    case when active then a.details end,
    case when active then c.full_name end,
    case when active then c.phone end,
    b.price, b.urgent_fee,
    (select coalesce(sum(p.amount), 0) from public.payments p
      where p.booking_id = b.id and p.status = 'paid' and p.kind in ('deposit', 'balance', 'extra_parts')),
    b.start_code_attempts >= 5,
    coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'description', x.description, 'amount', x.amount, 'status', x.status) order by x.created_at)
      from public.extra_parts x where x.booking_id = b.id), '[]'::jsonb),
    b.completed_at
  from public.bookings b
  cross join lateral (select b.status in ('assigned', 'on_the_way', 'in_progress') as active) flags
  join public.services s on s.id = b.service_id
  left join public.service_tasks t on t.id = b.task_id
  join public.addresses a on a.id = b.address_id
  join public.profiles c on c.id = b.customer_id
  where b.professional_id = public.my_professional_id()
    and (active or (b.status = 'completed' and b.completed_at > now() - interval '30 days'))
  order by active desc, b.slot_start;
$$;
revoke execute on function public.my_jobs() from public, anon;
grant execute on function public.my_jobs() to authenticated;

commit;
