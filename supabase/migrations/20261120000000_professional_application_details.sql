-- The professional's application, asked properly. Run after
-- 20261115000000_professional_onboarding.sql.
--
-- The first version asked for "references" in one free-text box, so people
-- typed a name and no phone number. This asks each thing on its own, with
-- choices instead of typing wherever possible, and adds what a home-services
-- company in Nepal needs before sending someone into a customer's home:
--   * date of birth (B.S., as on the citizenship): must be 18 or older
--   * gender (some customers ask for a woman for cleaning)
--   * permanent district and where they live now
--   * ID type, number and the district that issued it
--   * skill level (CTEVT training / NSTB skill test), own tools, how they travel
--   * an emergency contact (family), and a work reference (not family),
--     each with name, relation and phone
--   * where to send their earnings (eSewa, Khalti or bank)
-- Everything private stays in professional_private, which only the team and
-- the person themselves (through my_application) can read.

begin;

alter table public.professionals
  add column gender text check (gender in ('male', 'female', 'other')),
  add column skill_level text check (skill_level in ('none', 'training', 'level1', 'level2', 'level3')),
  add column has_tools text check (has_tools in ('all', 'some', 'none')),
  add column travel_mode text check (travel_mode in ('bike', 'public', 'walk'));

alter table public.professional_private
  add column date_of_birth_bs text,          -- 'YYYY-MM-DD' in Bikram Sambat, as on the citizenship
  add column permanent_district text,
  add column current_address text,
  add column id_type text check (id_type in ('citizenship', 'national_id')),
  add column id_issue_district text,
  add column emergency_name text,
  add column emergency_relation text,
  add column emergency_phone text,
  add column reference_name text,
  add column reference_relation text,
  add column reference_phone text,
  add column payout_bank text;              -- bank name, when payout_method = 'bank'

-- Saves the whole application. p holds the answers (keys below). Checks
-- every answer and says exactly what is wrong, in words the applicant
-- understands. Can be called again to correct the details until approved.
create or replace function public.save_professional_application(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  own_phone text := public.normalize_phone(p ->> 'phone');
  em_phone text := public.normalize_phone(p ->> 'emergency_phone');
  ref_phone text := public.normalize_phone(p ->> 'reference_phone');
  wallet text := public.normalize_phone(p ->> 'payout_account');
  dob text := trim(coalesce(p ->> 'dob_bs', ''));
  dob_y integer;
  dob_m integer;
  dob_d integer;
  today_bs date;
  years integer;
  pro_id uuid;
  method text := p ->> 'payout_method';
  services text[];
begin
  if me is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  -- About you
  if coalesce(p ->> 'gender', '') not in ('male', 'female', 'other') then
    raise exception 'Please choose man, woman or other.' using errcode = 'P0001';
  end if;
  if dob !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Please enter your date of birth as on your citizenship (year, month, day in B.S.).' using errcode = 'P0001';
  end if;
  dob_y := split_part(dob, '-', 1)::integer;
  dob_m := split_part(dob, '-', 2)::integer;
  dob_d := split_part(dob, '-', 3)::integer;
  if dob_y < 1990 or dob_m not between 1 and 12 or dob_d not between 1 and 32 then
    raise exception 'Please check your date of birth.' using errcode = 'P0001';
  end if;
  -- Today in B.S., near enough (within a few days); the team checks the
  -- exact date against the citizenship photo.
  today_bs := ((now() at time zone 'Asia/Kathmandu')::date + interval '56 years 8 months 17 days')::date;
  if (dob_y + 18, dob_m, dob_d) > (extract(year from today_bs)::integer, extract(month from today_bs)::integer, extract(day from today_bs)::integer) then
    raise exception 'You must be 18 or older to work with us.' using errcode = 'P0001';
  end if;

  -- Where you live
  if length(trim(coalesce(p ->> 'permanent_district', ''))) not between 3 and 40 then
    raise exception 'Please choose your permanent district.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p ->> 'current_address', ''))) not between 3 and 150 then
    raise exception 'Please write where you live now (tole, municipality).' using errcode = 'P0001';
  end if;

  -- Your work
  if coalesce(p ->> 'skill_level', '') not in ('none', 'training', 'level1', 'level2', 'level3') then
    raise exception 'Please choose your training or skill test.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'has_tools', '') not in ('all', 'some', 'none') then
    raise exception 'Please tell us if you have your own tools.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'travel_mode', '') not in ('bike', 'public', 'walk') then
    raise exception 'Please tell us how you travel to jobs.' using errcode = 'P0001';
  end if;
  if (p ->> 'years') !~ '^\d{1,2}$' then
    raise exception 'Please enter your years of experience.' using errcode = 'P0001';
  end if;
  years := (p ->> 'years')::integer;

  -- Your ID
  if coalesce(p ->> 'id_type', '') not in ('citizenship', 'national_id') then
    raise exception 'Please choose citizenship or National ID card.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p ->> 'id_district', ''))) not between 3 and 40 then
    raise exception 'Please choose the district that issued your ID.' using errcode = 'P0001';
  end if;

  -- Emergency contact and reference
  if length(trim(coalesce(p ->> 'emergency_name', ''))) not between 2 and 80
     or length(trim(coalesce(p ->> 'emergency_relation', ''))) not between 2 and 30 then
    raise exception 'Please give the name and relation of a family member to call in an emergency.' using errcode = 'P0001';
  end if;
  if em_phone is null or em_phone !~ '^9[78][0-9]{8}$' then
    raise exception 'Please enter a Nepali mobile number for your emergency contact.' using errcode = 'P0001';
  end if;
  if em_phone = own_phone then
    raise exception 'The emergency contact needs a different number from yours.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p ->> 'reference_name', ''))) not between 2 and 80
     or length(trim(coalesce(p ->> 'reference_relation', ''))) not between 2 and 30 then
    raise exception 'Please give the name of someone who knows your work, and how they know you.' using errcode = 'P0001';
  end if;
  if ref_phone is null or ref_phone !~ '^9[78][0-9]{8}$' then
    raise exception 'Please enter a Nepali mobile number for the person who knows your work.' using errcode = 'P0001';
  end if;
  if ref_phone = own_phone then
    raise exception 'The person who knows your work needs a different number from yours.' using errcode = 'P0001';
  end if;

  -- Where we send your earnings
  if coalesce(method, '') not in ('esewa', 'khalti', 'bank') then
    raise exception 'Please choose eSewa, Khalti or bank for your earnings.' using errcode = 'P0001';
  end if;
  if method in ('esewa', 'khalti') and (wallet is null or wallet !~ '^9[78][0-9]{8}$') then
    raise exception 'Please enter the mobile number of your eSewa or Khalti account.' using errcode = 'P0001';
  end if;
  if method = 'bank' and (
       length(trim(coalesce(p ->> 'payout_bank', ''))) not between 3 and 80
       or coalesce(p ->> 'payout_account', '') !~ '^[0-9]{6,30}$'
       or length(trim(coalesce(p ->> 'payout_account_name', ''))) not between 3 and 80) then
    raise exception 'Please enter the bank name, account number and account holder name.' using errcode = 'P0001';
  end if;

  -- The basic details (name, phone, services, area, ID number, consent)
  -- are checked and saved by the first version of the form.
  select coalesce(array_agg(value), '{}') into services from jsonb_array_elements_text(coalesce(p -> 'services', '[]'::jsonb));
  pro_id := public.apply_as_professional(
    p ->> 'full_name', p ->> 'phone', p ->> 'area', services, years, p ->> 'about',
    p ->> 'id_number',
    trim(p ->> 'reference_name') || ' (' || trim(p ->> 'reference_relation') || ') ' || ref_phone,
    (p ->> 'consent')::boolean);

  update public.professionals
  set gender = p ->> 'gender', skill_level = p ->> 'skill_level',
      has_tools = p ->> 'has_tools', travel_mode = p ->> 'travel_mode'
  where id = pro_id;

  update public.professional_private
  set date_of_birth_bs = dob,
      permanent_district = trim(p ->> 'permanent_district'),
      current_address = trim(p ->> 'current_address'),
      id_type = p ->> 'id_type',
      id_issue_district = trim(p ->> 'id_district'),
      emergency_name = trim(p ->> 'emergency_name'),
      emergency_relation = trim(p ->> 'emergency_relation'),
      emergency_phone = '+977' || em_phone,
      reference_name = trim(p ->> 'reference_name'),
      reference_relation = trim(p ->> 'reference_relation'),
      reference_phone = '+977' || ref_phone,
      payout_method = method::public.payment_method,
      payout_bank = case when method = 'bank' then trim(p ->> 'payout_bank') end,
      payout_account_number = case when method = 'bank' then p ->> 'payout_account' else '+977' || wallet end,
      payout_account_name = case when method = 'bank' then trim(p ->> 'payout_account_name') end
  where professional_id = pro_id;

  return pro_id;
end;
$$;

-- The applicant's own answers come back so they can correct them.
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
    'gender', p.gender,
    'skill_level', p.skill_level,
    'has_tools', p.has_tools,
    'travel_mode', p.travel_mode,
    'citizenship_number', pp.citizenship_number,
    'references', pp.reference_contacts,
    'dob_bs', pp.date_of_birth_bs,
    'permanent_district', pp.permanent_district,
    'current_address', pp.current_address,
    'id_type', pp.id_type,
    'id_district', pp.id_issue_district,
    'emergency_name', pp.emergency_name,
    'emergency_relation', pp.emergency_relation,
    'emergency_phone', pp.emergency_phone,
    'reference_name', pp.reference_name,
    'reference_relation', pp.reference_relation,
    'reference_phone', pp.reference_phone,
    'payout_method', pp.payout_method,
    'payout_bank', pp.payout_bank,
    'payout_account', pp.payout_account_number,
    'payout_account_name', pp.payout_account_name,
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

-- The app now saves through save_professional_application only, so nobody
-- can skip the new questions by calling the old function directly.
revoke execute on function public.apply_as_professional(text, text, text, text[], integer, text, text, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.save_professional_application(jsonb) from public, anon;
grant execute on function public.save_professional_application(jsonb) to authenticated;

commit;
