# SEO manual Preview canary — 2026-09-03

## Decision

- `STATUS`: `MANUAL_PREVIEW_CANARY_AND_IMAGE_PASS`
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

## What this proves

- The authenticated Admin V2 action can invoke the AI content engine in the
  current Preview environment.
- The result is persisted as a reviewable draft and is not published by the
  creation action.
- Pexels enrichment, persisted image rendering and public-preview attribution
  work after the blank-field request fix.
- Human approval remains a separate operator action.

## What remains unproven

- Cron-triggered draft generation and same-slot duplicate protection were not
  exercised by this manual canary.
- Article facts, language quality, internal links and commercial wording still
  require human editorial review before approval.
- `SEO_PILOT_REFERENCE`, Search Console setup and all Production feature/config
  changes remain pending owner-controlled release work.

## Next safe milestone

Run one authenticated Preview scheduler canary with
`FEATURE_SEO_AUTO_PUBLISH=false`, verify idempotent duplicate handling, and
record that the generated article remains unpublished. This requires no
Production activation but must not be represented as complete until the actual
scheduler result is observed.
