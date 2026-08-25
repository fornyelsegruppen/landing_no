# Phase F2 — immutable roof measurement evidence

**Status:** GO  
**Date:** 2026-08-25  
**Environment:** staging only  
**Production changed:** no

## Delivered controls

- A deterministic `SchematicRoofEvidenceProvider` renders the saved address point, all candidate polygons, numbered candidates, selected roof, north arrow, source, attribution and non-construction disclaimer.
- The renderer has no dependency on an external map image service. The same normalized input produces the same SVG and SHA-256 hash.
- Each visual measurement stores its candidate snapshot, selected building, private evidence media relation, hash, source, attribution, generation time and selection confirmation.
- The evidence SVG is stored as protected measurement media. Approval verifies the actual private file bytes against the stored hash.
- Approved evidence fields and polygons are immutable. Editing creates a new measurement version with a new evidence file and hash.
- `manual_no_visual` is an explicit supported mode when no trustworthy polygon exists. It requires area, source, reason, administrator and approval time and cannot claim a visual attachment.
- Latitude and longitude can be absent only for the manual no-visual path.
- All new enforcement is controlled by `FEATURE_MEASUREMENT_EVIDENCE_V2`; disabling it preserves legacy approval while retaining new evidence records.

## Verification evidence

| Check | Result |
|---|---|
| Schematic determinism, selection and attribution tests | PASS |
| Private evidence persistence test | PASS |
| Approved evidence immutability and manual-mode tests | PASS |
| Full unit suite | PASS — 127 files, 414 tests |
| Full migration suite | PASS — 16 files, 28 tests |
| ESLint and TypeScript | PASS |
| Vercel Linux Preview build | PASS — deployment `dpl_ATyNLyjwv8fQqT9uaCHxYL38dsie` |
| Preview schema migration | PASS |
| Protected Preview smoke | PASS |
| Authenticated staging evidence journey | PASS — synthetic lead `9`, measurement `10`, private media `22` |
| Staging evidence hash | PASS — persisted SHA-256 and verified again during approval |
| Staging attribution | PASS — `© OpenStreetMap contributors` |
| Synthetic cleanup | PASS — lead archived as invalid test data |
| Production | untouched |

## Rollback

- Disable `FEATURE_MEASUREMENT_EVIDENCE_V2` to restore legacy approval without deleting evidence.
- The schema migration has a tested down path.
- Full code rollback remains available from `rollback/pre-full-audit-f0-2026-08-25`.

## Phase gate

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
