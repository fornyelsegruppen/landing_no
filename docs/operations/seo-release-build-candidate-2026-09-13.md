# SEO: no-migration remote build candidate

## Current default-OFF build-wiring correction

Owner: SEO. Based on clean91dd5be6edbb6c9878483ca42c9fbd55e6ac6671
with accepted application b02955a. The tracked command is now:

```sh
node scripts/db-compat/preflight.mjs && PAYLOAD_BUILD_WITHOUT_DB=1 next build --webpack
```

The unchanged helper defaults OFF, returning DB_COMPAT_DISABLED before
credential, manifest/source-file, driver or connection IO. A separately approved
one-shot Production-target build supplies --build-env SEO_DB_COMPAT_PREFLIGHT=1,
never --env or a permanent inline1. Require actual DB_COMPAT_PASS before Next;
DISABLED is not compatibility evidence. The && stops Next after failure.
Unsupported TLS/channel-binding/configuration remains fail-closed; no weakening.
No application, helper implementation, sealed manifest, package, runtime env,
function, cron or region changes. Existing accepted local3218 stays unchanged.
This narrow change requires independent source review and separate new-SHA
remote-build GO, not another application build or repeated GUI acceptance.

### Actual uploaded configuration versus metadata

The single approved91dd5be staged attempt became READY as
dpl_hfmC8dtQaUVdTrta5cVvsx2uUdWp, but is BUILD-only, NOT DB compatibility PASS.
The complete alternate --local-config JSON differed only in buildCommand, and
deployment API projectSettings.buildCommand contained preflight plus Next.
Nevertheless actual remote logs ran only the original tracked
PAYLOAD_BUILD_WITHOUT_DB=1 next build --webpack, without any helper invocation.
Thus metadata did not establish effective command execution, consistent with
uploaded source vercel.json taking precedence later in the build.

The correction places the default-OFF gate in uploaded tracked configuration.
A future approved command must use the clean reviewed new SHA without the
obsolete alternate config and with the one-shot build-env opt-in. Actual logs,
not metadata alone, must establish the command and DB_COMPAT_PASS. No new remote
attempt is authorized here.

Five public aliases/defaultProduction13g/disabled crons/protection remained
unchanged after the first build. The CLI automatically assigned the generated
project alias separately; do not claim zero alias changes of every kind.
ROOT's staged browser sitemap attempt returned ERR_BLOCKED_BY_CLIENT even after
one normal reload: no XML or first runtime response was established. This is
access-blocked evidence, not a sitemap defect or permission to bypass protection.

### Focused verification and gates

Run scripts/seo-release-build-config.test.mjs plus the unchanged helper's
16 offline tests. Added contract checks reject a skipped gate, permanent inline1,
semicolon/OR failure bypass and runtime opt-in; they assert default-OFF zero IO
and unchanged helper/manifest bytes against91dd5be. No full build/tsc is needed
for this wiring-only delta. Independent review belongs to CONTROL.

Current focused result: 8 build-contract tests plus 16 unchanged helper tests
PASS (24 total), Node24.21.0; touched test formatting and git diff whitespace
checks PASS. No full app build, tsc, Production DB check or remote repeat ran.

Migration-ledger parity is NOT a gate; accepted structural/permission checks
plus separate staged runtime/auth/content evidence are. No migration/status
wrapper, secret export, provider call, form POST, cron call or traffic move.
The earlier checklist below is historical context, not fresh execution authority.

## Historical initial guarded-build proposal (superseded where noted)

Owner: SEO. Candidate only, based on clean application
`051260e536dfe06b2d757eb9f764dba5367b7d6d`. Do not integrate, build, push,
deploy, change project settings, or reassign domains before CONTROL review.
The running local session34771 remains on that application SHA, DEFAULT OFF.

## Smallest proposed change

Add just this property to the existing root `vercel.json`:

```json
"buildCommand": "PAYLOAD_BUILD_WITHOUT_DB=1 next build --webpack"
```

Vercel documents that `buildCommand` in the source configuration overrides both
the dashboard command and the package build script for that deployment:
[official configuration reference](https://vercel.com/docs/project-configuration/vercel-json#buildcommand).
The inline assignment is for the remote POSIX build process, not a PowerShell
command and not a runtime/project environment setting. Direct Next bypasses
the package build lifecycle; `--webpack` matches the reviewed local build path.
No install command, dependency, runtime env, region, function or cron change.

This is a release-branch configuration, not a one-shot expiring setting: it
continues to apply to later deployments containing this file. Any subsequent
schema-changing release must re-review it and separately authorize migrations.
Do not merge it into an unattended production deployment branch as a shortcut.
The general `npm run build` and explicit migration scripts remain unchanged
and still unsafe to invoke in this no-migration workflow.

## What the guard proves, and what it does not

- Existing `src/lib/payload.ts` rejects wrapped CMS access when
  `PAYLOAD_BUILD_WITHOUT_DB=1`; internal auth returns no user in that mode.
- Existing production adapter has `disableCreateDatabase: true`, no
  `prodMigrations`, and `push` disabled under production NODE_ENV. The production
  drop-database startup rejection remains unchanged.
- The guard does NOT stop `scripts/run-migrate.mjs`: that script selects
  DATABASE_URL_MIGRATE/DATABASE_URL, deletes migration dev markers, then migrates.
  Hence the direct command is necessary; adding the flag to `npm run build`
  would not solve the problem.
- This is not proof of zero database/network access by all framework/plugin
  initialization. Native Payload framework entrypoints are not all mediated by
  the wrapper. No remote build was executed to make that claim.
- Public pages deliberately fall back when CMS reads fail; article static params
  can be empty and sitemap can initially omit CMS pages/posts. An exit0 build
  therefore does NOT prove release content correctness. Before alias movement,
  a separately authorized staged-artifact check must establish runtime CMS/auth
  access, current public content, article routes and a complete sitemap. Any
  fallback cache must be resolved and read back before GO, not dismissed as ISR.
- The flag must not be added to project/runtime env or `next.config` env. Verify
  it is absent/not1 in the deployed runtime using normal functional readback;
  don't print the complete environment. Do not copy synthetic local secrets.
- Source comparison with historical live source414f65f shows unchanged migration
  files, config, generated Payload types and collection fields. Posts changes
  are hooks/endpoint behavior. Actual deployed DB structural/permission compatibility
  still needs independent read-only evidence; a source diff is not a DB audit.

## Evidence and limits

`scripts/seo-release-build-config.test.mjs` uses only Node built-ins, source reads
and read-only `git show/diff`. It checks the exact override, negative unsafe
commands, unchanged cron/env/package policy, existing guards, and source schema
surface. Run with the existing x64 Node and `--test`; no installation needed.
These are source-contract tests, not Vercel schema validation, shell execution,
remote build PASS or an independent review. Independent review belongs CONTROL.

Application051260e already passed affected tests/tsc/lint/direct local build
against its synthetic DB. That earlier build did not use this proposed
database-independent remote command and cannot certify its runtime/cache result.
No new candidate build is authorized in this preparation task.

Candidate verification: all 6 Node source-contract tests PASS, Node syntax check
PASS, formatter completed and git diff whitespace check PASS. No independent
review or candidate build is claimed.

Fresh CONTROL browser build-log readback for9EA additionally shows the previous
actual command was `npm run build` then `npm run build:migrate && next build`.
Migration execution was skipped because its build-time database URL was the
non-Postgres placeholder `file:./seo-no-migrations.db`; the Next16.3.2 Turbopack
log also showed the database-independent CMS guard. Thus that historical build
did not establish a direct-Next override, but neither does its log prove a
Production migration occurred. This candidate removes reliance on the migration
wrapper's placeholder-based skip. Do not copy the placeholder into live runtime
DATABASE_URL, and do not treat historical build env as fresh runtime evidence.

## Exact release checklist (all actions require later authorization)

1. CONTROL accepts the candidate diff/commit and independent source review.
   Freeze final application+config SHA; verify no extra schema/dependency changes.
   Confirm build/install resolution from source, dashboard and any deployment
   override. Never use `npm run build`, build:migrate, db:push, seed or redeploy
   an older source and assume this command was applied.
2. Capture fresh project identity, intended environment, exact source SHA,
   deployment IDs, and domain-to-deployment mapping. CONTROL's 2026-09-12
   21:22Z readback: new apex/www and landing-no project alias point to Ready
   Production/Staged `dpl_9EAEDibiADiXWLUfULgYMN7BEiV5`, while the project overview
   still identifies DCH as default Production. These are distinct states.
   Reconfirm full DCH ID; do not infer that default Production is the rollback
   target for the new-domain aliases.
3. Obtain actual read-only Production DB structural/permission compatibility
   and exact pre-release rollback target for EACH touched alias. Stop if access
   or evidence is unavailable. Do not execute run-migrate-status as a substitute
   for a reviewed read-only query; it initializes migration-mode Payload.
4. Verify effective target env without displaying credentials: production DB
   identity/real secret available; build-only guard not persisted at runtime;
   intended public/canonical origin and protection policy. Preserve CONTROL's
   verified existing9EA release flags: FEATURE_AI_DRAFTS=true (already-released
   manual generation), FEATURE_SEO_SCHEDULER=false, FEATURE_SEO_AUTO_PUBLISH=false.
   Local all-OFF isolation is NOT the release configuration. Preferred protected
   staging preserves manual AI=true with zero provider clicks; any explicitly
   authorized staging-only AI=false requires separate final-config evidence.
   Providers are not exercised or rotated. Executor remains paused/unverified.
5. Read back project Cron Jobs DISABLED before and after any deployment or
   rollback. Unchanged source cron definitions are NOT a disabled-state proof;
   the existing list includes purge-leads. Never enable all project crons or
   trigger endpoints as a release smoke test. External executor stays OFF.
   [Official cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
6. Only with separate build/deployment GO, create a staged/protected deployment
   from the exact reviewed SHA WITHOUT automatic production alias assignment,
   using the approved existing deployment mechanism. If that mechanism cannot
   guarantee the intended no-alias scope, stop; do not improvise CLI flags/auth.
   Inspect build logs for the exact guarded direct Next command and no migration
   invocation. Record actual output/source/env; abort on a mismatch.
7. Separately authorized read-only staged runtime checks: normal admin login,
   automation status showing scheduler/publisher OFF and preserved manual-AI
   configuration, public CMS content (not just200), representative
   existing published NO/EN article, draft exclusion, full sitemap and canonical
   origin, current history navigation, no unexpected schema/adapter errors.
   Do not publish a real article or POST a customer form. Build fallback content
   or incomplete sitemap is HOLD until resolved and verified.
8. Only after these gates and explicit traffic-switch GO, move exactly the
   approved aliases. Leave old-domain/BRIDGE mappings untouched unless explicitly
   included in that operation. Record before/after mapping and repeat public,
   admin, scheduler/publisher OFF, preserved manual-AI/executor and cron-state
   readback. This is not scheduled SEO automation GO.

## Exact rollback checklist (prepared, not executed)

1. Before release, record the currently serving Ready immutable deployment for
   each alias, its source/environment, existing runtime flags, and actual rollback
   eligibility. Historical6cTT/6aece17 is NOT presumed the current new-domain
   rollback. Prefer the verified pre-switch artifact, not a rebuild of old code.
2. Define rollback triggers: failed login/core reads, wrong public CMS content,
   canonical/sitemap regression, unexpected DB errors or automation activation.
   Stop further promotion/actions and notify CONTROL; no automatic broad rollback
   without the pre-authorized target/scope.
3. On rollback GO, restore only the captured aliases to their exact prior Ready
   deployment. If using dashboard Instant Rollback, review its proposed domain
   list against the approved mapping; custom aliases and the distinct default
   Production state make a generic project rollback unsafe to assume.
4. Recheck each alias and both relevant domains, normal admin/public reads,
   canonical/sitemap, preserved manual-AI=true with scheduler/publisher OFF and
   disabled cron state (or the separately captured prior flags). Vercel notes
   rollback restores an existing build's environment/config and cron state;
   it does not undo database or CMS changes. No down migrations, DB restores,
   history deletion, blanket cron enable, or old-source rebuild is authorized.
5. Record outcome and leave subsequent releases on HOLD. Do not automatically
   undo rollback or restore auto-assignment: that is another traffic change.
   [Official rollback behavior and custom-alias caveats](https://vercel.com/docs/instant-rollback).
