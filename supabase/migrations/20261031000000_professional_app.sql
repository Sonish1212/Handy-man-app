-- Professionals get their own side of the app, and jobs reach them without
-- waiting for the team.
--
-- * When the team confirms a booking's advance, the job is offered straight
--   away to every professional who can take it: verified, does that service,
--   works in that area (or anywhere), uses the app, is taking new jobs and is
--   free at that time. The first to accept gets it. The team can still
--   assign someone by hand. The booking's history says who was offered.
-- * When a professional drops a job (or the team removes them), it goes
--   back out the same way, to everyone except them.
-- * my_professional() now also returns what the professional's Profile page
--   shows: phone, area, services, jobs done and rating.

-- ---------------------------------------------------------------------------
-- Automatic offers
-- ---------------------------------------------------------------------------

create or replace function public.auto_offer_job(p_booking_id uuid, p_exclude uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  added integer;
begin
  select * into booking from public.bookings where id = p_booking_id;
  if not found or booking.status <> 'requested' or not public.advance_settled(booking.id) then
    return 0;
  end if;

  insert into public.job_offers (booking_id, professional_id, channel)
  select booking.id, p.id, 'app'
  from public.professionals p
  join public.professional_services ps on ps.professional_id = p.id and ps.service_id = booking.service_id
  join public.addresses a on a.id = booking.address_id
  where p.verification_status = 'verified'
    and p.user_id is not null
    and p.is_available
    and p.id is distinct from p_exclude
    and (p.area is null or lower(p.area) = lower(a.area))
    and not public.professional_is_busy(p.id, booking.id)
    and not exists (
      select 1 from public.job_offers o
      where o.booking_id = booking.id and o.professional_id = p.id and o.response in ('no_reply', 'declined')
    );
  get diagnostics added = row_count;

  perform public.log_booking_note(
    booking.id,
    case when added > 0
      then format('Offered automatically to %s professional%s in the app', added, case when added = 1 then '' else 's' end)
      else 'No free professional with the app for this service and area: assign by hand'
    end
  );
  return added;
end;
$$;

-- A job that lost its professional goes back out to the others.
create or replace function public.reoffer_released_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'requested' and old.status in ('assigned', 'on_the_way') then
    perform public.auto_offer_job(new.id, old.professional_id);
  end if;
  return new;
end;
$$;

create trigger bookings_reoffer_released
  after update of status on public.bookings
  for each row execute function public.reoffer_released_job();

-- Same as before, plus the automatic offer once an advance is confirmed.
create or replace function public.review_payment(p_payment_id uuid, p_approve boolean, p_note text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.payments;
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;

  update public.payments
  set status = case when p_approve then 'paid'::public.payment_status else 'failed'::public.payment_status end,
      paid_at = case when p_approve then now() end
  where id = p_payment_id and status = 'pending'
  returning * into result;

  if result.id is null then
    raise exception 'This payment was already checked.' using errcode = 'P0001';
  end if;

  perform public.log_booking_note(
    result.booking_id,
    format('%s payment %s (%s, ref. %s)%s',
      initcap(result.kind::text),
      case when p_approve then 'confirmed' else 'rejected' end,
      result.method, coalesce(result.provider_reference, '-'),
      case when nullif(trim(p_note), '') is not null then ': ' || trim(p_note) else '' end)
  );

  if p_approve and result.kind = 'deposit' then
    perform public.auto_offer_job(result.booking_id);
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- The professional's own profile
-- ---------------------------------------------------------------------------

drop function if exists public.my_professional();

create function public.my_professional()
returns table (
  id uuid,
  full_name text,
  phone text,
  photo_url text,
  area text,
  is_available boolean,
  verification_status public.verification_status,
  services text[],
  jobs_done integer,
  rating numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.full_name, p.phone, p.photo_url, p.area, p.is_available, p.verification_status,
    coalesce((select array_agg(s.name order by s.sort_order) from public.professional_services ps
      join public.services s on s.id = ps.service_id where ps.professional_id = p.id), '{}'),
    (select count(*)::integer from public.bookings b where b.professional_id = p.id and b.status = 'completed'),
    (select round(avg(r.stars), 1) from public.ratings r
      join public.bookings rb on rb.id = r.booking_id
      where rb.professional_id = p.id and r.rated_by = 'customer')
  from public.professionals p
  where p.id = public.my_professional_id();
$$;

revoke execute on function public.auto_offer_job(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.reoffer_released_job() from public, anon, authenticated;
revoke execute on function public.my_professional() from public, anon;
grant execute on function public.my_professional() to authenticated;
