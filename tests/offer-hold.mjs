// Paid bookings that nobody could take go on hold and are offered again
// automatically when someone becomes free
// (migration 20261122000000_offer_hold_and_retry.sql). Runs on a local
// copy of the database (PGlite), so nothing touches the real project.
//   node tests/offer-hold.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const pass = (text) => console.log(`PASS  ${text}`);

try {
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

  const CUSTOMER = 'aaaaaaaa-0000-0000-0000-000000000001';
  const ADMIN = 'bbbbbbbb-0000-0000-0000-000000000002';
  const RAM = 'cccccccc-0000-0000-0000-000000000003';
  const SITA = 'dddddddd-0000-0000-0000-000000000004';
  await db.exec(`insert into auth.users (id, email) values
    ('${CUSTOMER}', 'customer@example.test'), ('${ADMIN}', 'admin@example.test'),
    ('${RAM}', 'ram@example.test'), ('${SITA}', 'sita@example.test');
    update profiles set role = 'admin' where id = '${ADMIN}';
    update booking_settings set slot_capacity = 5;`);

  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const as = (user, sql, params = []) =>
    db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
      await tx.exec('set local role authenticated');
      return (await tx.query(sql, params)).rows;
    });

  const task = await one(`select t.id, t.service_id from service_tasks t join services s on s.id = t.service_id
    where s.slug = 'plumber' and t.slug = 'tap-repair'`);
  const address = await one(
    `insert into addresses (customer_id, area, landmark) values ($1, 'Chabahil', 'Test landmark') returning id`,
    [CUSTOMER],
  );
  // Ram: plumber, works anywhere, not taking jobs yet. Sita: approved, no services yet.
  const ram = await one(`insert into professionals (user_id, full_name, phone, area, verification_status, is_available)
    values ($1, 'Ram', '+9779811111111', null, 'verified', false) returning id`, [RAM]);
  await db.query('insert into professional_services values ($1, $2)', [ram.id, task.service_id]);
  const sita = await one(`insert into professionals (user_id, full_name, phone, area, verification_status, is_available)
    values ($1, 'Sita', '+9779822222222', null, 'verified', true) returning id`, [SITA]);

  const slot = async (hours) =>
    (await one(`select ((date_trunc('day', now() at time zone 'Asia/Kathmandu') + interval '1 day'
      + make_interval(hours => $1)) at time zone 'Asia/Kathmandu') as value`, [hours])).value;
  const bookAndPay = async (hours) => {
    const booking = (await as(CUSTOMER, 'select * from create_booking($1, $2, $3, false, null, $4)', [task.id, address.id, await slot(hours), '9800000001']))[0];
    const payment = (await as(CUSTOMER, "select * from submit_advance_payment($1, 'esewa', 'TEST1234')", [booking.id]))[0];
    await as(ADMIN, 'select * from review_payment($1, true)', [payment.id]);
    return booking;
  };
  const openOffer = (bookingId, proId) =>
    one("select id from job_offers where booking_id = $1 and professional_id = $2 and response = 'no_reply'", [bookingId, proId]);
  const notes = async (bookingId) =>
    (await db.query("select note from booking_events where booking_id = $1 and note is not null order by created_at", [bookingId])).rows.map((r) => r.note);

  // 1. Nobody free: on hold, with a note that says so.
  const first = await bookAndPay(10);
  assert.equal(await openOffer(first.id, ram.id), undefined);
  assert.ok((await notes(first.id)).some((note) => note.includes('On hold')));
  pass('nobody free: booking on hold, note says it will be offered automatically');

  // 2. Ram turns "taking jobs" on: he gets the waiting job straight away.
  await as(RAM, 'select set_my_availability(true)');
  assert.ok(await openOffer(first.id, ram.id));
  assert.ok((await notes(first.id)).some((note) => note.includes('someone became free')));
  pass('a professional turning available gets the waiting job');

  // Changes that free nobody new do not fill the history with notes.
  const before = (await notes(first.id)).length;
  await as(SITA, 'select set_my_availability(false)');
  await as(SITA, 'select set_my_availability(true)');
  assert.equal((await notes(first.id)).length, before);
  pass('retries that offer nothing add no notes');

  // 3. Sita starts doing plumbing: she gets it too (all matching, first to accept wins).
  await db.query('insert into professional_services values ($1, $2)', [sita.id, task.service_id]);
  assert.ok(await openOffer(first.id, sita.id));
  pass('a professional with a new service gets the waiting job');

  // 4. Ram takes the first job. A second job at the same time finds Ram busy;
  // Sita says no. When the first job is cancelled, Ram is free and gets it.
  const ramOffer = await openOffer(first.id, ram.id);
  assert.equal((await as(RAM, 'select respond_to_offer($1, true) as result', [ramOffer.id]))[0].result, 'assigned');
  const second = await bookAndPay(10);
  assert.equal(await openOffer(second.id, ram.id), undefined);
  const sitaOffer = await openOffer(second.id, sita.id);
  assert.ok(sitaOffer);
  await as(SITA, 'select respond_to_offer($1, false)', [sitaOffer.id]);
  await as(ADMIN, "select * from team_cancel_booking($1, 'Customer changed plans')", [first.id]);
  assert.ok(await openOffer(second.id, ram.id));
  assert.equal(await openOffer(second.id, sita.id), undefined);
  pass('a cancelled job frees its professional, who gets the waiting job; a "no" is respected');

  // 5. Handing a job back: the person is not offered it again by later retries.
  await as(ADMIN, 'select * from assign_professional($1, $2)', [second.id, ram.id]);
  await as(RAM, "select * from release_job($1, 'My bike broke down')", [second.id]);
  await as(SITA, 'select set_my_availability(false)');
  await as(SITA, 'select set_my_availability(true)');
  assert.equal(await openOffer(second.id, ram.id), undefined);
  assert.ok(await one("select 1 from job_offers where booking_id = $1 and professional_id = $2 and response = 'declined'", [second.id, ram.id]));
  pass('someone who handed a job back is not offered it again');

  // 6. Customers and professionals cannot run the retry themselves.
  await assert.rejects(as(CUSTOMER, 'select retry_waiting_bookings()'), /permission denied/);
  await assert.rejects(as(RAM, 'select auto_offer_job($1)', [second.id]), /permission denied/);
  pass('only the database itself runs the retries');

  console.log('\nALL OFFER-HOLD CHECKS PASSED');
} finally {
  await db.close();
}
