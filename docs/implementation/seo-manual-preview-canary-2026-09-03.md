# SEO manual Preview canary — 2026-09-03

## Decision

- `STATUS`: `MANUAL_PREVIEW_CANARY_IMAGE_AND_PUBLISH_GATE_PASS`
- `SCHEDULER_CANARY`: `PENDING`
- `AUTO_PUBLISH`: `NOT_USED`
- `PRODUCTION`: `NO_GO`

One authenticated, administrator-triggered AI draft was generated in the
stable Preview environment. No Production configuration or data was changed,
and no article was approved, scheduled or published by this canary.

## Evidence

- Preview route: `/admin-v2/blog`.
- Draft ID: `3`.
- Title: `Når lønner det seg å impregnere takstein?`.
- Primary keyword: `impregnering av takstein`.
- Recorded Preview time: `2026-09-03 01:24`.
- Resulting state shown in the operator UI: `ŽMOGAUS PERŽIŪRA`
  (`human review`).
- The draft editor contained Norwegian body content, SEO title, SEO
  description and a reviewer field.
- Returning to the blog list showed the new item as `ŽMOGAUS PERŽIŪRA`; the two
  older published articles remained unchanged.
- The first stock-image action exposed a client request defect: blank optional
  `query` and `scheduledAt` values were sent and rejected as `Invalid action`.
- Fix commit `30e06bc` now omits blank optional action fields. Focused tests,
  TypeScript, ESLint and the full `277` file / `1,245` test unit/API suite
  passed.
- Vercel Preview deployment `dpl_6LDV1vXpsLW1dttMWesYqJRB2uqz` built
  successfully and was assigned to the stable UAT alias.
- The repeated stock-image action then completed successfully. The draft
  preview displayed a roof image with visible photographer `Jan van der Wolf`
  and Pexels source links.
- Commit `29c46e8` added a shared fail-closed publication invariant, an Admin V2
  review panel and an explicit approve-before-publish transition. The full
  `300` file / `1,299` test suite, TypeScript and ESLint completed without
  errors; the final review-panel refinement passed `5/5` focused tests.
- Vercel Preview deployment `dpl_Fw1ct4qXuANZQ1ioksvfEYpXk8ue` built
  successfully and was assigned to the stable UAT alias.
- Live UAT on draft `3` showed four explicit publication blockers: approval,
  persisted reviewer/date, deterministic quality and a precise article-level
  source. Both homepage-only sources were visibly marked, Pexels provenance
  remained visible, and the `Publikuoti` button was disabled.
- PR `#20` added a deterministic catalogue of six verified DiBK,
  Arbeidstilsynet and SINTEF deep links to the approved generation knowledge.
  The model is instructed to copy a relevant catalogue URL verbatim instead of
  inventing, shortening or replacing it with a publisher homepage.
- PR `#20` merge SHA `8e8cb17ca22fbb651ea707fa124667f8e376b46b`
  passed exact-merge Quality run `33706596917`, including lint, typecheck,
  unit/API, migration, PostgreSQL build, authenticated browser smoke and
  backup/restore checks.
- Preview deployment `dpl_UjAhF8tKarHoAZHdSM3dUJfmt6nh` completed successfully
  and now serves the stable UAT alias. Switching the alias invalidated the
  current administrator session, so the post-fix live draft canary is waiting
  for the owner to sign in again; authentication was not automated.
- No approve, schedule or publish action was triggered during this check.

## What this proves

- The authenticated Admin V2 action can invoke the AI content engine in the
  current Preview environment.
- The result is persisted as a reviewable draft and is not published by the
  creation action.
- Pexels enrichment, persisted image rendering and public-preview attribution
  work after the blank-field request fix.
- Human approval remains a separate operator action.
- Admin V2, the scheduled publisher and direct Payload writes now use the same
  server-side publication requirements. AI-assisted content additionally needs
  a passed quality result with score `>=75` and at least one precise source URL.

## What remains unproven

- Cron-triggered draft generation and same-slot duplicate protection were not
  exercised by this manual canary.
- Vercel cron configuration is Production-scoped; the current repository has
  no safe Preview ad-hoc scheduler path. The canary must not bypass
  `CRON_SECRET` or expose it in a browser. A real scheduler canary therefore
  needs an explicit owner-controlled Vercel invocation/environment decision.
- A fresh post-PR-`#20` manual draft still needs to confirm that the live model
  actually returns a relevant catalogue deep link. The deterministic prompt
  and its regression tests are proven, but model behavior is not claimed until
  that UAT draft exists.
- Article facts, language quality, internal links and commercial wording still
  require human editorial review before approval.
- `SEO_PILOT_REFERENCE`, Search Console setup and all Production feature/config
  changes remain pending owner-controlled release work.

## Next safe milestone

After the owner signs in again, create one manual Preview draft and confirm that
it remains unpublished and contains at least one relevant catalogue deep link.
Then decide an owner-controlled scheduler-canary route through Vercel. Keep
`FEATURE_SEO_AUTO_PUBLISH=false`; do not represent scheduler idempotency as
live-proven until an authorized real run and same-slot duplicate check are
observed.
