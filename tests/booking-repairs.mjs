import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
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
  const customer = 'aaaaaaaa-0000-0000-0000-000000000001';
  const admin = 'bbbbbbbb-0000-0000-0000-000000000002';
  const worker = 'cccccccc-0000-0000-0000-000000000003';
  await db.exec(`insert into auth.users (id, email) values
    ('${customer}', 'customer@example.test'), ('${admin}', 'admin@example.test'), ('${worker}', 'worker@example.test');
    update profiles set role = 'admin' where id = '${admin}';`);
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const as = (user, sql, params = []) => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    await tx.exec('set local role authenticated');
    return (await tx.query(sql, params)).rows;
  });
  const task = await one(`select t.id, t.service_id from service_tasks t join services s on s.id=t.service_id
    where s.slug='plumber' and t.slug='tap-repair'`);
  await db.query('update service_tasks set price=480 where id=$1', [task.id]);
  const address = await one(`insert into addresses (customer_id,area,landmark)
    values ($1,'Baneshwor','Test landmark') returning id`, [customer]);
  const pro = await one(`insert into professionals (user_id,full_name,phone,area,verification_status)
    values ($1,'Test worker','+9779811111111','Baneshwor','verified') returning id`, [worker]);
  await db.query('insert into professional_services values ($1,$2)', [pro.id, task.service_id]);
  const slot = (await one(`select ((date_trunc('day',now() at time zone 'Asia/Kathmandu')
    + interval '1 day 10 hours') at time zone 'Asia/Kathmandu') as value`)).value;
  // No phone on the account (email sign-in): the booking itself must have one.
  await assert.rejects(as(customer, 'select * from create_booking($1,$2,$3,false,null)', [task.id,address.id,slot]), /mobile number/);
  await assert.rejects(as(customer, 'select * from create_booking($1,$2,$3,false,null,$4)', [task.id,address.id,slot,'12345']), /mobile number/);
  console.log('PASS booking without a valid mobile number refused');
  const book = async () => (await as(customer, 'select * from create_booking($1,$2,$3,false,null,$4)', [task.id,address.id,slot,'98 0000 0001']))[0];
  const first = await book();
  assert.equal(first.contact_phone, '+9779800000001');
  console.log('PASS booking keeps the job phone number');
  assert.equal((await one('select contact_phone from profiles where id=$1',[customer])).contact_phone,'+9779800000001');
  console.log('PASS first booking saves the number on an email account');
  await as(customer, "update profiles set contact_phone='+9779811111111' where id=$1", [customer]);
  assert.equal((await one('select contact_phone from profiles where id=$1',[customer])).contact_phone,'+9779800000001');
  await assert.rejects(as(customer, "select set_my_contact_phone('12345')"), /mobile number/);
  assert.equal((await as(customer, "select set_my_contact_phone('९७ १२३४ ५६७८') as phone"))[0].phone,'+9779712345678');
  console.log('PASS account number changes only through the checked function (Nepali digits too)');
  const second = (await as(customer, 'select * from create_booking($1,$2,$3,false,null)', [task.id,address.id,slot]))[0];
  assert.equal(second.contact_phone,'+9779712345678');
  console.log('PASS booking without a job number uses the account number');
  await assert.rejects(book(), /slot is full/);
  console.log('PASS slot capacity enforced');
  const report = (id, ref = 'TEST1234') => as(customer, "select * from submit_advance_payment($1,'esewa',$2)", [id,ref]);
  const payment = (await report(first.id))[0];
  await report(first.id, 'TEST5678');
  assert.equal(Number((await one("select count(*) n from payments where booking_id=$1 and kind='deposit'", [first.id])).n),1);
  console.log('PASS payment retries update one deposit');
  await assert.rejects(as(customer, 'select * from review_payment($1,true)', [payment.id]), /Only the team/);
  await as(admin, 'select * from review_payment($1,true)', [payment.id]);
  const offer = await one("select id from job_offers where booking_id=$1 and professional_id=$2 and response='no_reply'",[first.id,pro.id]);
  assert.ok(offer);
  console.log('PASS only team confirms payment, automatic offer created');
  await db.query('update professionals set is_available=false where id=$1',[pro.id]);
  assert.equal((await as(worker, 'select respond_to_offer($1,true) result',[offer.id]))[0].result,'taken');
  console.log('PASS unavailable worker cannot accept stale offer');
  await db.query('update professionals set is_available=true where id=$1',[pro.id]);
  await as(admin,'select * from assign_professional($1,$2)',[first.id,pro.id]);
  const payment2=(await report(second.id))[0];
  await as(admin,'select * from review_payment($1,true)',[payment2.id]);
  await assert.rejects(as(admin,'select * from assign_professional($1,$2)',[second.id,pro.id]),/already has a job/);
  console.log('PASS overlapping assignment refused');
  assert.equal((await as(worker,'select * from my_jobs()'))[0].start_code,undefined);
  assert.equal((await as(worker,'select * from my_jobs()'))[0].customer_phone,'+9779800000001');
  console.log('PASS assigned professional sees the job phone number');
  await assert.rejects(as(customer,'select mark_on_the_way($1)',[first.id]),/Job not found/);
  console.log('PASS worker never receives start code, customer cannot advance job');
  await as(worker,'select mark_on_the_way($1)',[first.id]);
  assert.equal((await db.query('select asap_available($1,$2) value',[task.service_id,'Baneshwor'])).rows[0].value,false);
  console.log('PASS travelling worker excluded from ASAP');
  assert.equal((await as(worker,'select start_job($1,$2) value',[first.id,first.start_code]))[0].value,'started');
  const part=(await as(worker,"select * from request_extra_part($1,'New washer',50)",[first.id]))[0];
  await assert.rejects(as(worker,"select * from complete_job($1,null,'cash',null)",[first.id]),/has not answered/);
  await as(customer,'select * from decide_extra_part($1,true)',[part.id]);
  await as(worker,"select * from complete_job($1,null,'cash',null)",[first.id]);
  assert.equal((await one('select status from bookings where id=$1',[first.id])).status,'completed');
  assert.equal(Number((await one("select sum(amount) paid from payments where booking_id=$1 and status='paid'",[first.id])).paid),530);
  assert.ok((await as(worker, 'select * from my_jobs()'))[0].completed_at);
  console.log('PASS start, parts approval, completion and bill totals');
  await db.exec('update booking_settings set slot_capacity = 3');
  const samples = fs.readFileSync(new URL('sample_bookings.sql', dir), 'utf8').replaceAll('you@example.com', 'customer@example.test');
  await db.exec(samples);
  await db.exec(samples);
  assert.equal(Number((await one("select count(*) n from addresses where customer_id=$1 and label='Home (sample)'", [customer])).n), 1);
  console.log('PASS sample data can be run twice without duplicate samples');
  console.log('All database repair checks passed. Concurrency requires a separate multi-connection Postgres test before launch.');
} finally {
  await db.close();
}
