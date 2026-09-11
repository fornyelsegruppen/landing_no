# SEO / Admin V2 UX release preflight — 2026-09-12

## Status

**STAGED CANDIDATE READY — custom domains remain on the verified rollback target.**

This document prepares a deployment command; it does not authorize or execute
a deployment, alias assignment, environment mutation, DNS change, database
operation, publication, or customer contact. The production-release decision
remains a separate explicit user GO.

On 2026-09-12, after a separate explicit authorization for one staged
production candidate, the documented command was run once with the
candidate-only guards. It produced the following `READY` deployment:

```text
deployment: dpl_5fRW63c5w6hWyxg4kdxwQZV417BX
immutable URL: https://landing-o1i7i1qjd-darbasnorvegija4-8212s-projects.vercel.app
target/state: production / READY (staged with --skip-domain)
source at deploy: 330856fd4aa1177affb62e5c97bc3df625959841
```

It has only the project alias
`landing-no-darbasnorvegija4-8212s-projects.vercel.app`. No custom-domain
promotion, `vercel promote`, `vercel alias set`, shared environment mutation,
DNS operation, database migration, mail, AI, Pexels, contact submission, or
SEO publication was performed. This candidate must **not** be promoted as-is:
it intentionally uses the candidate-only runtime guards below.

## Clean release branch and source manifest

| Item | Value |
| --- | --- |
| Branch | `codex/release-preflight-4adef31` |
| Clean application candidate | `e11a895` |
| Base | `4adef31e3016cb471c75f2238bd6614abf4ab847` |
| Source scope | Four SEO fixes, two case-history UX commits, anchored-disclosure implementation and guard, and the case-process key fix only |

The application commits, in order, are:

```text
e7f4986  fix(seo): use Pexels alt for stock images
7c19ffe  fix(seo): isolate initial stock image QA trust
33e8e55  fix(seo): reset review on stock asset change
4018189  fix(seo): reset review for uploaded hero override
94dd46b  fix(admin-v2): collapse older case messages
d3831a2  test(admin-v2): cover collapsed message history
950bc4a  fix(admin-v2): reveal anchored older messages
a25b64c  fix(admin-v2): guard message fragment disclosure
e11a895  fix(admin): key case process stage panels
```

The resulting application diff contains only these paths:

```text
src/app/(admin-shell)/admin-v2/cases/[id]/page.tsx
src/components/admin-v2/case-message-history-disclosure.test.ts
src/components/admin-v2/case-message-history-disclosure.tsx
src/components/admin-v2/case-message-history.test.ts
src/components/admin-v2/case-message-history.tsx
src/lib/admin-v2/case-message-history.test.ts
src/lib/admin-v2/case-message-history.ts
src/lib/admin-v2/case-workspace-i18n.ts
src/lib/blog/payload-blog-engine.ts
src/lib/blog/stock-image.test.ts
src/lib/blog/stock-image.ts
src/payload/collections/Posts.test.ts
```

Excluded by construction: `d937cc8` local fixture seeding, the local candidate
E2E test with synthetic credentials and IDs, generated `AGENTS.md`/`CLAUDE.md`,
generated Payload import maps, local runtime, `node_modules`, SQLite files,
environment files, and screenshots/artifacts.

## Schema, data, routing, and contact boundary

`git diff --name-only` from the base contains no migration, schema, Drizzle,
lockfile, `vercel.json`, `next.config`, lead route, webhook, middleware, or
public-redirect change. This release has no database migration and no data
rollback requirement. It does not change mail routing in source; any delivery
configuration below is a deployment-scoped explicit override, not a data change.
No form submission, message send, resend, AI generation, Pexels request, or SEO
publication is part of preflight or deploy smoke.

## Fresh rollback evidence

There is no separate rollback document on this clean release branch. The
evidence and the two narrowly scoped recovery commands required for this
candidate are recorded in this section; all commands remain unexecuted.

Verified rollback target for both `takfornyelsenorge.no` and
`www.takfornyelsenorge.no`:

```text
deployment: dpl_GETi3v8dvpSxk8JgRbjtkFPoHga6
immutable URL: https://landing-lizkuhfql-darbasnorvegija4-8212s-projects.vercel.app
target/state: production / READY
```

The deployment is retained and authenticated inspection succeeds. Its inspect
metadata has no `gitSource`/source-SHA field; source SHA is therefore `unknown`
with CLI inspect property-list provenance. This is not fabricated as
`412a6e9`. Old `takfornyelse.as` aliases are out of scope and must not be
changed.

Immediately before any separately approved release, authenticate and re-check
the project, both aliases, and the retained deployment:

```powershell
$Scope = 'darbasnorvegija4-8212s-projects'
$Project = 'landing-no'
$ProjectId = 'prj_MWKBmg22GIxgiGmTtbT9Om3469aI'
$RollbackDeployment = 'dpl_GETi3v8dvpSxk8JgRbjtkFPoHga6'
$RollbackImmutableUrl = 'https://landing-lizkuhfql-darbasnorvegija4-8212s-projects.vercel.app'
function Invoke-Vercel59 { & npx.cmd --yes vercel@59.16.0 @args }

Invoke-Vercel59 whoami
Invoke-Vercel59 project inspect $ProjectId --scope $Scope
Invoke-Vercel59 alias ls --scope $Scope
Invoke-Vercel59 inspect $RollbackDeployment --scope $Scope --json
```

Only after an incident/rollback decision, the recovery operator may mutate the
two new aliases and then re-run `alias ls` plus the public smoke checks. These
commands are not part of deployment:

```powershell
Invoke-Vercel59 alias set $RollbackImmutableUrl takfornyelsenorge.no --scope $Scope
Invoke-Vercel59 alias set $RollbackImmutableUrl www.takfornyelsenorge.no --scope $Scope
```

## Configuration: verified names, desired explicit overrides, unknowns

The authenticated project-production env listing confirms names only; Vercel
returns encrypted or hidden values and no secret was read or exported. It
contains the relevant names `FEATURE_AI_DRAFTS`, `FEATURE_SEO_AUTO_PUBLISH`,
`FEATURE_SEO_SCHEDULER`, `NEXT_PUBLIC_SITE_URL`, `LEAD_TO_EMAIL`, and
`PLATFORM_OPERATING_MODE`. A fresh read-only `project inspect landing-no --scope
darbasnorvegija4-8212s-projects` confirms project ID
`prj_MWKBmg22GIxgiGmTtbT9Om3469aI`, root directory `.`, Next.js preset, and
Node.js `24.x`.

`PUBLIC_SITE_URL` is intentionally omitted: the application uses
`NEXT_PUBLIC_SITE_URL` for the relevant site/payload URL path; no release change
is invented for an unused variable.

The following are explicit desired overrides, drawn from the recorded
new-domain/mail contract in `norge-admin-v2-seo-release-2026-09-11.md`. They
are a planned deployment configuration, **not** evidence of the currently
stored value:

| Name | Planned value | Scope | Reason |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://takfornyelsenorge.no` | build + runtime | Canonical new-domain site URL. |
| `LEAD_TO_EMAIL` | `post@takfornyelsenorge.no` | runtime | New-domain admin recipient contract. |
| `LEAD_ADMIN_COPY_EMAIL` | `post@takfornyelse.as` | runtime | Preserves the recorded admin-copy route. |
| `FEATURE_AI_DRAFTS` | `true` | build + runtime | Recorded controlled-pilot behavior. |
| `FEATURE_SEO_AUTO_PUBLISH` | `false` | build + runtime | Keeps publication behind human review. |
| `FEATURE_SEO_SCHEDULER` | `false` | build + runtime | Keeps scheduled generation disabled. |
| `PUBLIC_HOST_REDIRECTS_ENABLED` | `false` | build + runtime | New-domain-only deployment; old redirect deployment remains untouched. |
| `DATABASE_URL_MIGRATE` | `file:./seo-no-migrations.db` | build only | Isolates the package build migration step from production DB. |
| `PAYLOAD_BUILD_WITHOUT_DB` | `1` | build only | Prevents Payload database access during build rendering. |

Unknown current values are accepted only because the deployment plan sets the
non-secret required values explicitly and inherits existing production secrets
without reading, exporting, or overriding them. This includes database, mail,
AI, Pexels, storage, and token credentials. Deployment-scoped current values for
`LEAD_ADMIN_COPY_EMAIL` and `PUBLIC_HOST_REDIRECTS_ENABLED` are not available
from read-only inspect and are intentionally called out rather than assumed.

## Candidate-only runtime safety boundary

The separately authorized staged production candidate is **not** a release
candidate that may be promoted as-is. It uses deployment-only runtime overrides
to prevent outbound provider calls and automatic work while its generated URL is
reviewed. They do not change project-level Vercel environment records and do
not affect the currently aliased deployment.

| Candidate-only override | Reason |
| --- | --- |
| `CRON_SECRET=` | Makes all three Vercel cron routes return `401` before any work. This is required because the project declares `purge-leads`, which permanently deletes eligible trashed cases and blobs and has no feature flag. |
| `RESEND_API_KEY=`, `GEMINI_API_KEY=`, `PEXELS_API_KEY=` | Prevents candidate mail, AI, and stock-image provider calls. |
| `FEATURE_AI_DRAFTS=false` | Prevents manual AI draft generation during candidate review. This deliberately differs from the later controlled-pilot release value. |
| `FEATURE_SEO_AUTO_PUBLISH=false`, `FEATURE_SEO_SCHEDULER=false` | Keeps editorial publication and scheduled draft generation disabled. |
| `AUTOMATION_EMERGENCY_PAUSE=true` | Keeps automatic communication paused explicitly in production-target runtime. |

Vercel documents that cron jobs are created for production deployments and that
the `CRON_SECRET` value is sent as their authorization header. The application
checks for a non-empty expected secret before comparing the header; the empty
candidate override therefore fails closed regardless of whether the scheduler
uses the project or deployment value. The candidate must be replaced by a fresh
authorized release deployment with its intended configuration before any later
domain promotion.

## Planned deployment command — do not execute

Run only after a separate user Release GO, from this clean branch and with the
authenticated account/team already checked. It creates a new production
deployment but does not assign either custom domain because of `--skip-domain`.

```powershell
$Scope = 'darbasnorvegija4-8212s-projects'
$Project = 'landing-no'
$ProjectId = 'prj_MWKBmg22GIxgiGmTtbT9Om3469aI'
function Invoke-Vercel59 { & npx.cmd --yes vercel@59.16.0 @args }

# Read-only identity gate. Stop if project ID is not the value above.
Invoke-Vercel59 project inspect $ProjectId --scope $Scope

Invoke-Vercel59 deploy --prod --skip-domain --project $Project --scope $Scope `
  --build-env NEXT_PUBLIC_SITE_URL=https://takfornyelsenorge.no `
  --env NEXT_PUBLIC_SITE_URL=https://takfornyelsenorge.no `
  --env LEAD_TO_EMAIL=post@takfornyelsenorge.no `
  --env LEAD_ADMIN_COPY_EMAIL=post@takfornyelse.as `
  --build-env FEATURE_AI_DRAFTS=false --env FEATURE_AI_DRAFTS=false `
  --build-env FEATURE_SEO_AUTO_PUBLISH=false --env FEATURE_SEO_AUTO_PUBLISH=false `
  --build-env FEATURE_SEO_SCHEDULER=false --env FEATURE_SEO_SCHEDULER=false `
  --build-env PUBLIC_HOST_REDIRECTS_ENABLED=false --env PUBLIC_HOST_REDIRECTS_ENABLED=false `
  --build-env DATABASE_URL_MIGRATE=file:./seo-no-migrations.db `
  --build-env PAYLOAD_BUILD_WITHOUT_DB=1 `
  --env CRON_SECRET= `
  --env RESEND_API_KEY= `
  --env GEMINI_API_KEY= `
  --env PEXELS_API_KEY= `
  --env AUTOMATION_EMERGENCY_PAUSE=true
```

Do not pass secrets on this command line. Do not use local QA data, local
build artifacts, a prebuilt upload, or a dummy production `DATABASE_URL`. Do
not run `vercel alias set` as part of this step. `--prod --skip-domain` still
creates a production-environment deployment; it is not a neutral preview and
may have project alias or cron consequences. The candidate-only empty cron and
provider-key overrides above are mandatory; do not remove them or promote this
candidate. Before assigning new aliases in a later, separately authorized step,
re-read the rollback evidence above and make a fresh release deployment with
its approved release configuration.

## Local verification and limits

Completed on the clean branch:

- targeted unit tests: 6 files / 39 tests passed;
- TypeScript: `tsc --noEmit` passed;
- targeted ESLint passed;
- diff checks confirm no schema/migration/DB-auth/public-redirect/mail-route
  source changes.

The first isolated Turbopack `next build` attempt failed before application
compilation because this Windows host installed the ARM `lightningcss` optional
binary while the build uses portable x64 Node. After a clean x64 dependency
install (the x64 binary was present and `process.arch` was `x64`), the isolated
Webpack build recorded `failed: true` in Next's compile-stage trace after
232.8 seconds (`run-webpack` 230.8 seconds; `next-build` 232.8 seconds).

The x64 Node build process and its parent shell both exited. There was no saved
stdout/stderr for that Webpack invocation, no application error, TypeScript
error, or schema error in `.next/diagnostics`, and no same-day Windows
Application Error/Windows Error Reporting event. The final process exit
code/signal is unavailable. The available evidence proves only that Next marked
the build as failed in its compile stage; it cannot distinguish an application
compile failure from host/process termination or another runner limit. No new
long build was started after this diagnostic review. A clean production build is
therefore **not verified** and release remains blocked pending a successful
fresh build in a compatible runner (or a separately authorized preview
deployment with its Vercel build log). Do not treat a remote build as having run
here.

The one authorized remote candidate build subsequently passed on Vercel
(`iad1`, 2 cores, 8 GB): dependency installation, `npm run build`, migration
skip (`DATABASE_URL_MIGRATE=file:./seo-no-migrations.db`), Next compilation,
and TypeScript all completed successfully. The build emitted expected CMS
fallback messages because `PAYLOAD_BUILD_WITHOUT_DB=1` deliberately forbids
database access during static generation; the runtime candidate inherits the
existing database secret and the flag is build-only. This confirms a safe remote
build, not a database-content or authenticated-admin write test.

Post-build read-only evidence: authenticated candidate GET smoke for `/no`,
`/no/blogg`, `/robots.txt`, `/sitemap.xml`, and `/admin/login` returned `200`;
the protected `/admin-v2` route redirects to Vercel SSO. An authenticated Vercel
GET to candidate `/api/cron/purge-leads` returned `{"error":"Unauthorized"}`
before the handler can open Payload, proving the candidate's empty cron-secret
guard. No authenticated Admin V2 read was performed. After the candidate build,
both new custom aliases still map to
`landing-lizkuhfql-darbasnorvegija4-8212s-projects.vercel.app` and both old
`.as` aliases still map to
`landing-9hjfau7e4-darbasnorvegija4-8212s-projects.vercel.app`.

Post-deploy smoke, after user authorization and before any alias mutation, is
limited to public new-domain `/no`, `/no/blogg`, sitemap, robots, and expected
admin-login protection. An authenticated Admin V2 blog/case read-only smoke may
be performed with the approved production operator account. No SEO generation,
save, publish, contact send, resend, or old-domain alias action is authorized.
