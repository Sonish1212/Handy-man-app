# Existing application repair review

6 November 2026. Scope: existing designs, image coverage, reliability and booking-rule defects. No new product features, real payment integration or live database changes.

## Changes

- Added matching synthetic worker illustrations for home cleaning and general cleaning. All nine named service categories now have a bundled image; the generic Other services card retains its intentional icon. Existing supplied images remain. Provenance is in `assets/photos/README.md`.
- Remote service/banner image failures now fall back to bundled images, then an icon. Failed professional headshots fall back to initials, without substituting an invented worker identity.
- Service names can wrap to two lines in the grid. Reviewed service, booking, customer, team and professional layouts at 390 × 844. Corrected the full-day duration wording.
- Added a request timeout, error cleanup for loading/busy states and guarded stale auth/profile responses. Cached customer/team/professional lists are tied to the signed-in account. Customer bookings and saved addresses are explicitly filtered by customer ID even when the signed-in user is an admin.
- Catalogue failures preserve useful display content but cannot submit fallback task slugs as database UUIDs. Unknown booking-service routes show an unavailable message instead of an endless spinner. Inactive services/tasks are excluded from the customer catalogue.
- Numeric booking settings are converted only for numeric settings; payment account identifiers retain leading zeroes and remain text.
- Removed internal database instructions from payment-screen copy. Changed missing-price placeholders to “Price pending”, aligned advance/balance messaging and clarified that the team arranges refunds. No automatic fee deduction or refund has been introduced.
- Sign-in failures release busy states; code-entry controls are labelled appropriately for verification or job start. Phone/message links handle launch failures gracefully.
- Fixed professional earnings week counts to use completion dates returned by `my_jobs()`.
- Sample booking data now reuses the sample professional and avoids adding another sample set for an account that already has one.
- Updated the supported transitive Zod dependency from 3.25.76 to 4.6.7, clearing the high audit advisory. PGlite is a development dependency, not an application runtime dependency.

## Database repair to apply

`supabase/migrations/20261106000000_booking_repairs.sql` follows the professional-app migration. It runs transactionally and:

- Rechecks regular slot capacity under a shared scheduling lock.
- Rejects overlapping assignments across different bookings and resets start-code attempts when assignment changes.
- Revalidates verification, availability, service eligibility, advance settlement and conflicting work when accepting an offer.
- Locks the booking while reporting an advance, so retries update the pending deposit rather than creating another one.
- Excludes travelling/working or overlapping professionals from ASAP availability.
- Adds completion timestamps to the existing professional jobs response for earnings calculations, preserving contact masking and keeping start codes private.

For an existing Supabase project with the six earlier migrations already applied, test this one file on a staging copy, then run it in SQL Editor. Do not rerun the whole initial schema. This repair pass has **not** applied it to the hosted project. Until it is applied, these server-side repairs are not active there.

The scheduling lock serializes booking scheduling writes across this pilot. That favors correctness at the current scale; load-test it before wider rollout and revisit the locking scope when volume grows.

## Verification

- `npm run lint`: passed.
- `npm run typecheck`: passed. This JavaScript project uses `checkJs: false`; this is a compiler/configuration check, not full TypeScript coverage.
- `npm test`: passed. Two Node tests cover Nepal-time behavior and timeout/cancellation/recovery. Nine local PGlite groups cover slot capacity, deposit retries, payment authorization, automatic offers, stale offer rejection, overlapping assignment, private start codes and role boundaries, travelling-worker ASAP exclusion, job/parts/completion/billing, earnings timestamp availability and sample reruns.
- All seven migrations and the seed execute in the isolated test database. No hosted customer records are involved.
- iOS and Android production Hermes bundles: compiled successfully. The first sandboxed attempt was blocked from writing temporary bytecode; the permitted run outside that sandbox succeeded. This does not reproduce or diagnose the earlier Expo Go crash on a physical phone.
- Browser demo walkthrough: homepage, all 15 rendered homepage images, cleaning service pages, job/time/address/review flow, saved draft, demo confirmation feedback, email sign-in with wrong/correct demo code, name entry, booking/cancel/past cards, rating control, account, area change, team queue/offer feedback, professional jobs/start-code feedback/earnings/profile. Browser error logs at the end contained no errors. Direct page loads were slow in this test environment, including temporary blank loading views; they eventually rendered.
- Screenshots: `output/repair-review/general-cleaning.png` and `output/repair-review/booking.png`. Native exports and build logs are in the same local output folder, excluded from git.

## Boundaries and remaining work

No physical iPhone/Android runtime, live OAuth/SMS provider, real payment/refund or multi-connection Postgres race test was performed. Local PGlite checks establish sequential invariants, not proof of concurrency behavior under production isolation and load. Retest customer → team → professional acceptance on the hosted staging project after applying the SQL.

The final package update reports 17 moderate dependency advisories, chiefly Expo/lint/tunnel tooling. No forced SDK downgrade or incompatible security update was applied. Review their resolved versions and exposure before release.

Booking creation still has no durable client retry key: after an ambiguous network failure, customers should check Bookings before confirming again. Payment reporting retries have been repaired. Final prices, payment destinations and the support number still require business configuration. Existing placeholders such as Offers, account management rows, in-app rescheduling, automatic refunds/fee deductions, quote approval and notifications were not implemented in this pass.

These results are a bounded repair review, not a claim that every possible defect or security issue has been eliminated.
