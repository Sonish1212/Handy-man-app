-- Read only: for the newest booking, shows every verified professional and
-- each rule the automatic offer checks (see auto_offer_job). A professional
-- gets the offer only when every column says true.

with b as (
  select bk.id, bk.service_id, s.name as service, a.area as booking_area, bk.created_at
  from public.bookings bk
  join public.services s on s.id = bk.service_id
  join public.addresses a on a.id = bk.address_id
  order by bk.created_at desc
  limit 1
)
select
  b.service,
  b.booking_area,
  p.full_name,
  p.area as works_in,
  p.user_id is not null as has_app,
  p.is_available as taking_jobs,
  exists (select 1 from public.professional_services ps
          where ps.professional_id = p.id and ps.service_id = b.service_id) as does_this_service,
  (p.area is null or lower(p.area) = lower(b.booking_area)) as area_matches,
  not public.professional_is_busy(p.id, b.id) as free_at_that_time
from b
cross join public.professionals p
where p.verification_status = 'verified'
order by p.full_name;
