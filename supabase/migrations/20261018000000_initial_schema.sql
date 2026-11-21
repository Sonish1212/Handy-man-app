-- Initial schema for the Nepal home services app.
--
-- Covers the launch scope from the design pack: customers book fixed-price
-- services, an admin dispatches jobs to professionals (many of whom only have
-- SMS), the customer gives a start code on arrival, approves extra parts,
-- pays, and both sides rate the job.
--
-- Money is stored in Nepali rupees as numeric(10,2).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'admin');

-- How a service is priced (design pack, section 2). Only fixed_price is used
-- at launch; the others are here so later groups need no schema change.
create type public.pricing_type as enum ('fixed_price', 'day_rate', 'quote_first', 'contract');

create type public.verification_status as enum ('pending', 'verified', 'suspended');

create type public.booking_status as enum (
  'requested',     -- customer booked, nobody assigned yet
  'assigned',      -- a professional accepted
  'on_the_way',    -- professional is travelling
  'in_progress',   -- customer gave the start code
  'completed',
  'cancelled'
);

create type public.cancelled_by as enum ('customer', 'professional', 'admin');

create type public.part_status as enum ('pending', 'approved', 'declined');

create type public.payment_kind as enum ('deposit', 'balance', 'extra_parts', 'travel_fee', 'refund');

create type public.payment_method as enum ('esewa', 'khalti', 'ime_pay', 'bank', 'cash');

create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create type public.offer_channel as enum ('sms', 'call', 'app', 'team_leader');

create type public.offer_response as enum ('no_reply', 'accepted', 'declined');

create type public.rating_by as enum ('customer', 'professional');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per signed-in user (customers and admins). Created automatically
-- when someone signs up with phone OTP.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text unique,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (new.id, new.phone, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  area text not null,                 -- e.g. Baneshwor
  city text not null default 'Kathmandu',
  landmark text,                      -- e.g. near the temple
  details text,                       -- house number, floor, gate colour
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_customer_idx on public.addresses (customer_id);

-- Professionals do not need an app account: many only use SMS and phone
-- calls, so user_id is optional. A team leader can receive jobs for workers.
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  phone text not null unique,
  photo_url text,
  area text,
  team_leader_id uuid references public.professionals (id) on delete set null,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  has_smartphone boolean not null default false,
  is_available boolean not null default true,
  -- Counted so that repeat late cancellations lower recommendations.
  late_cancellations integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger professionals_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

-- Payout details, ID documents and admin notes are kept apart so customers
-- can never read them (admin-only, see the RLS migration).
create table public.professional_private (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  payout_method public.payment_method,
  payout_account_name text,
  payout_account_number text,
  citizenship_number text,
  reference_contacts text,
  admin_notes text,
  updated_at timestamptz not null default now()
);

create trigger professional_private_updated_at
  before update on public.professional_private
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_ne text not null,
  description text,
  pricing_type public.pricing_type not null default 'fixed_price',
  base_price numeric(10, 2) check (base_price >= 0),     -- null until real prices are set
  visit_charge numeric(10, 2) check (visit_charge >= 0), -- charged if cancelled after arrival
  duration_minutes integer check (duration_minutes > 0),
  icon text,
  image_url text,
  is_featured boolean not null default false,            -- shown in "Most booked"
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.professional_services (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (professional_id, service_id)
);

create index professional_services_service_idx on public.professional_services (service_id);

create table public.promos (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  title text not null,
  title_ne text not null,
  cta text not null,
  icon text,
  image_url text,
  service_id uuid references public.services (id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  address_id uuid not null references public.addresses (id) on delete restrict,
  professional_id uuid references public.professionals (id) on delete set null,
  status public.booking_status not null default 'requested',
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  description text,
  -- Customer reads this out on arrival; generated on insert.
  start_code text not null default lpad(floor(random() * 10000)::int::text, 4, '0'),
  price numeric(10, 2) check (price >= 0),
  deposit_amount numeric(10, 2) not null default 0 check (deposit_amount >= 0),
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by public.cancelled_by,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slot_end > slot_start),
  check (status <> 'cancelled' or cancelled_at is not null)
);

create index bookings_customer_idx on public.bookings (customer_id, slot_start desc);
create index bookings_professional_idx on public.bookings (professional_id, slot_start);
create index bookings_status_idx on public.bookings (status, slot_start);

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- Full history of every booking: status changes plus admin notes. Lets the
-- Bookings page show a timeline and gives the team data on what users book.
create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  status public.booking_status,
  note text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

create or replace function public.log_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.booking_events (booking_id, status, actor_id)
    values (new.id, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger bookings_log_status
  after insert or update of status on public.bookings
  for each row execute function public.log_booking_status();

-- Every time a job is offered to a professional (by SMS, call or team leader).
-- No reply means no; the dispatcher then calls or offers the next person.
create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  channel public.offer_channel not null default 'sms',
  message text,
  response public.offer_response not null default 'no_reply',
  sent_at timestamptz not null default now(),
  responded_at timestamptz
);

create index job_offers_booking_idx on public.job_offers (booking_id);

create table public.extra_parts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  description text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  status public.part_status not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index extra_parts_booking_idx on public.extra_parts (booking_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  kind public.payment_kind not null,
  method public.payment_method not null,
  amount numeric(10, 2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  provider_reference text,            -- eSewa / Khalti transaction id
  commission_amount numeric(10, 2) check (commission_amount >= 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index payments_booking_idx on public.payments (booking_id);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  rated_by public.rating_by not null,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id, rated_by)
);
