-- Read only: shows every professional application and which sign-in account
-- it belongs to. Use it when someone says "the app forgot my application".
-- If the same person appears twice with different accounts, they signed in
-- with a different account (for example another Google account).

select
  p.full_name,
  p.verification_status,
  p.applied_at,
  p.created_at as started_at,
  u.email as account_email,
  u.phone as account_phone,
  u.raw_app_meta_data -> 'providers' as signs_in_with,
  u.last_sign_in_at,
  p.user_id
from public.professionals p
left join auth.users u on u.id = p.user_id
order by p.created_at desc
limit 20;

-- The newest sign-in accounts, to compare with the list above.
select email, phone, raw_app_meta_data -> 'providers' as signs_in_with, created_at, last_sign_in_at, id
from auth.users
order by created_at desc
limit 10;
