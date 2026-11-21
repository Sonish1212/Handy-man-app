-- Every booking has a mobile number the professional and the team can call.
--
-- Before: the job showed the phone number of the customer's account. People
-- who sign in with email or Google have none, so the professional saw "Ask
-- the team for the number".
--
-- Now: the booking asks "Phone number for this job" (filled in from last
-- time). It can be someone at the house, for example a parent. Professionals
-- see it only while the job is theirs and active, as before.

begin;

alter table public.bookings
  add column if not exists contact_phone text
  check (contact_phone is null or contact_phone ~ '^\+977(97|98)[0-9]{8}$');

-- The existing booking rules stay in one place: the old function becomes
-- the inner step, and the new create_booking checks the phone around it.
alter function public.create_booking(uuid, uuid, timestamptz, boolean, text) rename to create_booking_base;
revoke execute on function public.create_booking_base(uuid, uuid, timestamptz, boolean, text) from public, anon, authenticated;

create or replace function public.create_booking(
  p_task_id uuid,
  p_address_id uuid,
  p_slot_start timestamptz,
  p_is_urgent boolean default false,
  p_description text default null,
  p_contact_phone text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  digits text;
  result public.bookings;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in to book.' using errcode = 'P0001';
  end if;

  -- The number given, or else the account's own number.
  digits := regexp_replace(coalesce(nullif(trim(p_contact_phone), ''),
                                    (select phone from public.profiles where id = (select auth.uid())), ''),
                           '[^0-9]', '', 'g');
  if length(digits) = 13 and left(digits, 3) = '977' then
    digits := substr(digits, 4);
  end if;
  if digits !~ '^(97|98)[0-9]{8}$' then
    raise exception 'Please give a mobile number (10 digits, starting 98 or 97) so the professional can call you.'
      using errcode = 'P0001';
  end if;

  result := public.create_booking_base(p_task_id, p_address_id, p_slot_start, p_is_urgent, p_description);
  update public.bookings set contact_phone = '+977' || digits where id = result.id returning * into result;
  return result;
end;
$$;

revoke execute on function public.create_booking(uuid, uuid, timestamptz, boolean, text, text) from public, anon;
grant execute on function public.create_booking(uuid, uuid, timestamptz, boolean, text, text) to authenticated;

-- The professional's job list: the booking's number first, the account's
-- number for older bookings.
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
    case when active then coalesce(b.contact_phone, c.phone) end,
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

revoke execute on function public.my_jobs() from public, anon;
grant execute on function public.my_jobs() to authenticated;

commit;
