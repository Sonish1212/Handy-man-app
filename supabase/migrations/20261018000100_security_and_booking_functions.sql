-- Row level security and the functions customers call from the app.
--
-- Rules of thumb:
-- * Anyone (even signed out) can read active services and promos.
-- * Customers only ever see their own profile, addresses and bookings, and
--   the professional assigned to one of their bookings.
-- * Customers never update bookings directly. They call cancel_booking()
--   and decide_extra_part(), which check the rules first.
-- * Admins (profiles.role = 'admin') can read and change everything.
--   The Supabase dashboard bypasses RLS, so the team can also dispatch jobs
--   from the Table Editor during the pilot.
-- * Professionals currently work by SMS and phone, so they have no app
--   access yet. Add policies for them when a professional app exists, and
--   never let them read bookings.start_code.

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_private enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.promos enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.job_offers enable row level security;
alter table public.extra_parts enable row level security;
alter table public.payments enable row level security;
alter table public.ratings enable row level security;

-- ---------------------------------------------------------------------------
-- Admin: full access everywhere
-- ---------------------------------------------------------------------------

create policy "admins manage profiles" on public.profiles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage addresses" on public.addresses
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage professionals" on public.professionals
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage professional_private" on public.professional_private
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage services" on public.services
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage professional_services" on public.professional_services
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage promos" on public.promos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage bookings" on public.bookings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage booking_events" on public.booking_events
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage job_offers" on public.job_offers
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage extra_parts" on public.extra_parts
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage payments" on public.payments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage ratings" on public.ratings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Public catalogue
-- ---------------------------------------------------------------------------

create policy "anyone reads active services" on public.services
  for select to anon, authenticated
  using (is_active);

create policy "anyone reads live promos" on public.promos
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create policy "customers read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "customers update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Customers may change their name, but not their role or phone number.
-- Runs as the caller (not security definer) so current_user tells us whether
-- the change came from the app ('authenticated') or the dashboard.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() and current_user = 'authenticated' then
    new.role := old.role;
    new.phone := old.phone;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create policy "customers manage own addresses" on public.addresses
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy "customers read own bookings" on public.bookings
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "customers create own bookings" on public.bookings
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.addresses a
      where a.id = address_id and a.customer_id = (select auth.uid())
    )
    and exists (
      select 1 from public.services s
      where s.id = service_id and s.is_active
    )
  );

-- Whatever the app sends, a new customer booking starts clean: the server
-- sets the status, price, start code and every staff-only field.
-- Runs as the caller (not security definer) so current_user tells us whether
-- the change came from the app ('authenticated') or the dashboard.
create or replace function public.prepare_new_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() or current_user <> 'authenticated' then
    return new;
  end if;

  new.status := 'requested';
  new.professional_id := null;
  new.price := (select s.base_price from public.services s where s.id = new.service_id);
  new.deposit_amount := 0;
  new.start_code := lpad(floor(random() * 10000)::int::text, 4, '0');
  new.assigned_at := null;
  new.started_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.cancelled_by := null;
  new.cancel_reason := null;
  return new;
end;
$$;

create trigger bookings_prepare_new
  before insert on public.bookings
  for each row execute function public.prepare_new_booking();

create policy "customers read status history of own bookings" on public.booking_events
  for select to authenticated
  using (
    status is not null
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = (select auth.uid())
    )
  );

-- A customer sees the professional assigned to one of their bookings
-- (name, photo, phone for the call button). Payout and ID details live in
-- professional_private, which customers cannot read.
create policy "customers read their assigned professional" on public.professionals
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.professional_id = professionals.id
        and b.customer_id = (select auth.uid())
    )
  );

create policy "customers read extra parts on own bookings" on public.extra_parts
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = (select auth.uid())
    )
  );

create policy "customers read own payments" on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = (select auth.uid())
    )
  );

create policy "customers read ratings on own bookings" on public.ratings
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = (select auth.uid())
    )
  );

create policy "customers rate own completed bookings" on public.ratings
  for insert to authenticated
  with check (
    rated_by = 'customer'
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.customer_id = (select auth.uid())
        and b.status = 'completed'
    )
  );

-- ---------------------------------------------------------------------------
-- Functions the customer app calls
-- ---------------------------------------------------------------------------

-- Cancels one of the caller's bookings. Refund and travel-fee amounts are
-- still to be decided (design pack, section 8), so this only records the
-- cancellation; the team settles any refund from the payments table.
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.bookings;
begin
  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'customer',
      cancel_reason = p_reason
  where id = p_booking_id
    and customer_id = (select auth.uid())
    and status in ('requested', 'assigned', 'on_the_way')
  returning * into result;

  if result.id is null then
    raise exception 'Booking not found or can no longer be cancelled'
      using errcode = 'P0001';
  end if;

  return result;
end;
$$;

-- Approves or declines an extra part the professional asked for.
create or replace function public.decide_extra_part(p_part_id uuid, p_approve boolean)
returns public.extra_parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.extra_parts;
begin
  update public.extra_parts p
  set status = case when p_approve then 'approved'::public.part_status else 'declined'::public.part_status end,
      decided_at = now()
  from public.bookings b
  where p.id = p_part_id
    and p.status = 'pending'
    and b.id = p.booking_id
    and b.customer_id = (select auth.uid())
    and b.status in ('assigned', 'on_the_way', 'in_progress')
  returning p.* into result;

  if result.id is null then
    raise exception 'Part not found or already decided'
      using errcode = 'P0001';
  end if;

  return result;
end;
$$;

-- Only signed-in users may call these; helper and trigger functions are not
-- meant to be called from the app at all.
revoke execute on function public.cancel_booking(uuid, text) from public, anon;
revoke execute on function public.decide_extra_part(uuid, boolean) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.decide_extra_part(uuid, boolean) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_booking_status() from public, anon, authenticated;
revoke execute on function public.prepare_new_booking() from public, anon, authenticated;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
