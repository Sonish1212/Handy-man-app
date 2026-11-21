-- The professional app: joining, verification, and earnings.
-- Run after 20261106000000_booking_repairs.sql.
--
-- * Joining: someone applies in the professional app (details, services,
--   citizenship number, references, consent), uploads photos of their
--   documents, and submits. The team checks them and approves or rejects
--   with a reason. Only an approved ("verified") professional gets jobs.
--     draft -> in_review -> verified          (or rejected -> fix -> in_review)
-- * Documents are files in a private storage bucket. A person can only write
--   to their own folder; only the team can open other people's files.
-- * One account can be a customer and a professional: nothing here touches
--   the customer profile.
-- * Earnings: each finished job records the company's commission
--   (booking_settings.commission_percent, a placeholder until the team
--   decides). my_earnings() shows the professional what they earned, the
--   cash they collected, and who owes whom. The team records settlements.

begin;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.professionals
  add column years_experience smallint check (years_experience between 0 and 60),
  add column about text,
  add column consent_at timestamptz,        -- agreed to the document check and privacy terms
  add column applied_at timestamptz,        -- submitted for review (null while still a draft)
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column rejection_reason text;         -- shown to the applicant so they can fix it

alter table public.professional_private
  add column police_report_date date;       -- reports go stale: re-check after 6 months

create table public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  kind text not null check (kind in ('citizenship_front', 'citizenship_back', 'selfie', 'police_report')),
  path text not null,                       -- file path inside the professional-documents bucket
  uploaded_at timestamptz not null default now(),
  unique (professional_id, kind)
);

alter table public.professional_documents enable row level security;
create policy "admins manage professional_documents" on public.professional_documents
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.booking_settings
  add column commission_percent numeric(5, 2) not null default 15
    check (commission_percent between 0 and 50);   -- the company's share of each job

alter table public.bookings
  add column commission_amount numeric(10, 2) check (commission_amount >= 0);

-- Money moved between the company and a professional outside a booking.
-- amount > 0: the company paid the professional. amount < 0: the
-- professional paid the company (commission on cash jobs).
create table public.professional_settlements (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete restrict,
  amount numeric(10, 2) not null check (amount <> 0),
  method public.payment_method not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index professional_settlements_professional_idx on public.professional_settlements (professional_id);

alter table public.professional_settlements enable row level security;
create policy "admins manage professional_settlements" on public.professional_settlements
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Who counts as a professional
-- ---------------------------------------------------------------------------

-- Only approved professionals can see offers and work on jobs. Applicants
-- still waiting, rejected or suspended people get nothing from the job
-- functions.
create or replace function public.my_professional_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.professionals
  where user_id = (select auth.uid()) and verification_status = 'verified';
$$;

-- ---------------------------------------------------------------------------
-- Applying
-- ---------------------------------------------------------------------------

-- Saves the applicant's details (creating or updating their own record).
-- Can be called again to correct details until the team has approved them.
create or replace function public.apply_as_professional(
  p_full_name text,
  p_phone text,
  p_area text,
  p_service_slugs text[],
  p_years integer,
  p_about text,
  p_citizenship_number text,
  p_references text,
  p_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  digits text := public.normalize_phone(p_phone);
  existing public.professionals;
  pro_id uuid;
  wanted integer;
  found_services integer;
begin
  if me is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;
  if p_consent is not true then
    raise exception 'Please agree to the document check to continue.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_full_name, ''))) not between 3 and 80 then
    raise exception 'Please enter your full name.' using errcode = 'P0001';
  end if;
  if digits is null or digits !~ '^9[78][0-9]{8}$' then
    raise exception 'Please enter a Nepali mobile number (98XXXXXXXX).' using errcode = 'P0001';
  end if;
  if p_years is null or p_years not between 0 and 60 then
    raise exception 'Please enter your years of experience.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_citizenship_number, ''))) not between 4 and 30 then
    raise exception 'Please enter your citizenship or National ID number.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_references, ''))) < 10 then
    raise exception 'Please give the name and phone number of someone who knows your work.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_about, '')) > 500 then
    raise exception 'Please keep the description under 500 characters.' using errcode = 'P0001';
  end if;

  wanted := coalesce(array_length(p_service_slugs, 1), 0);
  select count(*) into found_services from public.services
  where slug = any (p_service_slugs) and is_active and slug <> 'other';
  if wanted = 0 or found_services <> wanted then
    raise exception 'Please choose at least one service you do.' using errcode = 'P0001';
  end if;

  select * into existing from public.professionals where user_id = me for update;
  if found and existing.verification_status <> 'pending' then
    raise exception 'You are already registered. Call the team to change your details.' using errcode = 'P0001';
  end if;

  -- A number can belong to one professional only. Someone the team already
  -- registered by phone is linked by the team, not by typing the number here.
  if exists (
    select 1 from public.professionals p
    where public.normalize_phone(p.phone) = digits and p.user_id is distinct from me
  ) then
    raise exception 'This number is already registered with us. Please call the team.' using errcode = 'P0001';
  end if;

  if existing.id is null then
    insert into public.professionals (user_id, full_name, phone, area, years_experience, about,
                                      consent_at, has_smartphone, verification_status)
    values (me, trim(p_full_name), '+977' || digits, nullif(trim(p_area), ''), p_years,
            nullif(trim(p_about), ''), now(), true, 'pending')
    returning id into pro_id;
  else
    pro_id := existing.id;
    update public.professionals
    set full_name = trim(p_full_name), phone = '+977' || digits, area = nullif(trim(p_area), ''),
        years_experience = p_years, about = nullif(trim(p_about), ''), consent_at = now(), has_smartphone = true
    where id = pro_id;
  end if;

  delete from public.professional_services where professional_id = pro_id;
  insert into public.professional_services (professional_id, service_id)
  select pro_id, s.id from public.services s where s.slug = any (p_service_slugs);

  insert into public.professional_private (professional_id, citizenship_number, reference_contacts)
  values (pro_id, trim(p_citizenship_number), trim(p_references))
  on conflict (professional_id) do update
    set citizenship_number = excluded.citizenship_number, reference_contacts = excluded.reference_contacts;

  return pro_id;
end;
$$;

-- Records a document the applicant uploaded to their own storage folder
-- ("<their user id>/<kind>.jpg"). Uploading again replaces the old one.
create or replace function public.record_professional_document(p_kind text, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  pro_id uuid;
begin
  select id into pro_id from public.professionals
  where user_id = me and verification_status <> 'suspended';
  if pro_id is null then
    raise exception 'Please fill in your details first.' using errcode = 'P0001';
  end if;
  if p_kind not in ('citizenship_front', 'citizenship_back', 'selfie', 'police_report') then
    raise exception 'Unknown document.' using errcode = 'P0001';
  end if;
  if p_path is null or p_path not like me::text || '/%' or p_path like '%..%' or length(p_path) > 200 then
    raise exception 'That file is not in your folder.' using errcode = 'P0001';
  end if;

  insert into public.professional_documents (professional_id, kind, path)
  values (pro_id, p_kind, p_path)
  on conflict (professional_id, kind) do update set path = excluded.path, uploaded_at = now();
end;
$$;

-- Sends the application to the team. Needs both sides of the citizenship
-- (or National ID) card and a selfie; the police report can follow.
create or replace function public.submit_professional_application()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pro public.professionals;
  missing text;
begin
  select * into pro from public.professionals where user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Please fill in your details first.' using errcode = 'P0001';
  end if;
  if pro.verification_status <> 'pending' then
    raise exception 'Your application was already decided.' using errcode = 'P0001';
  end if;

  select string_agg(need.kind, ', ') into missing
  from (values ('citizenship_front'), ('citizenship_back'), ('selfie')) as need (kind)
  where not exists (
    select 1 from public.professional_documents d
    where d.professional_id = pro.id and d.kind = need.kind
  );
  if missing is not null then
    raise exception 'Please add these photos first: %.', replace(missing, '_', ' ') using errcode = 'P0001';
  end if;

  update public.professionals
  set applied_at = now(), rejection_reason = null
  where id = pro.id;
end;
$$;

-- Everything the professional app needs to show an applicant where they
-- stand, or null for someone who has not started. state is one of
-- draft, in_review, rejected, verified, suspended.
create or replace function public.my_application()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'state', case
      when p.verification_status = 'suspended' then 'suspended'
      when p.verification_status = 'verified' then 'verified'
      when p.rejection_reason is not null then 'rejected'
      when p.applied_at is not null then 'in_review'
      else 'draft'
    end,
    'full_name', p.full_name,
    'phone', p.phone,
    'area', p.area,
    'years_experience', p.years_experience,
    'about', p.about,
    'citizenship_number', pp.citizenship_number,
    'references', pp.reference_contacts,
    'rejection_reason', p.rejection_reason,
    'applied_at', p.applied_at,
    'services', coalesce((select jsonb_agg(s.slug order by s.sort_order)
      from public.professional_services ps join public.services s on s.id = ps.service_id
      where ps.professional_id = p.id), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(d.kind order by d.kind)
      from public.professional_documents d where d.professional_id = p.id), '[]'::jsonb)
  )
  from public.professionals p
  left join public.professional_private pp on pp.professional_id = p.id
  where p.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Team review
-- ---------------------------------------------------------------------------

create or replace function public.review_professional(p_professional_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pro public.professionals;
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;
  select * into pro from public.professionals where id = p_professional_id for update;
  if not found or pro.verification_status <> 'pending' or pro.applied_at is null or pro.rejection_reason is not null then
    raise exception 'This application is not waiting for review.' using errcode = 'P0001';
  end if;

  if p_approve then
    if (select count(*) from public.professional_documents d
        where d.professional_id = pro.id and d.kind in ('citizenship_front', 'citizenship_back', 'selfie')) < 3 then
      raise exception 'The ID photos and selfie are needed before approving.' using errcode = 'P0001';
    end if;
    update public.professionals
    set verification_status = 'verified', verified_at = now(), reviewed_at = now(),
        reviewed_by = (select auth.uid()), rejection_reason = null
    where id = pro.id;
  else
    if length(trim(coalesce(p_reason, ''))) < 5 then
      raise exception 'Please write what the applicant needs to fix.' using errcode = 'P0001';
    end if;
    update public.professionals
    set rejection_reason = trim(p_reason), reviewed_at = now(), reviewed_by = (select auth.uid())
    where id = pro.id;
  end if;
end;
$$;

-- Stops (or restores) a professional straight away, for example after a
-- serious complaint. A suspended professional gets no offers and cannot
-- work on jobs.
create or replace function public.set_professional_suspended(p_professional_id uuid, p_suspend boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;
  if p_suspend and length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Please write why.' using errcode = 'P0001';
  end if;

  update public.professionals
  set verification_status = case when p_suspend then 'suspended'::public.verification_status
                                 else 'verified'::public.verification_status end,
      reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = p_professional_id
    and verification_status = case when p_suspend then 'verified'::public.verification_status
                                   else 'suspended'::public.verification_status end;
  if not found then
    raise exception 'Nothing to change for this professional.' using errcode = 'P0001';
  end if;

  update public.professional_private
  set admin_notes = concat_ws(E'\n', admin_notes,
        to_char(now(), 'YYYY-MM-DD') || case when p_suspend then ' suspended: ' else ' restored' end || coalesce(trim(p_reason), ''))
  where professional_id = p_professional_id;
end;
$$;

create or replace function public.record_settlement(
  p_professional_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_note text default null
)
returns public.professional_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.professional_settlements;
begin
  if not public.is_admin() then
    raise exception 'Only the team can do this.' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then
    raise exception 'Please enter the amount in rupees.' using errcode = 'P0001';
  end if;
  insert into public.professional_settlements (professional_id, amount, method, note, created_by)
  values (p_professional_id, round(p_amount, 2), p_method, nullif(trim(p_note), ''), (select auth.uid()))
  returning * into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Earnings
-- ---------------------------------------------------------------------------

-- The company's share is fixed when the job is finished, so changing the
-- percentage later never rewrites old jobs. Parts are the professional's own
-- cost, so the commission is on the job price and ASAP charge only.
create or replace function public.set_booking_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.commission_amount := round(
      (coalesce(new.price, 0) + coalesce(new.urgent_fee, 0))
        * (select commission_percent from public.booking_settings where id = true) / 100, 2);
  end if;
  return new;
end;
$$;

create trigger bookings_set_commission
  before update on public.bookings
  for each row execute function public.set_booking_commission();

-- What the professional earned. Per job: billed (job + ASAP + approved
-- parts), the company's commission, and the cash they collected themselves.
-- balance is over all time: positive means the company owes the
-- professional, negative means the professional owes the company.
create or replace function public.my_earnings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with jobs as (
    select
      b.id, b.completed_at, coalesce(t.name, s.name) as title, t.name_ne as title_ne,
      coalesce(b.price, 0) + b.urgent_fee
        + coalesce((select sum(x.amount) from public.extra_parts x
                    where x.booking_id = b.id and x.status = 'approved'), 0) as billed,
      coalesce(b.commission_amount, 0) as commission,
      coalesce((select sum(p.amount) from public.payments p
                where p.booking_id = b.id and p.status = 'paid' and p.method = 'cash'), 0) as cash_collected
    from public.bookings b
    join public.services s on s.id = b.service_id
    left join public.service_tasks t on t.id = b.task_id
    where b.professional_id = public.my_professional_id() and b.status = 'completed'
  ),
  paid as (
    select coalesce(sum(amount), 0) as total from public.professional_settlements
    where professional_id = public.my_professional_id()
  )
  select case when public.my_professional_id() is null then null else jsonb_build_object(
    'commission_percent', (select commission_percent from public.booking_settings where id = true),
    'balance', (select coalesce(sum(billed - commission - cash_collected), 0) from jobs) - (select total from paid),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
        'booking_id', j.id, 'completed_at', j.completed_at, 'title', j.title, 'title_ne', j.title_ne,
        'billed', j.billed, 'commission', j.commission, 'net', j.billed - j.commission,
        'cash_collected', j.cash_collected) order by j.completed_at desc)
      from jobs j where j.completed_at > now() - interval '90 days'), '[]'::jsonb),
    'settlements', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'amount', st.amount, 'method', st.method, 'note', st.note, 'created_at', st.created_at)
        order by st.created_at desc)
      from public.professional_settlements st
      where st.professional_id = public.my_professional_id()
        and st.created_at > now() - interval '90 days'), '[]'::jsonb)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs: add the map pin so the professional can navigate to the house
-- ---------------------------------------------------------------------------

drop function public.my_jobs();
create function public.my_jobs()
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
  completed_at timestamptz,
  latitude double precision,
  longitude double precision
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
    b.completed_at,
    case when active then a.latitude end,
    case when active then a.longitude end
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
-- Document storage (private)
-- ---------------------------------------------------------------------------

-- Skipped where there is no Supabase Storage (the local test database).
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    return;
  end if;

  execute $sql$
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('professional-documents', 'professional-documents', false, 6291456,
            array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false
  $sql$;

  execute 'drop policy if exists "professionals add own documents" on storage.objects';
  execute 'drop policy if exists "professionals replace own documents" on storage.objects';
  execute 'drop policy if exists "professionals read own documents" on storage.objects';
  execute 'drop policy if exists "team reads professional documents" on storage.objects';

  execute $sql$
    create policy "professionals add own documents" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'professional-documents'
                  and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy "professionals replace own documents" on storage.objects
      for update to authenticated
      using (bucket_id = 'professional-documents'
             and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'professional-documents'
                  and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy "professionals read own documents" on storage.objects
      for select to authenticated
      using (bucket_id = 'professional-documents'
             and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy "team reads professional documents" on storage.objects
      for select to authenticated
      using (bucket_id = 'professional-documents' and (select public.is_admin()))
  $sql$;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

revoke execute on function public.set_booking_commission() from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.my_professional_id()',
    'public.apply_as_professional(text, text, text, text[], integer, text, text, text, boolean)',
    'public.record_professional_document(text, text)',
    'public.submit_professional_application()',
    'public.my_application()',
    'public.review_professional(uuid, boolean, text)',
    'public.set_professional_suspended(uuid, boolean, text)',
    'public.record_settlement(uuid, numeric, public.payment_method, text)',
    'public.my_earnings()',
    'public.my_jobs()'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

commit;
