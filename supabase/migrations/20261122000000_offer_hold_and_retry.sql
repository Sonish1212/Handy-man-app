-- Paid bookings no longer stop when nobody is free.
--
-- Before: when the team confirmed an advance, the job was offered once to
-- the free professionals who match. If nobody matched at that moment, the
-- booking waited until someone on the team noticed it.
--
-- Now: such a booking is "on hold". It is offered again, automatically, to
-- every professional who matches, as soon as something changes that could
-- free someone:
--   * a professional turns "Taking new jobs" on, is approved, gets the app,
--     or has their area changed;
--   * a professional gets a new service;
--   * a professional's job is cancelled, finished or handed back, so they
--     are free at that time again.
-- The team still sees on-hold bookings (urgent 2 hours before the time, in
-- the app) and can offer or assign by hand at any time.

begin;

-- The same rules as before. p_quiet: retries write a note only when they
-- actually offer the job, so the booking's history is not filled with
-- "nobody is free" every time someone changes their availability.
drop function if exists public.auto_offer_job(uuid, uuid);

create or replace function public.auto_offer_job(p_booking_id uuid, p_exclude uuid default null, p_quiet boolean default false)
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

  if added > 0 then
    perform public.log_booking_note(
      booking.id,
      format('Offered automatically to %s professional%s in the app%s', added,
             case when added = 1 then '' else 's' end,
             case when p_quiet then ' (someone became free)' else '' end)
    );
  elsif not p_quiet then
    perform public.log_booking_note(
      booking.id,
      'No free professional with the app for this service and area. On hold: it will be offered '
      || 'automatically when someone becomes free. Offer or assign by hand if it is urgent.'
    );
  end if;
  return added;
end;
$$;

-- Offers every paid booking that is still waiting (and whose time has not
-- passed) to whoever matches now. Returns how many offers were made.
create or replace function public.retry_waiting_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting record;
  total integer := 0;
begin
  for waiting in
    select b.id from public.bookings b
    where b.status = 'requested' and b.slot_end > now()
    order by b.is_urgent desc, b.slot_start
  loop
    total := total + public.auto_offer_job(waiting.id, null, true);
  end loop;
  return total;
end;
$$;

-- A professional who could take jobs now, or in more places, than before.
create or replace function public.retry_after_professional_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status = 'verified' and new.is_available and new.user_id is not null
     and (old.verification_status is distinct from new.verification_status
          or old.is_available is distinct from new.is_available
          or old.user_id is distinct from new.user_id
          or old.area is distinct from new.area) then
    perform public.retry_waiting_bookings();
  end if;
  return null;
end;
$$;

drop trigger if exists professionals_retry_waiting on public.professionals;
create trigger professionals_retry_waiting
  after update of verification_status, is_available, user_id, area on public.professionals
  for each row execute function public.retry_after_professional_change();

-- A professional who does a new service.
create or replace function public.retry_after_new_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.retry_waiting_bookings();
  return null;
end;
$$;

drop trigger if exists professional_services_retry_waiting on public.professional_services;
create trigger professional_services_retry_waiting
  after insert on public.professional_services
  for each statement execute function public.retry_after_new_service();

-- A job that ended or was handed back frees its professional for that time.
-- Handing back also counts as saying no, so the same person is not offered
-- the job again (when the team had assigned it directly there is no offer
-- to mark yet, so one is written).
create or replace function public.retry_after_job_freed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.professional_id is not null
     and old.status in ('assigned', 'on_the_way', 'in_progress')
     and new.status not in ('assigned', 'on_the_way', 'in_progress') then
    if new.status = 'requested' and not exists (
      select 1 from public.job_offers o
      where o.booking_id = new.id and o.professional_id = old.professional_id and o.response = 'declined'
    ) then
      insert into public.job_offers (booking_id, professional_id, channel, response, responded_at)
      values (new.id, old.professional_id, 'app', 'declined', now());
    end if;
    perform public.retry_waiting_bookings();
  end if;
  return null;
end;
$$;

-- Named to run after bookings_reoffer_released, which offers a handed-back
-- job to everyone except the person who handed it back.
drop trigger if exists bookings_zz_retry_waiting on public.bookings;
create trigger bookings_zz_retry_waiting
  after update of status on public.bookings
  for each row execute function public.retry_after_job_freed();

revoke execute on function public.auto_offer_job(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.retry_waiting_bookings() from public, anon, authenticated;
revoke execute on function public.retry_after_professional_change() from public, anon, authenticated;
revoke execute on function public.retry_after_new_service() from public, anon, authenticated;
revoke execute on function public.retry_after_job_freed() from public, anon, authenticated;

-- Bookings that were already waiting when this runs get one try now.
select public.retry_waiting_bookings();

commit;
