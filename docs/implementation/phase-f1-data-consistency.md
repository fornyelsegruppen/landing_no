# Phase F1 — data consistency and legacy reconciliation

**Status:** GO  
**Date:** 2026-08-25  
**Environment:** staging only  
**Production changed:** no

## Delivered controls

- All lead state mutations now use one revisioned server-side case command.
- The lead write hook rejects direct state edits while the F1 feature flag is enabled.
- Optimistic concurrency is checked again at write time, so a stale parallel action receives an explicit conflict instead of silently overwriting newer state.
- Repeated command keys return the existing safe result and do not repeat the domain mutation.
- Every active lead has an explicit next action, owner, deadline and optional blocker code.
- The invariant scanner covers impossible contract/work states, missing ownership/deadlines, missing workers/schedules, measurement snapshot drift, incomplete completion review and stale delivery jobs.
- Invariant failures are persisted as actionable `Reikia dėmesio` jobs linked to the affected case.
- The safe reconciliation preview and apply action repairs legacy next-action fields and cancels obsolete delivery jobs without resending messages. Every repair is audited.
- The scanner runs from the operational cron and is also available to an authenticated administrator.
- A reversible schema migration adds `case_revision`, `next_action_owner` and `next_action_blocker`.

## Staging reconciliation

The first authenticated scan found eight legacy inconsistencies:

- two active cases without a deadline;
- four case-linked stale message delivery jobs;
- one synthetic completed test case with no supplier counter-signature and no completion review.

The auditable safe repair set updated the two case actions and cancelled all obsolete delivery jobs. The intentionally synthetic invalid case was archived with the `invalid` classification instead of fabricating a missing signature or completion approval. The final authenticated scan returned:

```json
{"cases":7,"issues":0,"byCode":{},"reconciliationPreview":[]}
```

No production records were read or changed.

## Verification evidence

| Check | Result |
|---|---|
| Targeted F1 state, invariant and reconciliation tests | PASS |
| Full unit suite | PASS — 125 files, 409 tests |
| Full migration suite | PASS — 15 files, 27 tests |
| ESLint | PASS |
| TypeScript | PASS |
| Local production build | compile + TypeScript PASS; known Windows ARM64 optional libSQL collection exception remains |
| Vercel Linux Preview build | PASS — deployment `dpl_DzXHR1CPXSRZdaZ7MQo9oUZ9dzdu` |
| Schema migration in Preview | PASS |
| Protected Preview smoke | PASS |
| Authenticated admin dashboard | PASS — queue and case links render |
| Authenticated invariant scan after reconciliation | PASS — zero active issues |
| Production | untouched |

## Rollback

- Disable `FEATURE_CASE_STATE_ENGINE_V2` to restore legacy write compatibility without deleting new audit or revision data.
- Redeploy the F0 rollback tag `rollback/pre-full-audit-f0-2026-08-25` for full code rollback.
- The migration has a tested `down` path for its three fields and enum.

## Phase gate

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
