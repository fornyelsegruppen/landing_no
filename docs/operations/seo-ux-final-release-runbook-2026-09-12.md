# SEO / Admin V2 UX final release — CONTROL review

Status: **PLAN READY FOR REVIEW; EXECUTION BLOCKED by the preconditions below.**
The owner has authorized the final-release workflow. This document does not
request another routine owner GO. CONTROL reviews the concrete plan before
execution. No deployment, runtime/config change, DB initialization, migration,
canary, or alias mutation was performed while preparing this document.

Scope: existing SEO fixes and Admin V2 history UX, plus reviewed minimal
release-safety hardening. Not a new One UI/RF release or a schema rollout.
Use `C:\Users\Fornyelsegruppen\.codex\worktrees\release-preflight-4adef31`,
branch `codex/release-preflight-4adef31`; application baseline `e11a895`,
reviewed documentation baseline `d566e60ef94f6c1550e80da6babeba0337e3dc64`.
Leave the separate local-candidate workspace and localhost:3000 untouched.

## Eight execution steps

### 1. Pin source, routing, scheduler, and recovery evidence

Verify clean `git status --short`, record `git rev-parse HEAD`, and confirm CLI
account `darbasnorvegija4-8212`, scope `darbasnorvegija4-8212s-projects`,
project `landing-no` / `prj_MWKBmg22GIxgiGmTtbT9Om3469aI`.
Use pinned `npx.cmd --yes vercel@59.16.0` for the commands below.

Read `alias ls --scope darbasnorvegija4-8212s-projects` and
`api /v9/projects/prj_MWKBmg22GIxgiGmTtbT9Om3469aI --method GET --scope darbasnorvegija4-8212s-projects --raw`.
Parse the API response in memory; save/output only project ID, `crons`,
`autoAssignCustomDomains`, and protection metadata, never the full env object.
Fresh read-only evidence at approximately 2026-09-12 02:44 Europe/Vilnius:

| Routing / recovery | Verified target |
| --- | --- |
| `takfornyelsenorge.no`, `www.takfornyelsenorge.no` | `landing-lizkuhfql-darbasnorvegija4-8212s-projects.vercel.app` |
| Rollback deployment / source | `dpl_GETi3v8dvpSxk8JgRbjtkFPoHga6`, READY; `412a6e9abf3904e3e5bdc59780012f4031e25ff9` |
| `takfornyelse.as`, `www.takfornyelse.as` | `landing-9hjfau7e4-darbasnorvegija4-8212s-projects.vercel.app` — preserve |
| Active scheduler deployment | `dpl_DCHmqvLSz3ndXbfdPLguHfoCLdBv` — still old `.as` deployment |

Rollback source was obtained from authenticated
`GET /v13/deployments/dpl_GETi3v8dvpSxk8JgRbjtkFPoHga6`, `meta.gitCommitSha`;
earlier CLI inspect's missing SHA is superseded by this evidence.
The **active project scheduler**, not merely `vercel.json`, is:

```json
{
  "enabledAt": 1784201037659,
  "disabledAt": null,
  "updatedAt": 1788669966767,
  "deploymentId": "dpl_DCHmqvLSz3ndXbfdPLguHfoCLdBv",
  "definitions": [
    {"host":"landing-9hjfau7e4-darbasnorvegija4-8212s-projects.vercel.app","path":"/api/cron/publish-posts","schedule":"15 6 * * *"},
    {"host":"landing-9hjfau7e4-darbasnorvegija4-8212s-projects.vercel.app","path":"/api/cron/purge-leads","schedule":"0 3 * * 0"},
    {"host":"landing-9hjfau7e4-darbasnorvegija4-8212s-projects.vercel.app","path":"/api/cron/seo-drafts","schedule":"0 7 * * 1,4"}
  ]
}
```

Compare enabled state, deployment ID, and sorted host/path/schedule definitions
after each deployment/alias action. Do not infer actual routing from
`targets.production`, which currently differs from custom aliases.

### 2. Close safety and access preconditions before deployment

Integrate the separately assigned Astra safety correction: remove
`prodMigrations` from the runtime Postgres adapter, set
`disableCreateDatabase: true`, and fail closed if `PAYLOAD_DROP_DATABASE=true`.
The runbook author does not edit Astra's files. Retain explicit migrations only in the
dedicated migration script; do not execute them. Verify offline that native
Payload admin/API initialization cannot migrate, create, or drop a database;
the current configuration requests no Postgres extensions. Run focused
regressions, typecheck, and diff checks; pin the resulting final source SHA.

Reason: installed Payload 3.88.0 `db-postgres/dist/connect.js` calls production
`migrate({migrations:this.prodMigrations})` independently of `push:false` and
`PAYLOAD_MIGRATING`. The app wrapper's build flag cannot protect native Payload
entry points. Before content tests, use the authorized DB connection directly
with `node scripts/run-migrate-status.mjs` (no Payload initialization or env
pull) and require every registered migration applied, no `batch=-1`.
The script also exits zero for non-Postgres/missing migrations: inspect its
actual comparison, not just exit status. Missing schema is a stop, not consent
to migrate. Credentials must remain in their approved secret channel.

Capture effective, nonsecret current reminder/routing flags, operating mode,
and emergency-pause state. CONTROL observed the current authenticated LT
Admin V2 dashboard: controlled pilot `PROD-8.2`, automatic sends paused.
That does not establish every reminder/routing flag. Preserve these values in
the final deployment; do not blank keys or change shared environment settings.
Confirm real Resend/Gemini/Pexels readiness and the existing verified sender.

Before canaries, ensure the immutable candidate can have an authorized app
session and its Turnstile widget accepts that hostname. Vercel SSO bypass is
not app authentication. Existing live-domain cookies are not a candidate
session. Do not extract credentials/cookies or bypass Turnstile. Identify the
approved inbox/provider-event access needed to prove all three deliveries.

Scheduler recovery is an **unresolved predeployment gate**: verify an exact
supported way to restore the snapshot above if staging changes it. The public
OpenAPI inspected exposes no documented cron-definition restoration PATCH;
do not invent one. Normal path leaves the existing scheduler untouched. In an
incident, project Settings → Cron Jobs → Disable Cron Jobs is documented, but
restoring aliases or an Instant Rollback alone does not restore cron jobs,
and disabling does not cancel an already-running invocation. CONTROL must
accept the recovery procedure and any interruption before staging. Never
probe `/api/cron/purge-leads` with a real secret. A candidate-only purge-disable
guard is a possible separately reviewed containment measure, not implemented
or presumed approved here. [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

### 3. Create one fresh functional staged deployment

Only after step 2 and CONTROL review pass, run from the pinned clean source:

```powershell
npx.cmd --yes vercel@59.16.0 deploy --prod --skip-domain --project landing-no --scope darbasnorvegija4-8212s-projects --yes --logs `
  --build-env NEXT_PUBLIC_SITE_URL=https://takfornyelsenorge.no --env NEXT_PUBLIC_SITE_URL=https://takfornyelsenorge.no `
  --env LEAD_TO_EMAIL=post@takfornyelsenorge.no --env LEAD_ADMIN_COPY_EMAIL=post@takfornyelse.as `
  --build-env FEATURE_AI_DRAFTS=true --env FEATURE_AI_DRAFTS=true `
  --build-env FEATURE_SEO_AUTO_PUBLISH=false --env FEATURE_SEO_AUTO_PUBLISH=false `
  --build-env FEATURE_SEO_SCHEDULER=false --env FEATURE_SEO_SCHEDULER=false `
  --build-env PUBLIC_HOST_REDIRECTS_ENABLED=false --env PUBLIC_HOST_REDIRECTS_ENABLED=false `
  --build-env DATABASE_URL_MIGRATE=file:./seo-no-migrations.db `
  --build-env PAYLOAD_BUILD_WITHOUT_DB=1
```

Require inherited runtime `PAYLOAD_BUILD_WITHOUT_DB` absent/0 and real provider,
DB, Turnstile, and CRON secrets; do not override those with empty values.
Resolve any difference from the step-2 nonsecret operating-state baseline
before running this command. No shared-env change, local env upload, or prebuilt
upload. Record deployment ID, immutable hostname, source SHA, build result,
and effective nonsecret configuration. `--skip-domain` stages a production
deployment without custom-domain promotion; it is not an asserted scheduler
isolation guarantee. Recheck step 1 immediately; any drift stops the sequence.
[Vercel deploy](https://vercel.com/docs/cli/deploy)

### 4. Prove actual CMS content and authenticated administration

Establish published CMS baseline: one CMS-only page and one post if present,
including slug, locale, title/body excerpt, metadata, and image. Public posts
require `_status=published` AND `editorialStatus=published`. Record zero-record
baselines honestly. On the candidate, use authorized protected requests and a
real app session to check `/no`, `/no/blogg`, exact CMS detail URLs,
`/sitemap.xml`, `/robots.txt`, `/admin-v2`, blog and case history reads.
Require expected content, canonicals on the new domain, images, access controls,
and the collapsed/anchored-history UX; SSO/login HTML with HTTP 200 is a fail.

The DB-free build can cache fallback home and sitemap data. Warm exact URLs,
allow home 30s / article 60s / sitemap 300s revalidation, then read again after
regeneration (bounded roughly six minutes; no busy-polling). Verify expected
CMS URLs in sitemap and draft URLs absent. A cache-busting query or HTTP 200
does not prove fallback replacement. If content does not converge, stop before
any alias change. Record response excerpts and checks without private data.

### 5. Submit exactly one approved contact-form canary

Use the real candidate browser form with genuine Turnstile and displayed test
consent: name `[RELEASE QA]`, unique release marker in message, email
`fornyelsegruppen@gmail.com`, locale `no`, service `usikker`, postal code `0150`.
No photos, contract, signature, real third-party phone/address, resend, or
editing/deleting old leads. Submit once; record lead/correlation/message/provider
IDs. On timeout inspect by marker before considering any retry.

Verify the customer receipt, admin notice to `post@takfornyelsenorge.no`, and
copy to `post@takfornyelse.as` through provider delivery events and actual inbox
evidence. API 200 is insufficient: delivery errors may be caught or returned by
the SDK without throwing. Distinguish provider acceptance, MX delivery, and
inbox receipt. Verify the new case history and resulting message status.
Expected existing side effects include the intake PDF attachment, audit/job
records, and, with AI enabled, a lead-response AI draft; this is not only one
external AI request. No automatic quote/contract send or publication is part
of the canary. Retain clearly marked QA records; no cleanup is authorized.

### 6. Generate one Oslo article, keep it unpublished

Before the single admin action, inspect eligible topics and account for
`ensureManualBlogTopics` adding missing seeds. Current
`POST /api/admin/blog/generate` has no topic parameter and selects the top
eligible score across the Oslo region or locationless topics. If exact Oslo
cannot be guaranteed, stop this canary for a narrowly reviewed topic-selection
solution; do not repeatedly generate until an Oslo result appears.

Invoke once through the authenticated UI. Record run/post IDs and provider
result. Require Oslo relevance, acceptable QA, `_status=draft`,
`editorialStatus=ai_qa`, no publication, and no sitemap entry. Inspect actual
stock-image attribution/alt and unapproved review state; no automatic image
approval. Topic seeding/status, run, and media changes are expected side
effects. Quality-blocked 422 is a failed canary, not success or automatic
permission to retry; each call currently uses a fresh idempotency key.

### 7. Move only the two new-domain aliases after all evidence passes

Set `$releaseCandidateHost` to the exact step-3 READY immutable hostname (not
the old nonfunctional candidate). Recheck scheduler/config and steps 4–6.
Then execute separately and verify after each:

```powershell
npx.cmd --yes vercel@59.16.0 alias set $releaseCandidateHost takfornyelsenorge.no --scope darbasnorvegija4-8212s-projects
npx.cmd --yes vercel@59.16.0 alias set $releaseCandidateHost www.takfornyelsenorge.no --scope darbasnorvegija4-8212s-projects
```

Do not run project-wide `vercel promote`, mutate DNS, move either `.as` alias,
or change shared env/cron configuration. Verify new-domain content/canonicals,
robots/sitemap, authenticated Admin V2, provider readiness, and unchanged
old-domain aliases and scheduler. [Explicit alias assignment](https://vercel.com/docs/cli/alias)

### 8. Observe and use scoped rollback on failure

Record final routing, effective flags, canary references, and errors. If either
alias operation or post-promotion checks fail, restore both new-domain aliases:

```powershell
npx.cmd --yes vercel@59.16.0 alias set landing-lizkuhfql-darbasnorvegija4-8212s-projects.vercel.app takfornyelsenorge.no --scope darbasnorvegija4-8212s-projects
npx.cmd --yes vercel@59.16.0 alias set landing-lizkuhfql-darbasnorvegija4-8212s-projects.vercel.app www.takfornyelsenorge.no --scope darbasnorvegija4-8212s-projects
```

Verify both mappings and the unchanged `.as` mappings. Compare the scheduler
snapshot independently: if unchanged, leave it alone; if changed, use only the
step-2 verified containment/restoration procedure. Report recovery incomplete
until enabled state and exact host/path/schedule targets are restored. Domain
rollback does not undo QA records or already-sent mail; retain their audit trail.
No automatic deployment retry, schema down-migration, or canary cleanup.

## Evidence correction / current limits

The previous `dpl_5fRW63c5w6hWyxg4kdxwQZV417BX` remote build passed, but its
blank provider/cron keys make it **non-promotable**. Never reuse that deployment
or its guarded command as the final release. Earlier `curl -L` smoke responses
included Vercel SSO HTML: the historical 200 claims are not CMS/admin proof.
A cron Unauthorized response proves authorization rejection, not independently
that the configured secret was empty. No live purge probe is needed again.

Still unresolved: reviewed runtime hardening and exact final SHA; direct schema
compatibility evidence; exact scheduler recovery mechanism; complete effective
operating-flag baseline; candidate app/Turnstile and inbox access; exact-Oslo
selection. CONTROL's existing-domain browser/public checks are baseline evidence,
not candidate checks. Report these gates without re-requesting the owner's
already-issued general release authorization.
