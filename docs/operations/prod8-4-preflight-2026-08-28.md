# PROD-8.4 reminders and SEO preflight — 2026-08-28

## Decision

**PRECHECK PASS / OWNER ACTION REQUIRED. Do not activate yet.** Code gates are verified, but Production is missing `CRON_SECRET` and `PEXELS_API_KEY`. The two PROD-8.4 flags must remain disabled until the owner completes the dependency steps and a controlled Preview test passes.

## Dependency matrix

| Dependency | State | Evidence / action |
|---|---|---|
| Gemini | READY | Production variable exists; combined daily/monthly usage limits have passing tests. |
| Resend | READY | Production variable exists; message delivery remains idempotent. |
| Pexels | **MISSING** | `PEXELS_API_KEY` is absent from the Production variable-name inventory. Owner must add it as a Production secret. |
| Cron authorization | **MISSING** | `CRON_SECRET` is absent from the Production variable-name inventory. Owner must add it as a Production secret and the same value as GitHub Actions secret `TAKFORNYELSE_CRON_SECRET`. |
| Automated reminder flag | HOLD | Keep `FEATURE_AUTOMATED_REMINDERS=false` until controlled UAT. |
| SEO scheduler flag | HOLD | Keep `FEATURE_SEO_SCHEDULER=false` until controlled UAT. |
| Emergency pause | READY FOR PILOT CONTROL | Keep the current safety pause while dependencies are introduced; unpause only the explicitly approved controlled step. |
| Job concurrency | READY IN PATCH | Pending/retry jobs are atomically claimed, so overlapping Vercel/GitHub cron calls cannot process one job twice. |

## Verified safety properties

1. Cron endpoints reject a request without the shared secret using timing-safe comparison.
2. SEO generation creates an `_status=draft` / `editorialStatus=ai_qa` record using a weekly-slot idempotency key.
3. AI cannot publish its own draft. Automatic publication selects only a future-scheduled draft that an administrator has already reviewed and approved.
4. A payment reminder cannot be prepared until the invoice is overdue and an administrator has checked the bank on the same Europe/Oslo date.
5. The payment reminder is created with `status=draft`; preparation never calls the email provider or queue. Sending remains a separate administrator decision.
6. Repeating reminder preparation on the same day reuses the same idempotency key.
7. Provider failures are sanitized; bounded retry eventually moves a job to human attention.
8. Gemini usage is bounded by combined daily and monthly counters. Pexels keys stay in authorization headers and image downloads are host/content-type constrained.
9. An atomic conditional job claim prevents two cron invocations from processing the same pending/retry job concurrently.

Automated evidence: **11 files / 37 tests PASS** for cron auth, SEO draft/scheduled publication gates, invoice reminder approval, Gemini limits, provider handling, retries and operational job claiming.

## Owner dependency steps (morning)

1. Vercel project → Settings → Environment Variables.
2. Add `CRON_SECRET` as **Secret**, environment **Production**, with a newly generated strong value. Do not paste it into chat or Git.
3. GitHub repository → Settings → Secrets and variables → Actions → New repository secret.
4. Add `TAKFORNYELSE_CRON_SECRET` with exactly the same value.
5. Add `PEXELS_API_KEY` as **Secret**, environment **Production**.
6. Redeploy once while both PROD-8.4 feature flags remain false.
7. In `/admin-v2/settings`, confirm Jobs and stock-image dependencies are green without revealing values.

## Controlled activation scenario

1. Snapshot current deployment and the two feature flags.
2. Enable only `FEATURE_AUTOMATED_REMINDERS` and `FEATURE_SEO_SCHEDULER`; redeploy.
3. Call each protected cron once with the configured scheduler. A no-secret request must return 401.
4. Generate exactly one SEO draft, repeat the same slot, and confirm the second call reports duplicate without a second post.
5. Confirm the article remains unpublished until an administrator approves/schedules or explicitly publishes it.
6. With a synthetic overdue invoice, check the bank today and prepare one reminder. Confirm it remains a draft and no customer receives it.
7. Confirm zero failed/late jobs, no duplicate messages and no new 5xx after 5, 15 and 30 minutes.

## Rollback

Set both PROD-8.4 flags to false, set `AUTOMATION_EMERGENCY_PAUSE=true`, redeploy the previous stable configuration, and cancel only pending SEO/reminder test jobs. Do not delete generated draft, message or audit evidence.
