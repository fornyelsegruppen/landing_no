# Phase F0 — baseline, contracts and rollback

**Status:** GO  
**Date:** 2026-08-25  
**Environment:** staging only  
**Production changed:** no

## Baseline and rollback

- Git baseline: `68d115d4f34a80fe20b5a0635c4ec4a48a36e257`
- Annotated rollback tag: `rollback/pre-full-audit-f0-2026-08-25`
- Baseline Preview deployment: `dpl_Fz4Df3q4Jqkt1DNnAsge1FU3Wvhf`
- Baseline deployment URL: `https://landing-okrp6mpff-darbasnorvegija4-8212s-projects.vercel.app`
- Stable staging alias: `https://takfornyelse-staging.vercel.app`
- Rollback method: redeploy the tagged commit to Preview; production is not part of this remediation run.

## Implemented controls

- Six remediation feature flags exist, default to disabled and have independent evidence gates.
- All operational aggregates and states are inventoried in code.
- The central command envelope defines actor, role, case, expected version, idempotency key and timestamp.
- Integration timeout/retry/fallback/manual-action policies are executable configuration.
- Email-primary and SMS-emergency-only routing is frozen.
- Commercial, legal and measurement snapshot fields are frozen.
- Lifecycle exceptions, authorised company signer, retention and pilot `NO-GO` thresholds are recorded.
- A stable synthetic QA pack uses only reserved `.invalid` emails and the dedicated `+479000...` number range.
- An isolated PGlite dump/restore test proves relational data, document hashes and private-media references survive restore.
- Playwright can use a Preview-only bypass secret when supplied. The non-interactive `test:preview:auth-smoke` runner uses the authenticated Vercel CLI and reaches the protected staging deployment without a browser login.

## Verification evidence

| Check | Result |
|---|---|
| Targeted F0 contract tests | PASS — 30 tests |
| Isolated backup/restore | PASS |
| TypeScript | PASS |
| Full unit suite after F0 | PASS — 121 files, 395 tests |
| Full migration suite after F0 | PASS — 14 files, 26 tests |
| Local production build | compile + TypeScript PASS; Windows ARM64 optional libSQL binary exception documented below |
| Protected Preview runner | PASS, HTTP 200 |
| Manual admin staging smoke | PASS — authenticated `/admin-v2`, dashboard queues and navigation rendered |
| Production | untouched |

## Known environment note

The local Windows ARM64 `next build` compiles and type-checks, then cannot load the optional `@libsql/win32-arm64-msvc` package while collecting `/api/[...slug]`. This is a local optional-binary limitation; the official Linux/Vercel Preview build is the release build authority. A Ready Preview deployment and its build log are required before the phase remains GO.

## Phase gate

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
