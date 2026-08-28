# Overnight release-safety evidence — 2026-08-29

- **Scope:** N-0 and N-6 only
- **Evidence collection:** 2026-08-28 20:00–20:31 UTC (23:00–23:31 EEST)
- **Method:** read-only Git, GitHub and Vercel metadata/log queries
- **External mutations:** none
- **Overall result:** **ATTENTION / OWNER ACTION**

The release candidate itself has a green Quality gate and a READY Preview. The
staging alias resolves to the exact candidate and Production has not moved.
Release approval is not yet transferable, however: the upstream PR Vercel check
still reports `Authorization required to deploy`, the automatic branch alias is
one commit behind the candidate, and fresh Production backup/restore, DB and
Blob evidence was outside this read-only scope.

## 1. N-0 baseline freeze

| Field                                    | Evidence                                                 |
| ---------------------------------------- | -------------------------------------------------------- |
| Branch                                   | `codex/master-platform-implementation`                   |
| Local `HEAD`                             | `29e51a76f9edfe132ab503bc7b6266cbfd76b822`               |
| Remote fork branch                       | `29e51a76f9edfe132ab503bc7b6266cbfd76b822`               |
| Commit                                   | `fix(admin): remove duplicate question recovery actions` |
| Commit author time                       | `2026-08-28T22:59:51+03:00`                              |
| Direct parent                            | `5a2f146b21e589931469eeef30ae924e65440572`               |
| Current Production code base             | `c5ecf4bae7cbd166b4579b265c7964744574050a`               |
| Merge-base with `upstream/main`          | `380f64d2d7092cfb0bdf7f681ad6afebe30030c1`               |
| Production → RC range                    | 24 commits; 68 files; 11,752 insertions; 1,382 deletions |
| Diff hygiene                             | `git diff --check c5ecf4b..29e51a7` exited `0`           |
| Migration files in Production → RC range | none                                                     |
| Generated schema/types                   | `src/payload/payload-types.ts` changed                   |

The absence of migration-file changes means this RC does not add another
migration relative to the currently deployed Production commit. It does not
prove that a live database restore is current, and it is not permission to run
down migrations.

### Worktree preservation

Before this evidence file was created, the tracked worktree had **0 changes**
and there were **117 pre-existing untracked files**. They were not opened for
editing, deleted, staged or included in this evidence change.

| Untracked root                 | File count |
| ------------------------------ | ---------: |
| `.agents/`                     |         36 |
| `.tmp-playwright-32899222073/` |         31 |
| `.tmp-playwright-32900220849/` |         31 |
| `docs/`                        |          1 |
| `scripts/`                     |          7 |
| `skills-lock.json`             |          1 |
| `tmp/`                         |         10 |

After this task, this new evidence document is the only intended additional
untracked file. No existing untracked artifact belongs to this release-safety
change.

### Concurrent worktree drift after baseline

The final read-only recheck found six tracked, unstaged changes that appeared
after the clean N-0 baseline was captured:

- `src/app/api/admin/leads/[id]/route.test.ts`
- `src/app/api/admin/leads/[id]/route.ts`
- `src/lib/ai/payload-usage-limit.test.ts`
- `src/lib/ai/payload-usage-limit.ts`
- `src/lib/messages/customer-reply-sources.test.ts`
- `src/lib/messages/customer-reply-sources.ts`

They were not inspected, edited, staged or included in this evidence task and
are not part of committed RC `29e51a7`. The Git and deployment manifest in this
document applies only to that committed SHA. If these changes become a new
commit, N-0, CI, Preview, aliases, 5xx observation and owner UAT must all be
repeated for the new exact SHA.

## 2. GitHub CI manifest

| Field      | Evidence                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------- |
| Workflow   | `Quality gate`                                                                           |
| Run        | [`33206300849`](https://github.com/fornyelsegruppen/landing_no/actions/runs/33206300849) |
| Job        | `98968104029`                                                                            |
| Event      | `push`                                                                                   |
| Head SHA   | `29e51a76f9edfe132ab503bc7b6266cbfd76b822`                                               |
| Status     | `completed`                                                                              |
| Conclusion | `success`                                                                                |
| Started    | `2026-08-28T20:00:00Z`                                                                   |
| Completed  | `2026-08-28T20:05:05Z`                                                                   |

Passed steps include dependency audit, generated Payload type synchronization,
lint, TypeScript, unit/API tests, migration up/down tests, empty PostgreSQL
bootstrap, production build, authenticated/public browser smoke and a synthetic
PostgreSQL backup/restore rehearsal.

| Test group                          |                Exact result |
| ----------------------------------- | --------------------------: |
| Unit/API                            | 182 files, 698 tests passed |
| Migration                           |   21 files, 39 tests passed |
| Browser smoke                       |             11 tests passed |
| Synthetic PostgreSQL backup/restore |                        PASS |

The synthetic CI restore proves the clean Linux test procedure only. It is not
a restore of a fresh Production snapshot.

### Upstream PR check discrepancy

PR `darbasnorvegija4-eng/landing_no#52` currently reports:

- `Vercel – landing-no`: **FAIL**;
- reason: `Authorization required to deploy`;
- the authorization target references exact SHA `29e51a76…`.

This conflicts with the separately observable READY Preview below. Treat the
GitHub/Vercel integration check as **OWNER ACTION**, not as a silent pass.

## 3. Preview manifest and alias chain

| Field            | Evidence                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| Deployment ID    | `dpl_4B2m6UdCxxcboBX8fSZthdRTXNPd`                                     |
| Immutable URL    | `https://landing-mw8auug33-darbasnorvegija4-8212s-projects.vercel.app` |
| Target           | `preview`                                                              |
| State            | `READY`                                                                |
| Created          | `2026-08-28T20:02:29.516Z`                                             |
| Git SHA metadata | `29e51a76f9edfe132ab503bc7b6266cbfd76b822`                             |
| Commit metadata  | `fix(admin): remove duplicate question recovery actions`               |
| Git ref metadata | `codex/master-platform-implementation`                                 |

Verified chain:

```text
takfornyelse-staging.vercel.app
  -> dpl_4B2m6UdCxxcboBX8fSZthdRTXNPd
  -> landing-mw8auug33-...vercel.app
  -> READY / preview
  -> 29e51a76f9edfe132ab503bc7b6266cbfd76b822
```

The automatic branch alias does **not** resolve to the same deployment:

```text
landing-no-git-fork-forn-aaae1c-...vercel.app
  -> dpl_AtWjWamojR841vh6PR4hxcJ5b95q
  -> landing-cm9wcdbfr-...vercel.app
  -> READY / preview
  -> 5a2f146b21e589931469eeef30ae924e65440572
```

Morning UAT must therefore use the immutable RC URL or the currently verified
`takfornyelse-staging.vercel.app` alias. The automatic branch alias is a STOP
for RC UAT until it is reverified at the moment of testing.

## 4. Production baseline manifest

| Field            | Evidence                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| Deployment ID    | `dpl_CvS7U3tgY16XmLss8aAciiKtZzK5`                                     |
| Immutable URL    | `https://landing-5nkw0sp1s-darbasnorvegija4-8212s-projects.vercel.app` |
| Target           | `production`                                                           |
| State            | `READY`                                                                |
| Created          | `2026-08-27T20:49:26.583Z`                                             |
| Git SHA metadata | `c5ecf4bae7cbd166b4579b265c7964744574050a`                             |
| Commit metadata  | `fix(admin): handle legacy messages without recovery state`            |

Production aliases remained attached to this deployment:

- `https://www.takfornyelse.as`
- `https://takfornyelse.as`
- `https://landing-no.vercel.app`
- `https://landing-no-darbasnorvegija4-8212s-projects.vercel.app`

No Production deployment, promote, rollback or alias command was executed.

## 5. Aggregated 5xx evidence

Only filtered counts were retained. No request body, response body, customer
identifier, token, recipient or log message was written to this document.

| Deployment               | UTC window                                    | Filter                                 | Result |
| ------------------------ | --------------------------------------------- | -------------------------------------- | -----: |
| RC Preview `dpl_4B2m6…`  | `2026-08-28T20:02:29Z`–`20:30:39Z`            | deployment-specific `5xx`, limit 1,000 |      0 |
| Production `dpl_CvS7U3…` | `2026-08-27T20:49:26Z`–`2026-08-28T20:30:39Z` | deployment-specific `5xx`, limit 1,000 |      0 |

Both Vercel CLI queries exited `0`. Zero observed 5xx does not prove that the
changed authenticated question workflow received live traffic or passed owner
UAT.

## 6. Environment name/scope inventory

The inventory used `vercel env ls <scope> --json`. Only variable names and
scope membership were retained. Values were not requested, pulled, displayed
or stored.

| Scope       | Count |
| ----------- | ----: |
| Production  |    56 |
| Preview     |    65 |
| Development |     0 |

### Present in both Production and Preview (38)

`ALLOW_PREVIEW_EMAIL_LOG`, `AUTOMATION_EMERGENCY_PAUSE`,
`BACKUP_LAST_VERIFIED_AT`, `BLOB_READ_WRITE_TOKEN`,
`CONTRACT_JOURNEY_QA_REFERENCE`, `DATABASE_URL`, `FEATURE_AI_DRAFTS`,
`FEATURE_AUTOMATED_REMINDERS`, `FEATURE_COMMUNICATION_ROUTING_V2`,
`FEATURE_CONTRACT_SIGNING`, `FEATURE_CUSTOMER_QUOTES`,
`FEATURE_ROOF_MEASUREMENT`, `FEATURE_SECURITY_HARDENING_V2`,
`FEATURE_SEO_SCHEDULER`, `FEATURE_WORKER_PORTAL`, `GEMINI_API_KEY`,
`GEMINI_DAILY_REQUEST_LIMIT`, `GEMINI_MODEL`,
`GEMINI_MONTHLY_REQUEST_LIMIT`, `LEAD_FROM_EMAIL`, `LEAD_TO_EMAIL`,
`LEGAL_REVIEW_REFERENCE`, `NEXT_PUBLIC_GOOGLE_ADS_ID`,
`NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL`, `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`,
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_META_PIXEL_ID`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `PAYLOAD_SECRET`,
`PLATFORM_ACTIVE_WAVE`, `PLATFORM_OPERATING_MODE`,
`QUOTE_JOURNEY_QA_REFERENCE`, `RESEND_API_KEY`, `RESTORE_TEST_REFERENCE`,
`SECURITY_HARDENING_QA_REFERENCE`, `SMS_PROVIDER`, `TURNSTILE_SECRET_KEY`.

### Production-only names (18)

`ADMIN_OPERATIONS_QA_REFERENCE`, `AI_CONTENT_PILOT_REFERENCE`,
`CUSTOMER_LIFECYCLE_QA_REFERENCE`, `CUSTOMER_TOKEN_SECRET`,
`EMAIL_ASSET_BASE_URL`, `FEATURE_ADMIN_EXCEPTION_FLOWS_V2`,
`FEATURE_CASE_STATE_ENGINE_V2`, `FEATURE_CUSTOMER_LIFECYCLE_V2`,
`FEATURE_MEASUREMENT_EVIDENCE_V2`, `PRICING_APPROVAL_REFERENCE`,
`PRODUCTION_OWNER_APPROVAL_REFERENCE`, `ROOF_EVIDENCE_QA_REFERENCE`,
`ROOF_TECHNICAL_QA_REFERENCE`, `SIGNATURE_APPROVAL_REFERENCE`,
`STAGING_QA_REFERENCE`, `STATE_INVARIANT_QA_REFERENCE`,
`UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`.

### Preview-only names (27)

`COMMUNICATION_V2_QA_REFERENCE`, `CRON_SECRET`,
`DATABASE_NEON_PROJECT_ID`, `DATABASE_PGDATABASE`, `DATABASE_PGHOST`,
`DATABASE_PGHOST_UNPOOLED`, `DATABASE_PGPASSWORD`, `DATABASE_PGUSER`,
`DATABASE_POSTGRES_DATABASE`, `DATABASE_POSTGRES_HOST`,
`DATABASE_POSTGRES_PASSWORD`, `DATABASE_POSTGRES_PRISMA_URL`,
`DATABASE_POSTGRES_URL`, `DATABASE_POSTGRES_URL_NO_SSL`,
`DATABASE_POSTGRES_URL_NON_POOLING`, `DATABASE_POSTGRES_USER`,
`DATABASE_URL_UNPOOLED`, `KV_REST_API_READ_ONLY_TOKEN`,
`KV_REST_API_TOKEN`, `KV_REST_API_URL`, `KV_URL`, `PEXELS_API_KEY`,
`REDIS_URL`, `RESEND_INBOUND_DOMAIN`, `RESEND_INBOUND_WEBHOOK_SECRET`,
`RESEND_WEBHOOK_SECRET`, `WORKER_MOBILE_QA_REFERENCE`.

### Name-only readiness findings

- Production has names for the primary DB, Payload secret, private Blob,
  Resend, Gemini, Turnstile and Upstash integrations. Presence does not prove a
  usable value or provider health.
- `CRON_SECRET` is absent from Production. Automated reminders,
  communication-routing jobs and SEO scheduler must not be enabled.
- `PEXELS_API_KEY` is absent from Production. Any release scope depending on
  production stock-image generation remains **OWNER ACTION**.
- `WORKER_MOBILE_QA_REFERENCE`, `COMMUNICATION_V2_QA_REFERENCE`,
  `COMMUNICATION_APPROVAL_REFERENCE` and `SEO_PILOT_REFERENCE` are absent from
  Production. Their related waves cannot be inferred as approved.
- Values of `FEATURE_*`, `AUTOMATION_EMERGENCY_PAUSE`,
  `PLATFORM_OPERATING_MODE` and `PLATFORM_ACTIVE_WAVE` were deliberately not
  read. Live enabled/disabled state is therefore **OWNER ACTION**.

## 7. Rollback card

**Pre-RC application rollback target**

| Field                  | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| Deployment             | `dpl_CvS7U3tgY16XmLss8aAciiKtZzK5`                               |
| SHA                    | `c5ecf4bae7cbd166b4579b265c7964744574050a`                       |
| State at evidence time | `READY`                                                          |
| Production URL         | `landing-5nkw0sp1s-darbasnorvegija4-8212s-projects.vercel.app`   |
| Incident owner         | company/Production owner — confirm named on-call owner before GO |

**Prospective owner-authorized rollback sequence**

1. Stop the rollout and customer-facing administrative action under test.
2. If communication safety is uncertain, owner sets
   `AUTOMATION_EMERGENCY_PAUSE` to the fail-closed state before any retry.
3. Disable the affected feature flag(s); do not broaden the change to unrelated
   features.
4. Owner explicitly authorizes promotion/rollback to `dpl_CvS7U3…`.
5. Reverify all four Production aliases, authentication boundaries and 5xx.
6. Run only approved read-only data/invariant checks. Do not resend messages or
   replay jobs while determining whether an operation committed.

Potential kill switches defined in the candidate code:

- `FEATURE_AI_DRAFTS`
- `FEATURE_ROOF_MEASUREMENT`
- `FEATURE_CUSTOMER_QUOTES`
- `FEATURE_CONTRACT_SIGNING`
- `FEATURE_WORKER_PORTAL`
- `FEATURE_AUTOMATED_REMINDERS`
- `FEATURE_SEO_SCHEDULER`
- `FEATURE_CASE_STATE_ENGINE_V2`
- `FEATURE_MEASUREMENT_EVIDENCE_V2`
- `FEATURE_ADMIN_EXCEPTION_FLOWS_V2`
- `FEATURE_COMMUNICATION_ROUTING_V2`
- `FEATURE_CUSTOMER_LIFECYCLE_V2`
- `FEATURE_SECURITY_HARDENING_V2`
- `AUTOMATION_EMERGENCY_PAUSE`

No flag value was inspected or changed. Versioned documentation currently
describes a controlled pilot, but current live values require owner-visible
verification before GO.

No migration files differ between the current Production commit and RC. If a
data anomaly is discovered, do not run reverse migrations or silently switch
the Production database. Freeze writes, preserve evidence, obtain owner
authorization for a forensic snapshot, compare the diff, and restore only to a
new isolated database first.

## 8. Evidence not collected: OWNER ACTION

| Missing evidence                                  | Why it was not collected                                             | Required morning action                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Fresh Neon Production snapshot/branch             | creation mutates provider state; DB operations were prohibited       | owner authorizes a fresh snapshot immediately before deploy                                               |
| Production row/migration/invariant counts         | no verified read-only DB role was used; all DB access was prohibited | use a confirmed read-only role/transaction and retain counts/codes only                                   |
| Isolated restore of the fresh Production snapshot | creates provider resources and requires DB access                    | restore to a separate restricted branch with email/cron disabled, then compare counts and relationships   |
| Fresh private Blob manifest                       | requires private store access; token/content access was out of scope | list metadata without URLs/content, compare object count/size/hash references, and record retention owner |
| Production Blob content/hash spot check           | would read private content                                           | owner selects an explicitly synthetic object; stream/hash without displaying URL, token or bytes          |
| Resend domain/provider health                     | provider API/UI requires account/secret-backed access                | owner verifies domain/sender status; do not send a test email until separately approved                   |
| Live feature and emergency-pause values           | env values were prohibited                                           | owner verifies expected controlled-pilot values in UI without copying secrets                             |
| Owner UAT on exact RC                             | requires authenticated human-visible actions and may send            | use only a synthetic case and owner-controlled address after separate approval                            |
| GitHub/Vercel authorization discrepancy           | PR check is failed even though a separate Preview is READY           | owner resolves/re-runs the exact-SHA Vercel check; require terminal PASS before Production GO             |

## 9. GO/STOP decision

### Proven tonight

- exact Git SHA and remote branch match;
- tracked worktree was clean before this evidence document;
- Linux Quality gate is green for the exact RC;
- exact RC Preview is READY;
- staging alias points to that exact deployment and SHA;
- observed filtered Preview and Production 5xx counts are zero;
- Production deployment, SHA and aliases did not move;
- no external state was changed.

### STOP before Production GO

Production remains **NO-GO** until all of the following are true:

1. Exact-RC owner UAT passes on the immutable URL or a freshly reverified
   staging alias.
2. The GitHub/Vercel authorization/check discrepancy is terminal PASS.
3. A fresh Production snapshot, isolated restore, non-secret row comparison and
   private Blob manifest are recorded.
4. Live controlled-pilot feature/emergency-pause state is owner-verified.
5. The owner names the incident lead and gives a separate moment-of-action GO.

Any SHA change invalidates this RC, CI, Preview and UAT chain and restarts N-0.
Any unexpected Production alias/deployment movement, relevant 5xx, wrong-case
access, duplicate message/job, data/hash mismatch or real-recipient send is an
immediate STOP.

## 10. Explicit non-actions

No POST request, deploy, promote, rollback, alias mutation, environment update,
feature-flag change, DB connection/query/migration/snapshot/restore, Blob access,
webhook/cron/job invocation, provider-secret access, email/SMS delivery, commit
or push was performed.
