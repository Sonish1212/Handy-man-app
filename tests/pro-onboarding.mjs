// Database test for the professional app: applying, documents, team review,
// commission and earnings. Runs every migration in a throwaway Postgres
// (PGlite), so nothing touches the real project.   npm run test:pro
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let failures = 0;
let passes = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (cond) passes += 1;
  else failures += 1;
};

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, phone text, phone_confirmed_at timestamptz,
    email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);
const dir = new URL('../supabase/', import.meta.url);
for (const file of fs.readdirSync(new URL('migrations/', dir)).sort()) {
  if (file === '20261027000000_booking_flow.sql') await db.exec(fs.readFileSync(new URL('seed.sql', dir), 'utf8'));
  await db.exec(fs.readFileSync(new URL(`migrations/${file}`, dir), 'utf8'));
}
console.log('all migrations applied');

const CUSTOMER = 'aaaaaaaa-0000-0000-0000-000000000001';
const ADMIN = 'bbbbbbbb-0000-0000-0000-000000000002';
const HARI = 'cccccccc-0000-0000-0000-000000000003'; // applies and is approved
const MAYA = 'cccccccc-0000-0000-0000-000000000004'; // applies and is rejected
const OTHER = 'cccccccc-0000-0000-0000-000000000005';
await db.exec(`insert into auth.users (id, email) values
  ('${CUSTOMER}', 'customer@example.test'), ('${ADMIN}', 'admin@example.test'),
  ('${HARI}', 'hari@example.test'), ('${MAYA}', 'maya@example.test'), ('${OTHER}', 'other@example.test');
  update profiles set role = 'admin' where id = '${ADMIN}';
  update profiles set full_name = 'Asha', phone = '+9779800000001' where id = '${CUSTOMER}';`);

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const as = (user, sql, params = []) => db.transaction(async (tx) => {
  await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
  await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
  return (await tx.query(sql, params)).rows;
});
const err = async (user, sql, params = []) => {
  try { await as(user, sql, params); return null; } catch (e) { return e.message; }
};
const APPLY_SQL = 'select save_professional_application($1::jsonb) as id';
const hariAnswers = {
  full_name: 'Hari Karki', phone: '98 1111 1111', gender: 'male', dob_bs: '2045-03-12',
  permanent_district: 'Kavrepalanchok', current_address: 'Baneshwor-10, Kathmandu', area: 'Baneshwor',
  services: ['plumber'], years: '6', skill_level: 'level1', has_tools: 'all', travel_mode: 'bike',
  about: 'Six years of plumbing', id_type: 'citizenship', id_number: '12-34-56-78901', id_district: 'Kavrepalanchok',
  emergency_name: 'Sita Karki', emergency_relation: 'wife', emergency_phone: '9800000007',
  reference_name: 'Ram Thapa', reference_relation: 'employer', reference_phone: '9800000009',
  payout_method: 'esewa', payout_account: '9811111111', consent: true,
};
// The answers as the query parameter; `change` overrides some of them.
const hariForm = [JSON.stringify(hariAnswers)];
const form = (base, change) => [JSON.stringify({ ...base, ...change })];
const APPLY = APPLY_SQL;
const application = async (user) => (await as(user, 'select my_application() as a'))[0].a;

// --- Applying ---------------------------------------------------------------
ok('nothing to show before applying', (await application(HARI)) === null);
ok('signed-out people cannot apply', !!(await err(null, APPLY, hariForm)));
ok('consent is required', (await err(HARI, APPLY, form(hariAnswers, { consent: false })))?.includes('agree'));
ok('a Nepali mobile number is required', (await err(HARI, APPLY, form(hariAnswers, { phone: '12345' })))?.includes('Nepali mobile'));
ok('at least one real service is required', (await err(HARI, APPLY, form(hariAnswers, { services: ['juggling'] })))?.includes('service'));
ok('the reference needs a phone number', (await err(HARI, APPLY, form(hariAnswers, { reference_phone: '' })))?.includes('knows your work'));
ok('the reference needs a name', (await err(HARI, APPLY, form(hariAnswers, { reference_name: '' })))?.includes('knows your work'));
ok('the reference cannot be your own number', (await err(HARI, APPLY, form(hariAnswers, { reference_phone: '9811111111' })))?.includes('different number'));
ok('an emergency contact is required', (await err(HARI, APPLY, form(hariAnswers, { emergency_phone: '123' })))?.includes('emergency'));
ok('gender must be one of the choices', (await err(HARI, APPLY, form(hariAnswers, { gender: 'x' })))?.includes('man, woman'));
ok('date of birth must be complete', (await err(HARI, APPLY, form(hariAnswers, { dob_bs: '2045' })))?.includes('date of birth'));
ok('under 18 is refused', (await err(HARI, APPLY, form(hariAnswers, { dob_bs: '2070-01-01' })))?.includes('18 or older'));
ok('permanent district is required', (await err(HARI, APPLY, form(hariAnswers, { permanent_district: '' })))?.includes('district'));
ok('ID issue district is required', (await err(HARI, APPLY, form(hariAnswers, { id_district: '' })))?.includes('issued'));
ok('wallet payout needs a mobile number', (await err(HARI, APPLY, form(hariAnswers, { payout_account: 'abc' })))?.includes('eSewa or Khalti'));
ok('bank payout needs bank, account and name', (await err(HARI, APPLY, form(hariAnswers, { payout_method: 'bank', payout_account: '123' })))?.includes('bank name'));
ok('the old one-box form cannot be called any more', !!(await err(HARI,
  'select apply_as_professional($1, $2, $3, $4, $5, $6, $7, $8, $9)',
  ['Hari Karki', '9811111111', '', ['plumber'], 6, '', '12-34-56', 'Ram Thapa 9800000009', true])));

const hariId = (await as(HARI, APPLY, hariForm))[0].id;
let app = await application(HARI);
ok('application saved as a draft', app.state === 'draft' && app.phone === '+9779811111111' && app.services.join() === 'plumber');
ok('every answer comes back for correcting', app.dob_bs === '2045-03-12' && app.emergency_phone === '+9779800000007'
  && app.reference_phone === '+9779800000009' && app.reference_relation === 'employer' && app.payout_method === 'esewa'
  && app.payout_account === '+9779811111111' && app.id_district === 'Kavrepalanchok' && app.skill_level === 'level1');
ok('the team still sees the reference in one line', (await one('select reference_contacts r from professional_private where professional_id = $1', [app.id])).r === 'Ram Thapa (employer) 9800000009');
await as(HARI, APPLY, form(hariAnswers, { payout_method: 'bank', payout_bank: 'Nabil Bank', payout_account: '0123456789', payout_account_name: 'Hari Karki' }));
ok('bank details are saved', (await one('select payout_method::text m, payout_bank b, payout_account_number n from professional_private where professional_id = $1', [app.id])).n === '0123456789');
await as(HARI, APPLY, hariForm);
ok('applicant is not yet a professional', (await as(HARI, 'select my_professional_id() as id'))[0].id === null);
ok('same number cannot be used by someone else', (await err(OTHER, APPLY, hariForm))?.includes('already registered'));
ok('draft can be corrected', !(await err(HARI, APPLY, form(hariAnswers, { services: ['plumber', 'electrician'] })))
  && (await application(HARI)).services.length === 2);
ok('customer profile is untouched', (await one('select role, full_name from profiles where id = $1', [HARI])).role === 'customer');
ok('private details are hidden from other users', (await as(OTHER, 'select * from professional_private')).length === 0
  && (await as(OTHER, 'select * from professional_documents')).length === 0);

// --- Documents --------------------------------------------------------------
const DOC = 'select record_professional_document($1, $2)';
ok('cannot record a file in someone else\'s folder', (await err(HARI, DOC, ['selfie', `${OTHER}/selfie.jpg`]))?.includes('not in your folder'));
ok('path tricks are refused', (await err(HARI, DOC, ['selfie', `${HARI}/../${OTHER}/selfie.jpg`]))?.includes('not in your folder'));
ok('unknown document kinds are refused', (await err(HARI, DOC, ['passport', `${HARI}/passport.jpg`]))?.includes('Unknown'));
ok('cannot submit without the photos', (await err(HARI, 'select submit_professional_application()'))?.includes('citizenship front'));
for (const kind of ['citizenship_front', 'citizenship_back', 'selfie']) await as(HARI, DOC, [kind, `${HARI}/${kind}.jpg`]);
await as(HARI, DOC, ['selfie', `${HARI}/selfie-2.jpg`]);
ok('uploading again replaces the old file', (await one(`select count(*)::int c, max(path) p from professional_documents where professional_id = $1 and kind = 'selfie'`, [hariId])).p.endsWith('selfie-2.jpg'));
await as(HARI, 'select submit_professional_application()');
app = await application(HARI);
ok('submitted: waiting for the team', app.state === 'in_review' && app.documents.length === 3);

// --- Team review ------------------------------------------------------------
const REVIEW = 'select review_professional($1, $2, $3)';
ok('applicants cannot approve themselves', (await err(HARI, REVIEW, [hariId, true, null]))?.includes('Only the team'));
ok('applicants cannot set themselves verified directly', (await as(HARI, `update professionals set verification_status = 'verified' where id = $1 returning id`, [hariId])).length === 0);
ok('rejecting needs a reason', (await err(ADMIN, REVIEW, [hariId, false, '']))?.includes('needs to fix'));

const mayaId = (await as(MAYA, APPLY, form(hariAnswers, {
  full_name: 'Maya Gurung', phone: '9822222222', gender: 'female', area: '', services: ['home-cleaning'], years: '2',
  about: '', id_number: '99-88-77', reference_name: 'Sita Rai', reference_phone: '9800000008', payout_account: '9822222222',
})))[0].id;
ok('team cannot review a draft', (await err(ADMIN, REVIEW, [mayaId, true, null]))?.includes('not waiting'));
for (const kind of ['citizenship_front', 'citizenship_back', 'selfie']) await as(MAYA, DOC, [kind, `${MAYA}/${kind}.jpg`]);
await as(MAYA, 'select submit_professional_application()');
await as(ADMIN, REVIEW, [mayaId, false, 'The citizenship photo is blurred. Please retake it.']);
app = await application(MAYA);
ok('rejected with the reason shown', app.state === 'rejected' && app.rejection_reason.includes('blurred'));
ok('rejected applicant gets no jobs', (await as(MAYA, 'select * from my_job_offers()')).length === 0);
await as(MAYA, DOC, ['citizenship_front', `${MAYA}/citizenship_front-2.jpg`]);
await as(MAYA, 'select submit_professional_application()');
ok('fixing and resubmitting goes back to review', (await application(MAYA)).state === 'in_review');

await as(ADMIN, REVIEW, [hariId, true, null]);
app = await application(HARI);
ok('approved', app.state === 'verified' && (await as(HARI, 'select my_professional_id() as id'))[0].id === hariId);
ok('approval is recorded', (await one('select verified_at, reviewed_by from professionals where id = $1', [hariId])).reviewed_by === ADMIN);
ok('cannot be reviewed twice', (await err(ADMIN, REVIEW, [hariId, true, null]))?.includes('not waiting'));
ok('approved people cannot rewrite their details', (await err(HARI, APPLY, hariForm))?.includes('already registered'));
ok('profile shows the services', (await as(HARI, 'select * from my_professional()'))[0].services.includes('Plumber'));

// --- A job, with commission and earnings -------------------------------------
const task = await one(`select t.id from service_tasks t join services s on s.id = t.service_id where s.slug = 'plumber' and t.slug = 'tap-repair'`);
await db.query('update service_tasks set price = 1000 where id = $1', [task.id]);
const address = (await as(CUSTOMER, `insert into addresses (customer_id, area, landmark, latitude, longitude)
  values ($1, 'Baneshwor', 'near the temple', 27.6915, 85.342) returning id`, [CUSTOMER]))[0].id;
const slot = (await one(`select ((date_trunc('day', now() at time zone 'Asia/Kathmandu') + interval '1 day 10 hours') at time zone 'Asia/Kathmandu') as t`)).t;
const booking = (await as(CUSTOMER, 'select * from create_booking($1, $2, $3, false, null, $4)', [task.id, address, slot, '9800000001']))[0];
const payment = (await as(CUSTOMER, `select * from submit_advance_payment($1, 'esewa', 'TEST1234')`, [booking.id]))[0];
await as(ADMIN, 'select review_payment($1, true)', [payment.id]);
const offers = await as(HARI, 'select * from my_job_offers()');
ok('newly approved professional is offered the job', offers.length === 1 && offers[0].booking_id === booking.id);
ok('accepts', (await as(HARI, 'select respond_to_offer($1, true) as r', [offers[0].offer_id]))[0].r === 'assigned');
const job = (await as(HARI, 'select * from my_jobs()'))[0];
ok('job carries the map pin', Number(job.latitude) === 27.6915 && Number(job.longitude) === 85.342);
const code = (await one('select start_code from bookings where id = $1', [booking.id])).start_code;
await as(HARI, 'select start_job($1, $2)', [booking.id, code]);
await as(HARI, `select complete_job($1, null, 'cash')`, [booking.id]);
const done = await one('select status, commission_amount from bookings where id = $1', [booking.id]);
ok('commission of 15% recorded when the job is done', done.status === 'completed' && Number(done.commission_amount) === 150, String(done.commission_amount));

let earnings = (await as(HARI, 'select my_earnings() as e'))[0].e;
const row = earnings.jobs[0];
ok('earnings: billed 1000, commission 150, net 850', Number(row.billed) === 1000 && Number(row.commission) === 150 && Number(row.net) === 850);
ok('earnings: Rs 800 cash collected (the rest was the online advance)', Number(row.cash_collected) === 800);
ok('balance: company owes Rs 50 (850 earned - 800 cash kept)', Number(earnings.balance) === 50, String(earnings.balance));
ok('finished job hides the pin again', (await as(HARI, 'select latitude from my_jobs()'))[0].latitude === null);

ok('professionals cannot record settlements', (await err(HARI, `select record_settlement($1, 50, 'esewa')`, [hariId]))?.includes('Only the team'));
await as(ADMIN, `select record_settlement($1, 50, 'esewa', 'Weekly payout')`, [hariId]);
earnings = (await as(HARI, 'select my_earnings() as e'))[0].e;
ok('after the payout the balance is zero', Number(earnings.balance) === 0 && earnings.settlements.length === 1);
await db.query('update booking_settings set commission_percent = 20');
ok('changing the percentage does not rewrite old jobs', Number((await one('select commission_amount from bookings where id = $1', [booking.id])).commission_amount) === 150);
ok('customers and applicants have no earnings', (await as(CUSTOMER, 'select my_earnings() as e'))[0].e === null
  && (await as(MAYA, 'select my_earnings() as e'))[0].e === null);
ok('other people cannot read settlements', (await as(OTHER, 'select * from professional_settlements')).length === 0);

// --- Suspension -------------------------------------------------------------
ok('suspending needs a reason', (await err(ADMIN, 'select set_professional_suspended($1, true, $2)', [hariId, '']))?.includes('why'));
await as(ADMIN, 'select set_professional_suspended($1, true, $2)', [hariId, 'Complaint under review']);
ok('suspended: no access to jobs or earnings', (await application(HARI)).state === 'suspended'
  && (await as(HARI, 'select * from my_jobs()')).length === 0
  && (await as(HARI, 'select my_earnings() as e'))[0].e === null);
await as(ADMIN, 'select set_professional_suspended($1, false, null)', [hariId]);
ok('restored', (await application(HARI)).state === 'verified');

console.log(failures ? `\n${failures} FAILED, ${passes} passed` : `\nALL ${passes} PASSED`);
process.exit(failures ? 1 : 0);
