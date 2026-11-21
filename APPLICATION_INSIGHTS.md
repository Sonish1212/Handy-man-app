# Application knowledge and insights

Reviewed: 6 November 2026. Owner: Sonish. Market: Nepal.

## Repair addendum — 6 November 2026

The review below describes the earlier baseline. A subsequent repair pass added bundled cleaning illustrations and image-error fallbacks, bounded network requests, guarded stale auth/list state, explicitly scoped customer bookings/addresses, preserved payment-account identifiers as text, and corrected misleading pricing/refund copy. Seven migrations now exist. The new `20261106000000_booking_repairs.sql` adds a scheduling lock and invariant checks, revalidates offer acceptance, serializes advance submissions, excludes busy professionals from ASAP, and returns completion dates for earnings counts. These are local changes; hosted deployment is not verified.

Maintained local checks now live in `tests/`; `npm test`, lint and the configured compiler check pass. This is JavaScript with `checkJs: false`, so the compiler check is not full static typing. iOS and Android Hermes production bundles compile. Phone-sized browser checks covered the customer booking flow, demo sign-in, area selection, team dispatch, professional job/start-code/profile/earnings screens. No live customer transaction, OAuth/SMS provider or physical iPhone was tested in this pass. See `REPAIR_REPORT.md` for precise boundaries and deployment instructions.

The earlier high-priority findings about capacity/assignment locking, stale acceptance and advance reporting have local repairs. Real multi-connection concurrency validation is still required. Booking creation still has no durable retry key; automatic refunds/fee deduction and recorded quote approval remain outside this no-new-features pass. The later dependency update removed the high Zod advisory; 17 moderate tooling advisories remain.

## Scope and evidence

This reference describes the source code in this workspace, six SQL migrations, the seed and sample scripts, the Supabase README, and the owner's original product notes. It separates implemented behavior from business intent. It is not a security certification or a report of live business performance.

No production customer records, passwords, tokens, payment references or private professional documents were exported. The current hosted schema, provider settings and real transactions were not queried during this review. A migration existing here does not prove it was applied to the hosted project. The design PDF remains a source artifact; this review did not re-extract its contents.

## Business and product understanding

This is a Nepal home-services business connecting customers to verified tradespeople, with a team coordinating dispatch and payments. Security, ease of use, friendliness and maintainability are explicit owner requirements. It is intended to become an operating business, not a demonstration project.

The owner wants customers to browse before signing in, give clear job details and a landmark, pay an advance, know who is coming, share a start code on arrival, approve additional parts, and keep a job/payment history. Professionals may work through the app or through calls/SMS handled by the team. Repeated late professional cancellations should affect recommendations.

The project currently uses the internal name `handyman-mobile`; final public branding is not established in the configuration.

## Three connected experiences

| Audience | Access and screens | Current responsibility |
| --- | --- | --- |
| Customer | Home, Bookings, Offers, Account; service, booking, payment and location screens | Browse, book, report advance, track, approve parts, cancel, rate |
| Team | Account → Team; queue and booking details | Check payments, offer/assign jobs, act for phone-only workers, manage notes and exceptions |
| Professional | Separate Jobs, Earnings, Profile tabs; job detail | Availability, accept/decline, travel, start, request parts, finish/release job |

A professional account is a Supabase user linked through `professionals.user_id`. It is not a separate authentication service or separate installed app. The `profiles.role` enum has customer/admin; professional status comes from the linked professional record. Verified phone confirmation can link the account; the team can link email accounts manually for testing.

Professional routing replaces the customer tabs. A user linked as both professional and admin will enter the professional tabs, so team access for that combination needs an explicit product decision. Screen visibility is not an authorization boundary; database checks remain necessary.

## Implemented customer journey

1. Browse the homepage, search services, choose an area, follow a banner or seasonal offer.
2. Open a service page and choose a sub-job with duration, price and inclusion/exclusion information.
3. Complete Job → Time → Address → Confirm. A landmark is required for a new address. Other/unspecified jobs require a description in the UI.
4. Sign in at confirmation if necessary. An address is saved, then `create_booking()` creates the job with server-selected prices and advance.
5. Pay externally and enter a transaction ID. The app reports the reference; it does not move money.
6. Team confirms the payment. Suitable app professionals receive database offers automatically.
7. First accepted offer gets the booking. Customer sees the assigned professional, call button and progress.
8. Worker marks on the way and enters the customer's four-digit start code to start.
9. Customer answers extra-part requests. Worker/team completes the job and records the balance payment method.
10. Job moves to Past with a receipt and customer rating.

Half-finished booking drafts persist locally by service slug. Drafts are not currently scoped to the signed-in user. Leaving and returning resumes data, but the saved slot must still pass server validation.

## Catalogue and geography

Main categories: Plumber; Electrician; Painter; Tile and marble; AC and appliances; Water purifier; Labour and mistri; Home cleaning; General cleaning; Other services.

The local task catalogue defines 39 sub-jobs. Examples include tap/pipe/toilet/geyser work, wiring and fitting jobs, painting, appliance repair, water filter service, helpers/mistri by duration, deep cleaning by home size, and general cleaning by hours. SQL and JavaScript both carry catalogue copies and can drift.

The original seed contains 11 service rows, including four featured standalone jobs from the removed Most booked section. Later migrations add cleaning and Other services. Main homepage categories and total database service rows are therefore different counts.

Location picker: 23 approximate area centres across Kathmandu, Lalitpur and Bhaktapur. Default is Baneshwor. GPS picks a centre within 3 km; this is a convenience heuristic, not a verified service boundary or exact address. Manual area selection remains available.

Photos are bundled locally and can be overridden by a database image URL. Cleaning categories now have bundled synthetic illustrations. Carpenter and car-mechanic assets are spare rather than launched categories.

## Configured business rules and placeholders

| Rule | Source default | Meaning |
| --- | --- | --- |
| Advance | Rs 200 | Credited toward bill; capped at a known total |
| ASAP surcharge | Rs 100 | Added separately to base job price |
| Travel fee | Rs 150 | Setting exists; deduction/refund flow remains unfinished |
| Visit charge | Rs 200 | Setting exists; enforcement remains unfinished |
| Free-cancel window | 3 hours | Business rule/settings; customer cancellation settlement is not implemented |
| Standard slots | 2 hours, 8 am–6 pm | Last regular start 4 pm Nepal time |
| Standard notice | 2 hours | ASAP is the intended exception |
| Booking horizon | 7 days | Server uses an exact now-plus-days cutoff |
| Area/slot capacity | 2 | Count check exists; concurrent enforcement needs hardening |
| ASAP window | About 2 hours | Accepted only before 4 pm with current hours |

These are placeholders pending team agreement, not final tariffs. Most task prices remain null and display `Rs [price]`. Fixed-price and quote-first jobs need a deliberate final pricing policy before paid launch.

Booking slots use Nepal time, UTC+5:45. Sydney's offset changes with daylight saving; do not hard-code the older chat's 4h15 conversion. On this review date Sydney is 5h15 ahead of Nepal.

Season ranges are phone-local Gregorian dates: festival 15 Sep–20 Nov; winter 21 Nov–end Feb; summer 1 Mar–31 May; monsoon 1 Jun–14 Sep. Festival dates need yearly review. A season is selected when Home mounts, so a continuously open screen may retain an old season.

## Dispatch and job lifecycle

Stored statuses: `requested → assigned → on_the_way → in_progress → completed`, plus `cancelled`.

Displayed labels such as Waiting for advance and Checking your payment are derived from payment records; they are not stored booking statuses.

Actual transition rules also permit assigned → in_progress (arrival without marking travel), and assigned/on_the_way → requested when a worker is released. Thus the implementation is not strictly forward-only, despite older descriptions.

Payment confirmation automatically offers both normal and ASAP jobs to all matching app professionals. Matching checks verification, linked account, service, availability, area and overlapping work. Phone-only professionals require team calls/texts. Offers are database rows; automatic offers do not send push notifications or SMS.

If a worker releases a booking, it is offered again excluding that worker. Repeated late releases increment a counter; candidate ordering can use it. There is no automatic penalty payment system.

Five incorrect start-code attempts lock professional attempts; team can still enter the correct code. Pending extra parts block completion. Cash balance records count as paid immediately; online references remain pending until checked. Earnings shows customer billing, not an actual payout ledger or net professional income.

## Data model: 15 public tables

| Table | Purpose |
| --- | --- |
| profiles | Identity mirror, name, phone/email, customer/admin role |
| addresses | Customer addresses, area, city, landmark, details and optional map fields |
| professionals | Worker identity, linked account, verification, area, availability and late cancellations |
| professional_private | Restricted payout/identity/reference information |
| professional_services | Worker-to-service capabilities |
| services | Categories and legacy featured jobs, pricing type, public catalogue content |
| service_tasks | Sub-jobs, price, expected duration, active state |
| booking_settings | Operating rules, amounts and payment destinations |
| promos | Homepage banners and optional active date windows |
| bookings | Customer/job/address/slot/worker, amounts, code, status and timestamps |
| booking_events | Status history and private team notes |
| job_offers | Recipient, channel, response and timestamps |
| extra_parts | Proposed items and customer approval |
| payments | Advance/balance/parts/refund records, methods, references and verification state |
| ratings | Per-booking ratings from either side |

Supabase's managed auth schema is additional to these public tables. All public tables have RLS declarations in the migration chain. Private team notes are filtered away from customer status history. Worker RPCs omit the start code and hide structured customer contact/address fields after completion; free-text descriptions can still contain personal information.

Key RPC families: create_booking/slot_counts/asap_available; submit_advance_payment/review_payment; dispatch_candidates/assign_professional/send_job_offers/respond_to_offer; mark_on_the_way/start_job/request_extra_part/complete_job/release_job; cancel_booking/decide_extra_part; my_professional/my_job_offers/my_jobs/set_my_availability.

## Authentication and local storage

Google OAuth and phone/email OTP are implemented. Actual delivery depends on hosted provider settings, SMS sender and SMTP/templates. Apple code remains present but the owner has deferred it; button availability checks provider/device support. A development-only password form signs into users created in Supabase.

Native login sessions use expo-sqlite localStorage; web uses localStorage. The selected area and booking drafts are also stored locally. No service-role secret belongs in the app. Environment-local files are gitignored. This review did not open or copy their contents.

Startup releases its loading gate after six seconds even if profile loading is delayed. That avoids indefinite blank startup, but role/profile failures can temporarily route a professional to customer UI. Session/profile refresh callbacks also need a stale-response review when switching accounts.

## Technical map

Expo SDK 58, React 19.3, React Native 0.88.1, Expo Router, JavaScript, Supabase/Postgres/Auth. Fonts: Noto Sans and Noto Sans Devanagari. Green/sage palette with terracotta and marigold accents. Shared theme defines 44px tap targets and a 12px minimum Nepali text size.

Routes live in `src/app`; reusable components in `src/components`; queries/auth/time helpers in `src/lib`; bundled catalogues/images/area and season data in `src/data` and `assets/photos`.

Commands: `npm run start`, `npm run web`, `npm run web:demo`, `npm run emulator`. The emulator script uses localhost. For the owner's iPhone workflow, Expo was previously run with `npx expo start --tunnel --clear`. SDK compatibility must be checked against the installed Expo Go version when upgrading.

Six ordered migrations exist: initial schema; RLS/booking functions; email login; booking creation; dispatch; professional app/automatic offers. `seed.sql` is separate. `sample_bookings.sql` is testing data only. Its rerun behavior should be checked because professional phone numbers are unique.

## Priority findings from source review

| Priority | Finding | Practical consequence / next step |
| --- | --- | --- |
| High | Slot creation counts existing jobs then inserts without a capacity lock | Two simultaneous requests can exceed the last available capacity. Serialize by area/slot and test separate database connections. |
| High | Assignment/acceptance locks a booking, not the professional across different bookings | Same booking accepts are serialized, but two overlapping bookings can assign the same worker concurrently. Add worker serialization or a database scheduling constraint. |
| High | Offer acceptance does not recheck verification, availability, service eligibility or advance settlement | Eligibility may change after the offer was sent. Revalidate at acceptance. |
| High | Cancellation records a status but does not calculate/deduct fees or execute refunds | Customer-facing refund/fee statements are ahead of settlement behavior. Align wording and implement a recorded refund workflow. |
| High | No idempotency keys for booking creation/payment reporting; reporting uses select then insert | Network retries can duplicate business records. Add server-enforced request/reference uniqueness and transactional locking. |
| Medium | Draft keys use service slug only; some loaded lists are not explicitly cleared on logout | Review cross-account local data on shared devices; scope sensitive drafts and clear stale state. |
| Medium | Availability check for ASAP is less detailed than assignment busy-window checks | A job can appear bookable even when no worker can actually take it. Reuse one server eligibility definition. |
| Medium | Customer descriptions are returned to workers before acceptance | Structured address protection does not sanitize personal details typed into descriptions. Review disclosure wording/fields. |
| Medium | Settings/catalogue fallbacks can hide backend failure | Screen may look healthy with stale defaults while real booking fails. Make backend readiness/errors clear at confirmation. |
| Medium | Admin accounts have broad direct-table RLS permissions | RPC validation is not the only mutation path for admins. Review least privilege and business-rule enforcement before wider team access. |
| Medium | Quote-first final prices are entered by worker/team without recorded customer quote approval | Capture agreed pricing before work rather than relying on an unwritten conversation. |

Concurrency items above are code-level risk findings, not race conditions reproduced in this review. Earlier chat claims that double-booking was impossible were broader than the locking visible in the source supports.

## Remaining product and operations work

- Real payment integration, payment reconciliation, refund execution, cancellation deductions and a ledger for commissions/payouts.
- Push notifications, live updates, automatic SMS and delivery/retry monitoring.
- Offer expiry, no-response escalation, no-show handling and an operational ASAP guarantee/refund mechanism.
- In-app rescheduling/editing. Existing buttons direct customers to contact the team.
- Public support number; `SUPPORT_PHONE` is null. Account saved-address/payment/help rows remain placeholders.
- Offers tab is a ComingSoon screen. Book again navigates home rather than recreating the earlier job.
- Professional onboarding/verification and ongoing support process. App tabs do not replace vetting.
- Final prices, supported payment destinations, cleaning photos, and Nepali copy review.
- Committed/reproducible automated tests, CI, monitoring and release configuration. Earlier local test runs were reported in chat; those scratchpad scripts are not a maintained test suite in this repository.
- Repository checkpoint: current git status shows substantial uncommitted implementation. Preserve a reviewed baseline before expanding scope.

## Insights the business could measure

The schema supports booked services, completed-job revenue records, area demand, accept/decline rates, cancellation reasons, professional ratings, job timing and payment-check delays. These are potential analyses, not measured results in this report.

Recommended definitions: request-to-paid conversion; paid-to-assigned delay; offer-to-accept delay; paid-to-arrival time for ASAP; cancellation rate by stage; customer-approved extras; pending-online-payment age; completion/rebooking rate; contribution after worker payout, refunds and support cost.

Browsing conversion cannot be derived from booking tables alone: page views, searches and abandoned booking steps have no event instrumentation here. Historical edits to prices/settings are not a full financial audit trail. Separate test bookings from business records before calculating KPIs.

## Review verification and boundaries

Source files and migration logic were reviewed without changing application behavior or hosted records. ESLint was run during this review; verification result is recorded in the accompanying chat. The repo is JavaScript and has no TypeScript project configuration, so a successful static typecheck is not currently established. Historical database tests and device testing are useful prior evidence, but were not rerun or re-certified here.

This document is the working reference for future changes. Prefer source/migration evidence over old chat assertions, and update the implemented/planned distinction as each capability is delivered.
