# Supabase backend

The database for the app: tables, security rules and the starting catalogue.

| File | What it does |
| --- | --- |
| `migrations/20261018000000_initial_schema.sql` | Creates the tables (below) |
| `migrations/20261018000100_security_and_booking_functions.sql` | Row level security, `cancel_booking()`, `decide_extra_part()` |
| `migrations/20261020000000_email_sign_in.sql` | Adds `email` to profiles for customers who sign in by email |
| `migrations/20261027000000_booking_flow.sql` | Booking settings, sub-jobs, cleaning services, `create_booking()`, `submit_advance_payment()` |
| `migrations/20261030000000_dispatch.sql` | Status rules, team actions (check payments, offer, assign), professional actions (accept, on the way, start code, done) |
| `migrations/20261031000000_professional_app.sql` | Jobs are offered automatically once the advance is confirmed (and again if a professional drops out); professional profile details |
| `migrations/20261106000000_booking_repairs.sql` | Rechecks slot capacity and professional overlap under a scheduling lock, rejects stale offer acceptance, serializes advance submissions, excludes busy workers from ASAP |
| `migrations/20261106000000_booking_repairs.sql` | Repairs to booking and dispatch rules (double-booking races, earnings dates) |
| `migrations/20261115000000_professional_onboarding.sql` | Professional app: applying, document photos (private storage), team approval, commission and earnings |
| `migrations/20261120000000_professional_application_details.sql` | The full application form: date of birth (18+), districts, ID details, skills, emergency contact, reference with phone, payout account |
| `migrations/20261122000000_offer_hold_and_retry.sql` | Paid bookings nobody could take go on hold and are offered automatically when a professional becomes free |
| `migrations/20261122000100_booking_contact_phone.sql` | Every booking has a mobile number for the job, shown to the assigned professional and the team |
| `migrations/20261122000200_account_phone.sql` | No booking without a mobile number on the account: email and Google sign-ins save it at their first booking or under Account |
| `sample_bookings.sql` | Not a migration: sample bookings for a test account (run by hand) |
| `seed.sql` | The launch services and the three homepage promos (safe to run again) |

## Tables

| Table | Holds |
| --- | --- |
| `profiles` | One row per signed-in user (customer or admin). Created automatically on sign-up |
| `addresses` | Customers' saved addresses with area, landmark and map pin |
| `professionals` | Plumbers, electricians and others. The app is optional: SMS-only professionals work through the team |
| `professional_private` | Payout account, citizenship number, references, admin notes. **Admin only** |
| `professional_services` | Which services each professional does |
| `services` | The catalogue, with English and Nepali names, pricing type, and what's included |
| `service_tasks` | The jobs under each trade (Plumber → Tap repair…), each with its own price and duration |
| `booking_settings` | One row of amounts and rules: advance, ASAP charge, fees, slot times, payment accounts |
| `promos` | Homepage banners, with optional start and end dates |
| `bookings` | Each job: customer, service, address, time slot, status, start code, price |
| `booking_events` | History of every status change (the Bookings page timeline) |
| `job_offers` | Every time a job was offered to a professional, and their reply |
| `extra_parts` | Parts the professional needs, with the customer's approve or decline |
| `payments` | Deposits, balances, travel fees and refunds (eSewa, Khalti, IME Pay, bank, cash) |
| `ratings` | One rating from each side per booking |

Booking status goes `requested → assigned → on_the_way → in_progress → completed`, or `cancelled`
before the work starts. The database refuses any other change, whoever makes it (see "Fixing a
mistake" below).

## Who can see what

- **Anyone**, even before signing in, can read active services and live promos.
- **Customers** see only their own profile, addresses, bookings, payments and ratings, plus the
  professional assigned to their booking. They can't change a booking directly. Cancelling and
  approving parts go through `cancel_booking()` and `decide_extra_part()`, which check the rules.
  The server sets the status, price and start code on a new booking, whatever the app sends.
- **Professionals** with the app (their `professionals.user_id` is set) never read tables
  directly. They only get what `my_job_offers()` and `my_jobs()` return: offers show the job,
  area and time only; the address and customer contact appear once they accept, and disappear
  when the job is done. They never see the start code.
- **Admins** (`profiles.role = 'admin'`) are the team. They can read everything and use the
  Team screen in the app. Every team action is a function that checks the rules.
- **The Supabase dashboard** skips the row rules, but the status rules still apply there.

## Set up your project

1. Create a free project at [supabase.com](https://supabase.com). Pick the **Mumbai** region,
   the closest to Nepal.
2. Open **SQL Editor** and run these files in order, pasting each one and clicking **Run**:
   1. `migrations/20261018000000_initial_schema.sql`
   2. `migrations/20261018000100_security_and_booking_functions.sql`
   3. `migrations/20261020000000_email_sign_in.sql`
   4. `seed.sql`
   5. `migrations/20261027000000_booking_flow.sql`
   6. `migrations/20261030000000_dispatch.sql`
   7. `migrations/20261031000000_professional_app.sql`
   8. `migrations/20261106000000_booking_repairs.sql`
   9. `migrations/20261115000000_professional_onboarding.sql`
   10. `migrations/20261120000000_professional_application_details.sql`
   11. `migrations/20261122000000_offer_hold_and_retry.sql`
   12. `migrations/20261122000100_booking_contact_phone.sql`
   13. `migrations/20261122000200_account_phone.sql`
3. In **Project Settings**, copy the project URL and the **publishable** key. Copy
   `.env.example` to `.env.local` in the `handyman-mobile` folder and paste them in. Never use
   the secret key in the app.
4. Restart the app (`npx expo start --clear`). The homepage now loads services and promos from
   the database, and the login screen leaves demo mode.

## Sign-in setup

Customers sign in, or sign up the first time, with a 6-digit code sent to their **phone** or
**email**. There are no passwords, and the same screen handles both sign-in and sign-up.

**Email** works as soon as the project exists, after one change:

1. Go to **Authentication → Emails → Templates → Magic Link**.
2. Replace the body with a code instead of a link, for example:
   `<h2>Your sign-in code</h2><p>Enter this code in the app: <strong>{{ .Token }}</strong></p>`
3. Save. Without this step customers get a link instead of a code, and the app can't use the link.

Supabase's built-in email sender is only for testing: it sends very few emails per hour and may
only deliver to your own team's addresses. Before launch, add your own sender under
**Authentication → Emails → SMTP settings** (for example Resend, Brevo or Amazon SES).

**Phone** needs an SMS provider:

1. Go to **Authentication → Sign In / Providers → Phone** and turn it on.
2. Choose a provider (Twilio, MessageBird, Vonage or Textlocal are built in). For a Nepali
   provider such as Sparrow SMS, use the **Send SMS hook** instead.
3. Until a provider is set up, phone sign-in shows "isn’t switched on yet" and email still works.
   For testing without real SMS, the Phone provider settings can map test numbers to fixed codes.

Codes can be requested once every 60 seconds and expire after an hour. The app follows the
same 60-second wait before offering "Send a new code".

**Google** (free):

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then set up the
   **OAuth consent screen** (External, with the app name and your support email).
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**. Under
   **Authorized redirect URIs**, add `https://ldglhgffboqlgiavrrrl.supabase.co/auth/v1/callback`.
3. Copy the **Client ID** and **Client secret**. In Supabase, go to **Authentication → Sign In /
   Providers → Google**, turn it on, paste both, and save. Keep the secret out of the app and chat.
4. In Supabase, go to **Authentication → URL Configuration → Redirect URLs** and add
   `exp://**` (Expo Go) and `handymanapp://**` (the real app). Without these, Google sends
   people to the website instead of back into the app.

**Apple** ("Sign in with Apple", shown only on iPhones):

- **Testing in Expo Go** needs no paid account. In Supabase, go to **Authentication → Sign In /
  Providers → Apple**, turn it on, and add `host.exp.Exponent` (Expo Go's app ID) under **Client IDs**.
- **For the App Store** you need the Apple Developer Program ($99/year), your own bundle ID
  (for example `com.yourcompany.handyman`) with Sign in with Apple enabled, a development or
  production build, and that bundle ID added to the same **Client IDs** list.
- Apple requires apps that offer Google sign-in to also offer Sign in with Apple, so keep both.

Until a provider is switched on, its button explains that it isn't available yet instead of
opening an error page.

Using the Supabase CLI instead of the SQL Editor (`npx supabase link`, then `npx supabase db push`)
runs the same migrations and keeps a record of which ones have been applied.

## Still to decide or build

- **SMS provider and email sender** for launch (see Sign-in setup above). Until Supabase is
  connected the app runs in demo mode, where code `123456` signs in and nothing is saved.
- **Making yourself admin.** After your first sign-in, run one of these in the SQL Editor:
  `update public.profiles set role = 'admin' where email = 'you@example.com';` or
  `update public.profiles set role = 'admin' where phone like '%98XXXXXXXX';` (Supabase may store the number with or without the `+`)
- **Prices.** Every `services.base_price` is empty until real prices are agreed. The app shows `Rs [price]`.
- **Cancellation fees and refunds.** `cancel_booking()` only records the cancellation. Fee
  amounts are still open (design pack, section 8).
- **Notifications.** Nobody is told when something changes yet: pull down to refresh.
  Push notifications and automatic SMS come in later milestones.

## Two apps, one codebase

| App | Start it | Who uses it |
| --- | --- | --- |
| Customer app | `npx expo start --tunnel` | Customers, and the team (Account → Team) |
| Professional app ("Handyman Pro") | `npm run pro` | Professionals: joining, jobs, earnings |

Both use this one database. One person can use the same sign-in in both: in the customer app
they are a customer, in the professional app they are a professional (once approved).
`npm run pro:demo` opens the professional app in the browser with sample data and nothing saved.

## How a professional joins

1. In the professional app they sign in, fill in their details (name, mobile, services, area,
   experience, citizenship or National ID number, a reference) and agree to the document check.
2. They photograph both sides of their ID and their face, and optionally the police report
   (free from Nepal Police online or the Nagarik app). The photos go to a **private** storage
   bucket, `professional-documents`: a person can only write to their own folder, and only
   the team can open other people's files.
3. They send it. The team sees it in the customer app under **Account → Team → Professional
   applications**: check the face against the ID, call them and their reference, then
   **Approve** or **Send back** with what to fix.
4. Only an approved professional gets job offers. `set_professional_suspended()` stops
   someone at once after a serious complaint.

The team can still register SMS-only professionals directly in the `professionals` table, as before.

## Commission and earnings

`booking_settings.commission_percent` (placeholder: 15) is the company's share of the job
price and ASAP charge; money for parts is the professional's. The share is fixed on each job
when it is marked done, so changing the percentage never rewrites old jobs.

The professional's Earnings tab shows, per job, what the customer paid, the company's share
and what they keep, and at the top who owes whom after the cash they collected themselves.
When money changes hands, record it so their balance updates:

```sql
-- The company paid Hari Rs 500 (use a negative amount when he pays the company):
select public.record_settlement('<professional id>', 500, 'esewa', 'Weekly payout');
```

## Tests

`npm test` runs every migration in a throwaway database and checks the rules: bookings,
dispatch, and (`npm run test:pro`) joining, documents, approval, commission and earnings.
Run it after changing any SQL.

## Running bookings (pilot)

### One-time setup

1. **Team accounts.** Each team member signs in to the app once, then you make them admin in
   the SQL Editor (see "Making yourself admin" above). They now see **Team** in the Account tab.
2. **Professionals.** Add each one in `professionals` (name, phone, area,
   `verification_status = verified` once checked) and tick their services in
   `professional_services`. Leave `area` empty for someone who works anywhere.
3. **Professionals with a smartphone** sign in to the app with the same phone number. Their
   account links itself (the SMS code proves the number), and the app opens their own side
   (**Jobs**, **Earnings**, **Profile**) instead of the customer screens. That account is now
   a professional account: to book as a customer they need a different account (for example
   their email). Write the number as `98XXXXXXXX` or `+977 98XXXXXXXX`; both match. Email
   sign-in does not link: it has to be the phone.
4. **Testing without SMS:** link a professional to any account by hand, for example a second
   email account of yours:
   `update public.professionals set user_id = (select id from public.profiles where email = 'second@example.com') where full_name = 'Ram (sample)';`

### Every booking

All of this happens in the app under **Account → Team**.

1. **Payments tab:** a customer sent an advance transaction ID. Check it in the eSewa / Khalti
   / bank statement, then tap **Confirm** (or **Not received**, which lets them send it again).
2. **Confirming the advance sends the job out automatically** to every professional who can
   take it: verified, does that service, works in that area (or anywhere), has the app, is
   "Taking new jobs" and is free at that time. The first to accept gets it. The booking's
   history says who was offered, or that nobody was free.
3. **Assign tab:** paid bookings still waiting for a professional, urgent (ASAP) first. Open one:
   - The list shows who does that service: same area first, free before busy, with rating,
     jobs done, late cancellations and whether they have the app. Someone with another job at
     that time can't be chosen.
   - **Assign** when you have agreed it by phone, or **Offer** to let them accept. For ASAP,
     **Offer to all** sends it to every free professional; the first to accept gets it and the
     other offers close. People with the app accept in **My jobs**; for SMS-only people, use
     the call and text buttons (the text is written for you) and tap **Said yes** or **Said no**.
   - After assigning, tap the professional's text button: it fills in the job, address,
     customer contact and a reminder about the start code.
4. **Active tab:** jobs under way. The professional moves the job along in their app. For
   SMS-only professionals the team taps the same buttons when they phone in:
   - **On the way**, then **Start job** with the customer's 4-digit start code (the professional
     reads it out to you). After 5 wrong codes in the professional's app, it locks and only the
     team can start the job.
   - **Add extra part:** the customer approves or declines it in their app. The job can't be
     finished while a part is waiting.
   - **Mark job done:** enter the agreed price if the job had none (visit-and-quote, "Something
     else"), and how the rest was paid. Cash counts as paid; an online payment waits in the
     Payments tab for checking.
   - **Remove professional** (team) or **I can't do this job** (professional) puts the booking
     back to "Needs a professional" and offers it again to everyone else. A professional dropping a job less than 3 hours
     (`free_cancel_hours`) before it starts counts as a late cancellation on their record.
5. **Notes and history** on every booking: every status change with its time, every payment
   check, and your own notes. Customers only see the status changes, never notes.

### Fixing a mistake

The status rules also apply in the Table Editor. To correct a booking by hand (for example a
job marked done by accident), run this in the SQL Editor:

```sql
begin;
set local app.allow_status_fix = 'on';
update public.bookings set status = 'in_progress' where id = '...';
commit;
```

### Amounts and prices

**Amounts and rules** live in `booking_settings`. These are placeholders until the team
decides: advance Rs 200, ASAP Rs 100, travel fee Rs 150, visit charge Rs 200, free
cancellation up to 3 hours before, slots 8 am–6 pm, 2 bookings per slot per area. Put the
company's eSewa and Khalti IDs in `esewa_id` and `khalti_id` so customers see where to pay.

**Prices:** set `service_tasks.price` for each job. Until then the app shows `Rs [price]`.

**ASAP** only appears when a verified, available professional for that service works in the
customer's area. Professionals switch "Taking new jobs" on or off at the top of their Jobs tab.

## Repair verification (6 November 2026)

For an existing project with the previous migrations applied, run only `migrations/20261106000000_booking_repairs.sql` in SQL Editor. It runs in a transaction and changes existing rules, not your fees or catalogue. Test on a staging copy first. The file has not been applied to the hosted project by this repair pass.

Run `npm test` from the app folder for isolated local Postgres/PGlite checks. They do not connect to your Supabase project. They cover capacity, payment retry behavior, authorization, stale offers, overlapping assignments, start codes, parts, completion, billing, and sample-data reruns. PGlite does not prove behavior across concurrent database connections; test that separately against staging Postgres before launch.
