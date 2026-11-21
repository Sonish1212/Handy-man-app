-- Milestone 2: getting a professional to the house.
--
-- * Status rules: a booking only moves along
--     requested -> assigned -> on_the_way -> in_progress -> completed
--   (or is cancelled before the work starts). A trigger checks every change,
--   whoever makes it, and stamps the time of each step.
-- * The team (profiles.role = 'admin') checks advance payments, offers jobs,
--   assigns professionals and can act for professionals who only use SMS.
-- * Professionals with a smartphone sign in with their own phone number.
--   They see job offers (area and time only), accept them, and move their own
--   jobs along. They never read tables directly, only through the functions
--   below, so they cannot see other jobs or the customer's start code.
-- * "Started" needs the customer's 4-digit start code; after 5 wrong tries
--   the professional has to call the team.
--
-- To fix a mistake by hand in the SQL Editor (for example re-open a job
-- that was marked done by accident), run:
--   begin;
--   set local app.allow_status_fix = 'on';
--   update public.bookings set status = '...' where id = '...';
--   commit;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

-- An offer the team took back, or that closed because someone else got the job.
alter type public.offer_response add value if not exists 'withdrawn';

alter table public.bookings
  add column on_the_way_at timestamptz,
  add column start_code_attempts smallint not null default 0;

create index job_offers_professional_idx on public.job_offers (professional_id, response);
create index payments_status_idx on public.payments (status) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The professional record of the signed-in user, if they are one (and not
-- suspended).
create or replace function public.my_professional_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.professionals
  where user_id = (select auth.uid()) and verification_status <> 'suspended';
$$;

-- When a job keeps the professional busy: the booked slot, or longer for
-- long tasks such as a full day of painting.
create or replace function public.job_window(p_start timestamptz, p_end timestamptz, p_task_id uuid)
returns tstzrange
language sql
stable
set search_path = ''
as $$
  select tstzrange(
    p_start,
    greatest(
      p_end,
      p_start + make_interval(mins => coalesce(
        (select t.duration_minutes from public.service_tasks t where t.id = p_task_id), 0))
    )
  );
$$;

-- Does this professional already have a job at the same time as this booking?
create or replace function public.professional_is_busy(p_professional_id uuid, p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    join public.bookings other
      on other.professional_id = p_professional_id
     and other.id <> b.id
     and other.status in ('assigned', 'on_the_way', 'in_progress')
    where b.id = p_booking_id
      and (
        public.job_window(other.slot_start, other.slot_end, other.task_id)
          && public.job_window(b.slot_start, b.slot_end, b.task_id)
        -- Someone already out on a job cannot take an urgent one right now.
        or (b.is_urgent and other.status in ('on_the_way', 'in_progress'))
      )
  );
$$;

-- Is the advance paid (or not needed)? Jobs are only offered after that.
create or replace function public.advance_settled(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select b.deposit_amount <= 0
    or exists (
      select 1 from public.payments p
      where p.booking_id = b.id and p.kind = 'deposit' and p.status = 'paid'
    )
  from public.bookings b
  where b.id = p_booking_id;
$$;

-- A note in the booking's history. Notes have no status, so customers never
-- see them (see "customers read status history of own bookings").
create or replace function public.log_booking_note(p_booking_id uuid, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.booking_events (booking_id, note, actor_id)
  values (p_booking_id, p_note, (select auth.uid()));
$$;

-- Loads a booking the caller may work on (the team, or its assigned
-- professional) and locks it so two people cannot change it at once.
create or replace function public.lock_job(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.bookings;
begin
  select * into result from public.bookings where id = p_booking_id for update;
  if not found
     or not (public.is_admin() or coalesce(result.professional_id = public.my_professional_id(), false)) then
    raise exception 'Job not found.' using errcode = 'P0001';
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status rules
-- ---------------------------------------------------------------------------

create or replace function public.check_booking_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  fixing boolean := coalesce(current_setting('app.allow_status_fix', true), '') = 'on';
  allowed boolean;
begin
  if new.status is distinct from old.status and not fixing then
    allowed := case old.status
      when 'requested' then new.status in ('assigned', 'cancelled')
      -- Back to 'requested' when a professional drops out. A professional
      -- who arrives without tapping "On the way" can still start.
      when 'assigned' then new.status in ('requested', 'on_the_way', 'in_progress', 'cancelled')
      when 'on_the_way' then new.status in ('requested', 'in_progress', 'cancelled')
      when 'in_progress' then new.status = 'completed'
      else false
    end;
    if not allowed then
      raise exception 'A booking cannot go from % to %.', old.status, new.status using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'requested' then
    new.professional_id := null;
    new.assigned_at := null;
    new.on_the_way_at := null;
  elsif new.status in ('assigned', 'on_the_way', 'in_progress', 'completed') and new.professional_id is null then
    raise exception 'Assign a professional first.' using errcode = 'P0001';
  end if;

  if new.professional_id is distinct from old.professional_id
     and old.status in ('on_the_way', 'in_progress', 'completed')
     and new.status <> 'requested'
     and not fixing then
    raise exception 'The professional cannot be changed once they have set off.' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'assigned' then new.assigned_at := now();
      when 'on_the_way' then new.on_the_way_at := now();
      when 'in_progress' then new.started_at := now();
      when 'completed' then new.completed_at := now();
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now());
      else null;
    end case;
  elsif new.professional_id is distinct from old.professional_id then
    new.assigned_at := now();
  end if;

  return new;
end;
$$;

create trigger bookings_check_status
  before update on public.bookings
  for each row execute function public.check_booking_status_change();

-- Once a booking has a professional or is cancelled, open offers close: the
-- one for the chosen professional counts as accepted, the rest are withdrawn.
create or replace function public.close_job_offers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'requested' and old.status = 'requested' then
    update public.job_offers
    set response = case
          when professional_id = new.professional_id then 'accepted'::public.offer_response
          else 'withdrawn'::public.offer_response
        end,
        responded_at = now()
    where booking_id = new.id and response = 'no_reply';
  end if;
  return new;
end;
$$;

create trigger bookings_close_offers
  after update of status on public.bookings
  for each row execute function public.close_job_offers();

-- ---------------------------------------------------------------------------
-- Team: payments and dispatch
-- ---------------------------------------------------------------------------

-- Confirms or rejects a payment the customer reported (advance or an online
-- balance) after checking the eSewa / Khalti / bank statement.
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
  return result;
end;
$$;

-- Verified professionals who do this job, best matches first, with what the
-- team needs to choose: same area, free at that time, rating, reliability.
create or replace function public.dispatch_candidates(p_booking_id uuid)
returns table (
  professional_id uuid,
  full_name text,
  phone text,
  photo_url text,
  area text,
  has_app boolean,
  is_available boolean,
  area_match boolean,
  busy boolean,
  jobs_done integer,
  rating numeric,
  late_cancellations integer,
  offer_response public.offer_response
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.phone,
    p.photo_url,
    p.area,
    p.user_id is not null,
    p.is_available,
    p.area is null or lower(p.area) = lower(a.area),
    public.professional_is_busy(p.id, b.id),
    (select count(*)::integer from public.bookings done
      where done.professional_id = p.id and done.status = 'completed'),
    (select round(avg(r.stars), 1) from public.ratings r
      join public.bookings rb on rb.id = r.booking_id
      where rb.professional_id = p.id and r.rated_by = 'customer'),
    p.late_cancellations,
    (select o.response from public.job_offers o
      where o.booking_id = b.id and o.professional_id = p.id
      order by o.sent_at desc limit 1)
  from public.bookings b
  join public.addresses a on a.id = b.address_id
  join public.professional_services ps on ps.service_id = b.service_id
  join public.professionals p on p.id = ps.professional_id
  where b.id = p_booking_id
    and p.verification_status = 'verified'
  -- Same area first, then those who work anywhere; free before busy.
  order by (lower(p.area) = lower(a.area)) is true desc, p.area is null desc, 9 asc, 7 desc, 11 desc nulls last, 12 asc, 2;
end;
$$;

-- Gives the job straight to one professional (after agreeing it by phone),
-- or swaps the professional before they set off.
create or replace function public.assign_professional(p_booking_id uuid, p_professional_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  pro public.professionals;
  result public.bookings;
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;

  select * into booking from public.bookings where id = p_booking_id for update;
  if not found or booking.status not in ('requested', 'assigned') then
    raise exception 'This booking can no longer be assigned.' using errcode = 'P0001';
  end if;
  if not public.advance_settled(booking.id) then
    raise exception 'The advance is not confirmed yet.' using errcode = 'P0001';
  end if;

  select p.* into pro
  from public.professionals p
  join public.professional_services ps on ps.professional_id = p.id and ps.service_id = booking.service_id
  where p.id = p_professional_id and p.verification_status = 'verified';
  if not found then
    raise exception 'This professional is not verified for this service.' using errcode = 'P0001';
  end if;
  if public.professional_is_busy(pro.id, booking.id) then
    raise exception '% already has a job at this time.', pro.full_name using errcode = 'P0001';
  end if;

  if booking.professional_id is not null and booking.professional_id <> pro.id then
    perform public.log_booking_note(booking.id, 'Professional changed to ' || pro.full_name);
  end if;

  update public.bookings
  set professional_id = pro.id, status = 'assigned'
  where id = booking.id
  returning * into result;
  return result;
end;
$$;

-- Offers the job to several professionals at once (used for ASAP). Those
-- with the app see it under Job offers; the team calls or texts the rest.
-- The first to accept gets the job. Returns how many new offers were made.
create or replace function public.send_job_offers(p_booking_id uuid, p_professional_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  added integer;
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;

  select * into booking from public.bookings where id = p_booking_id for update;
  if not found or booking.status <> 'requested' then
    raise exception 'This booking is no longer waiting for a professional.' using errcode = 'P0001';
  end if;
  if not public.advance_settled(booking.id) then
    raise exception 'The advance is not confirmed yet.' using errcode = 'P0001';
  end if;

  insert into public.job_offers (booking_id, professional_id, channel)
  select booking.id, p.id, case when p.user_id is not null then 'app'::public.offer_channel else 'sms'::public.offer_channel end
  from public.professionals p
  join public.professional_services ps on ps.professional_id = p.id and ps.service_id = booking.service_id
  where p.id = any (p_professional_ids)
    and p.verification_status = 'verified'
    and not public.professional_is_busy(p.id, booking.id)
    and not exists (
      select 1 from public.job_offers o
      where o.booking_id = booking.id and o.professional_id = p.id and o.response = 'no_reply'
    );
  get diagnostics added = row_count;
  return added;
end;
$$;

-- Takes back every open offer on a booking (for example to offer it to
-- someone else by phone).
create or replace function public.withdraw_job_offers(p_booking_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed integer;
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;
  update public.job_offers
  set response = 'withdrawn', responded_at = now()
  where booking_id = p_booking_id and response = 'no_reply';
  get diagnostics closed = row_count;
  return closed;
end;
$$;

create or replace function public.team_cancel_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.bookings;
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please write why the booking is cancelled.' using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_by = 'admin', cancel_reason = trim(p_reason)
  where id = p_booking_id and status in ('requested', 'assigned', 'on_the_way')
  returning * into result;
  if result.id is null then
    raise exception 'This booking can no longer be cancelled.' using errcode = 'P0001';
  end if;
  return result;
end;
$$;

create or replace function public.add_team_note(p_booking_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_note, ''))) not between 2 and 500 then
    raise exception 'Please write a note under 500 characters.' using errcode = 'P0001';
  end if;
  perform public.log_booking_note(p_booking_id, trim(p_note));
end;
$$;

-- ---------------------------------------------------------------------------
-- Professionals (and the team acting for them)
-- ---------------------------------------------------------------------------

-- Accept or decline an offer. Returns 'assigned', 'declined' or 'taken'
-- (someone else was quicker, or the booking was cancelled).
create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer public.job_offers;
  booking public.bookings;
begin
  select * into offer from public.job_offers where id = p_offer_id;
  if not found or not (public.is_admin() or coalesce(offer.professional_id = public.my_professional_id(), false)) then
    raise exception 'Job offer not found.' using errcode = 'P0001';
  end if;

  -- Lock the booking first so two professionals accepting at once cannot
  -- both get it.
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

  if booking.status <> 'requested' or public.professional_is_busy(offer.professional_id, booking.id) then
    update public.job_offers set response = 'withdrawn', responded_at = now() where id = offer.id;
    return 'taken';
  end if;

  update public.bookings
  set professional_id = offer.professional_id, status = 'assigned'
  where id = booking.id;
  return 'assigned';
end;
$$;

create or replace function public.mark_on_the_way(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings := public.lock_job(p_booking_id);
  result public.bookings;
begin
  if booking.status <> 'assigned' then
    raise exception 'This job is not waiting to set off.' using errcode = 'P0001';
  end if;
  update public.bookings set status = 'on_the_way' where id = booking.id returning * into result;
  return result;
end;
$$;

-- The professional types the code the customer reads out. Returns
-- 'started', 'wrong_code' or 'locked' (5 wrong tries: call the team).
-- Wrong tries are only counted for professionals; the team enters the code
-- a professional reads to them over the phone.
create or replace function public.start_job(p_booking_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings := public.lock_job(p_booking_id);
  team boolean := public.is_admin();
begin
  if booking.status not in ('assigned', 'on_the_way') then
    raise exception 'This job cannot be started now.' using errcode = 'P0001';
  end if;
  if not team and booking.start_code_attempts >= 5 then
    return 'locked';
  end if;

  if trim(coalesce(p_code, '')) <> booking.start_code then
    if not team then
      update public.bookings set start_code_attempts = start_code_attempts + 1 where id = booking.id;
    end if;
    return case when not team and booking.start_code_attempts + 1 >= 5 then 'locked' else 'wrong_code' end;
  end if;

  update public.bookings set status = 'in_progress', start_code_attempts = 0 where id = booking.id;
  return 'started';
end;
$$;

-- The professional asks for a part the job needs; nothing is charged unless
-- the customer approves it in their app.
create or replace function public.request_extra_part(p_booking_id uuid, p_description text, p_amount numeric)
returns public.extra_parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings := public.lock_job(p_booking_id);
  result public.extra_parts;
begin
  if booking.status not in ('assigned', 'on_the_way', 'in_progress') then
    raise exception 'Parts can only be added to an active job.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_description, ''))) not between 2 and 120 then
    raise exception 'Please describe the part in a few words.' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'Please enter the part price in rupees.' using errcode = 'P0001';
  end if;

  insert into public.extra_parts (booking_id, description, amount)
  values (booking.id, trim(p_description), round(p_amount, 2))
  returning * into result;
  return result;
end;
$$;

-- Marks the job done and records how the rest of the bill was paid: cash
-- to the professional counts as paid; an online payment waits for the team
-- to check it. p_price is the agreed price for jobs that had none (visit and
-- quote, "Something else"); only the team can change a set price.
create or replace function public.complete_job(
  p_booking_id uuid,
  p_price numeric default null,
  p_balance_method public.payment_method default null,
  p_balance_reference text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings := public.lock_job(p_booking_id);
  final_price numeric(10, 2);
  parts numeric(10, 2);
  paid numeric(10, 2);
  balance numeric(10, 2);
  result public.bookings;
begin
  if booking.status <> 'in_progress' then
    raise exception 'Only a started job can be marked done.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.extra_parts where booking_id = booking.id and status = 'pending') then
    raise exception 'The customer has not answered about an extra part yet.' using errcode = 'P0001';
  end if;

  final_price := case
    when booking.price is null or (p_price is not null and public.is_admin()) then p_price
    else booking.price
  end;
  if final_price is null or final_price < 0 or final_price > 1000000 then
    raise exception 'Please enter the agreed price for this job.' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into parts
  from public.extra_parts where booking_id = booking.id and status = 'approved';
  select coalesce(sum(amount), 0) into paid
  from public.payments where booking_id = booking.id and status = 'paid' and kind in ('deposit', 'balance', 'extra_parts');
  balance := final_price + booking.urgent_fee + parts - paid;

  if balance > 0 then
    if p_balance_method is null then
      raise exception 'Please choose how the customer paid the rest.' using errcode = 'P0001';
    end if;
    if p_balance_method <> 'cash' and length(trim(coalesce(p_balance_reference, ''))) not between 4 and 64 then
      raise exception 'Please enter the transaction ID of the online payment.' using errcode = 'P0001';
    end if;
    insert into public.payments (booking_id, kind, method, amount, status, provider_reference, paid_at)
    values (
      booking.id, 'balance', p_balance_method, balance,
      case when p_balance_method = 'cash' then 'paid'::public.payment_status else 'pending'::public.payment_status end,
      nullif(trim(p_balance_reference), ''),
      case when p_balance_method = 'cash' then now() end
    );
  elsif balance < 0 then
    perform public.log_booking_note(booking.id, format('Advance is Rs %s more than the bill: refund due', -balance));
  end if;

  update public.bookings set status = 'completed', price = final_price where id = booking.id returning * into result;
  return result;
end;
$$;

-- A professional drops a job (or the team takes it off them) before the
-- work starts. The booking goes back to "Finding a professional". Dropping
-- within the free-cancellation window counts as a late cancellation.
create or replace function public.release_job(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings := public.lock_job(p_booking_id);
  settings public.booking_settings;
  pro_name text;
  result public.bookings;
begin
  if booking.status not in ('assigned', 'on_the_way') then
    raise exception 'This job cannot be handed back now.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please write why.' using errcode = 'P0001';
  end if;

  select * into settings from public.booking_settings limit 1;
  select full_name into pro_name from public.professionals where id = booking.professional_id;

  if not public.is_admin()
     and booking.slot_start - now() < make_interval(hours => settings.free_cancel_hours) then
    update public.professionals set late_cancellations = late_cancellations + 1 where id = booking.professional_id;
  end if;

  update public.job_offers set response = 'declined', responded_at = now()
  where booking_id = booking.id and professional_id = booking.professional_id and response = 'accepted';

  perform public.log_booking_note(booking.id, format('%s removed from the job: %s', pro_name, trim(p_reason)));
  update public.bookings set status = 'requested' where id = booking.id returning * into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- What a professional sees in the app
-- ---------------------------------------------------------------------------

create or replace function public.my_professional()
returns table (id uuid, full_name text, is_available boolean, verification_status public.verification_status)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.is_available, p.verification_status
  from public.professionals p
  where p.id = public.my_professional_id();
$$;

create or replace function public.set_my_availability(p_available boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.professionals set is_available = p_available where id = public.my_professional_id();
  if not found then
    raise exception 'Only professionals can do this.' using errcode = 'P0001';
  end if;
  return p_available;
end;
$$;

-- Open offers: only the job, area and time. The address and customer details
-- are shown once the professional has accepted.
create or replace function public.my_job_offers()
returns table (
  offer_id uuid,
  booking_id uuid,
  sent_at timestamptz,
  slot_start timestamptz,
  slot_end timestamptz,
  is_urgent boolean,
  service_name text,
  task_name text,
  task_name_ne text,
  description text,
  area text,
  price numeric,
  urgent_fee numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, b.id, o.sent_at, b.slot_start, b.slot_end, b.is_urgent, s.name, t.name, t.name_ne,
         b.description, a.area, b.price, b.urgent_fee
  from public.job_offers o
  join public.bookings b on b.id = o.booking_id
  join public.services s on s.id = b.service_id
  left join public.service_tasks t on t.id = b.task_id
  join public.addresses a on a.id = b.address_id
  where o.professional_id = public.my_professional_id()
    and o.response = 'no_reply'
    and b.status = 'requested'
  order by b.is_urgent desc, b.slot_start;
$$;

-- The professional's own jobs: active ones with the address and customer
-- contact, plus the last 30 days of finished ones without them. Never the
-- start code.
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
  extra_parts jsonb
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
      from public.extra_parts x where x.booking_id = b.id), '[]'::jsonb)
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

-- ---------------------------------------------------------------------------
-- Linking professional accounts
-- ---------------------------------------------------------------------------

-- Phone numbers compared by digits only, without Nepal's +977, so
-- "+977 98XXXXXXXX" and "98XXXXXXXX" match.
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '^977(\d{10})$', '\1'), '');
$$;

-- Links a professional record to the account that signed in with the same
-- phone number (proved by the SMS code). Never links one account to two
-- professionals, and never fails a sign-in.
create or replace function public.link_professional_account(p_user_id uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.normalize_phone(p_phone) is null
     or exists (select 1 from public.professionals where user_id = p_user_id) then
    return;
  end if;
  update public.professionals
  set user_id = p_user_id
  where id = (
    select id from public.professionals
    where user_id is null and public.normalize_phone(phone) = public.normalize_phone(p_phone)
    limit 1
  );
end;
$$;

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
  if new.phone_confirmed_at is not null then
    perform public.link_professional_account(new.id, new.phone);
  end if;
  return new;
end;
$$;

-- Phone sign-ups confirm the number after the user is created, so link then.
create or replace function public.link_professional_on_phone_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone_confirmed_at is not null
     and (old.phone_confirmed_at is null or new.phone is distinct from old.phone) then
    perform public.link_professional_account(new.id, new.phone);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_phone_confirmed
  after update of phone, phone_confirmed_at on auth.users
  for each row execute function public.link_professional_on_phone_confirm();

-- Professionals who already signed in before this change.
do $$
declare
  u record;
begin
  for u in select id, phone from auth.users where phone_confirmed_at is not null and coalesce(phone, '') <> '' loop
    perform public.link_professional_account(u.id, u.phone);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

revoke execute on function public.check_booking_status_change() from public, anon, authenticated;
revoke execute on function public.close_job_offers() from public, anon, authenticated;
revoke execute on function public.link_professional_on_phone_confirm() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.link_professional_account(uuid, text) from public, anon, authenticated;
revoke execute on function public.log_booking_note(uuid, text) from public, anon, authenticated;
revoke execute on function public.lock_job(uuid) from public, anon, authenticated;
revoke execute on function public.professional_is_busy(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.advance_settled(uuid) from public, anon, authenticated;
revoke execute on function public.job_window(timestamptz, timestamptz, uuid) from public, anon;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.my_professional_id()',
    'public.review_payment(uuid, boolean, text)',
    'public.dispatch_candidates(uuid)',
    'public.assign_professional(uuid, uuid)',
    'public.send_job_offers(uuid, uuid[])',
    'public.withdraw_job_offers(uuid)',
    'public.team_cancel_booking(uuid, text)',
    'public.add_team_note(uuid, text)',
    'public.respond_to_offer(uuid, boolean)',
    'public.mark_on_the_way(uuid)',
    'public.start_job(uuid, text)',
    'public.request_extra_part(uuid, text, numeric)',
    'public.complete_job(uuid, numeric, public.payment_method, text)',
    'public.release_job(uuid, text)',
    'public.my_professional()',
    'public.set_my_availability(boolean)',
    'public.my_job_offers()',
    'public.my_jobs()'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
