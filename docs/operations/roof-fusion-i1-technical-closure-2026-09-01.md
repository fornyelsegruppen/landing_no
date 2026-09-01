# Roof Fusion I1 technical closure — 2026-09-01

## Gate packet

- `STATUS`: `I1_RF_TECH_ACCEPT`
- `UI_REVIEW_COMMIT`: `863affeec3fa26083c9b0071a8c7a05ce4cd30e7`
- `UI_FOUNDATION_SHA_FROM_REVIEW`: `f06aaa03154fbd75d88256d404df21f9fcca9c49`
- `UI_REVIEW_ARTIFACT`: `docs/implementation/admin-next-roof-fusion-i1-review-2026-09-01.md`
- `RF_BASE_SHA`: `6a024b1f9ede25832dde8ed03539e7d937469e82`
- `RF_LAST_SHA`: recorded in the accompanying handoff after commit
- `RF3_SCOPE`: interface, pure command behavior, in-memory proof, and deterministic fixtures only
- `PERSISTENCE_API_PRODUCTION`: not implemented and not activated
- `NEEDS_FROM_STREAM: UI/INTEGRATION`: supply the shared `roofFusionV1` flag, append-only persistence adapter, authorized read/command routes, and a new I1 Gate report against the exact RF milestone SHA.

## 1. Capability amendment — accepted

The UI amendment is accepted without a separate worker projection:

| Capability                           | Exact actor/payload boundary                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `roof_fusion.snapshot.read`          | case-scoped administrator only; full `roof-snapshot.v1`                                                               |
| `roof_fusion.evidence.read`          | administrator only; internal provenance/licence/fusion evidence                                                       |
| `roof_fusion.calculate`              | system/service only                                                                                                   |
| `roof_fusion.review`                 | administrator only                                                                                                    |
| `roof_fusion.correct`                | administrator only                                                                                                    |
| `roof_fusion.approve`                | administrator only                                                                                                    |
| `roof_fusion.renderer.read_approved` | case/token-scoped administrator, assigned worker, customer, or PDF service; `approved-roof-renderer-envelope.v1` only |

The executable RF-local declaration is `src/lib/roof-fusion/capability-contract-v1.ts` with version `roof-fusion-capabilities.v1`. Its activation is explicitly `shared_registry_not_implemented`; it does not mutate or claim the shared feature/capability registry.

## 2. Append-only repository interface

`src/lib/roof-fusion/repository-contract-v1.ts` publishes `RoofSnapshotAppendOnlyRepositoryV1` with contract version `roof-snapshot-repository.v1`:

```ts
interface RoofSnapshotAppendOnlyRepositoryV1 {
  readonly contractVersion: "roof-snapshot-repository.v1";
  readSnapshot(snapshotId: string): Promise<RoofSnapshotV1 | null>;
  readLatestSnapshot(caseId: string): Promise<RoofSnapshotV1 | null>;
  readCommand(
    caseId: string,
    idempotencyKey: string,
  ): Promise<StoredRoofRepositoryCommandV1 | null>;
  appendAtomically(input: {
    expectedLatest: RoofSnapshotReferenceV1 | null;
    snapshot: RoofSnapshotV1;
    command: StoredRoofRepositoryCommandV1;
  }): Promise<void>;
}
```

An integration adapter must persist the snapshot and command ledger entry in one atomic compare-and-set transaction. Required invariants:

1. snapshots are immutable and `snapshotId` is unique;
2. revision 1 has no predecessor; later revisions increment exactly by one and identify `supersedesSnapshotId`;
3. mutation commands bind `currentSnapshotId`, `expectedRevision`, and `expectedSnapshotHash` to the latest case revision;
4. one case-scoped idempotency key stores one canonical command hash and one result;
5. identical replay returns the stored result as `replayed`; a different command with the same key fails;
6. full command audit and the new snapshot append atomically;
7. legacy `roof-measurements` is never treated as the repository authority.

`InMemoryRoofSnapshotRepositoryV1` is a deterministic proof adapter only. It is not a persistence recommendation and is not wired to an API or runtime flag.

## 3. Command interface

All commands use `roof-repository-command.v1` and return `roof-repository-command-result.v1`.

### `calculate`

- system actor only;
- carries a fully validated candidate `roof-snapshot.v1`;
- initial append requires nullable expected revision/hash and candidate revision 1;
- subsequent append requires exact latest revision/hash and lineage;
- may append only `preliminary` or `fused_estimate` measurement classes.

### `review`

- administrator actor only;
- requires current/new snapshot IDs, expected revision/hash, reason, source refs, actor/time and idempotency key;
- creates revision +1 with `review_completed` snapshot audit;
- may promote only to `verified_geometry` or `instrument_site_verified`;
- promotion requires all quality gates at `pass`.

### `correct`

- administrator actor only;
- wraps exported `roof-snapshot-correction-command.v1` plus current snapshot ID and expected revision;
- requires expected hash, reason, source refs, actor/time, new snapshot ID and idempotency key;
- creates revision +1 and retains the previous snapshot.

### `approve`

- administrator actor only;
- wraps exported `roof-snapshot-approval-command.v1` plus current/new snapshot IDs and expected revision;
- approval never changes the measurement class;
- creates a new approved revision rather than overwriting the reviewed revision;
- a failed quality snapshot cannot be approved.

## 4. Result and audit semantics

Every result includes:

- result/repository contract versions;
- `applied` or `replayed` status;
- command type/hash and idempotency key;
- case ID;
- optional previous and required resulting snapshot references;
- command audit containing actor, time, reason, source refs, previous/result references and the same command hash.

Snapshot references always contain snapshot ID, revision, snapshot hash, lifecycle state and measurement class. Review/correct/approve also add their domain audit event to the new snapshot. Repository command audit is not a substitute for the snapshot audit; both must persist atomically.

## 5. Exact error taxonomy

| Code                           | Retryable | Suggested HTTP mapping | Meaning                                         |
| ------------------------------ | --------- | ---------------------: | ----------------------------------------------- |
| `UNKNOWN_CONTRACT_VERSION`     | no        |                    400 | unsupported command version                     |
| `INVALID_COMMAND`              | no        |                    400 | malformed known-version command                 |
| `INVALID_RENDERER_BINDING`     | no        |                    400 | malformed known-version renderer binding        |
| `ACTOR_NOT_ALLOWED`            | no        |                    403 | wrong actor class for command                   |
| `SNAPSHOT_NOT_FOUND`           | no        |                    404 | requested immutable snapshot absent             |
| `CASE_MISMATCH`                | no        |                    403 | command/binding crosses case boundary           |
| `EXPECTED_REVISION_MISMATCH`   | yes       |                    409 | optimistic revision changed                     |
| `STALE_SNAPSHOT_HASH`          | yes       |                    409 | reviewed content hash changed                   |
| `CROSS_REVISION_BINDING`       | yes       |                    409 | command/document mixes lineage revisions        |
| `RENDER_HASH_MISMATCH`         | yes       |                    409 | renderer hash is not from bound snapshot        |
| `IDEMPOTENCY_CONFLICT`         | no        |                    409 | key reused for a different command              |
| `SNAPSHOT_ID_CONFLICT`         | no        |                    409 | append-only snapshot ID already exists          |
| `INVALID_STATE`                | no        |                    422 | lifecycle does not allow the operation          |
| `QUALITY_BLOCKED`              | no        |                    422 | required quality gates are not passable         |
| `MEASUREMENT_PROMOTION_DENIED` | no        |                    422 | unauthorized/invalid class promotion            |
| `INSTRUMENT_EVIDENCE_REQUIRED` | no        |                    422 | accepted authorized instrument evidence absent  |
| `SOURCE_REFERENCE_MISSING`     | no        |                    422 | command cites evidence outside snapshot         |
| `REPOSITORY_INTEGRITY`         | no        |                    500 | adapter atomic compare-and-set invariant failed |

Transport adapters may wrap these domain errors but must preserve code, retryability and entity references. Authorization failures detected before domain invocation may use the platform's canonical auth envelope.

## 6. Cross-revision renderer binding

`roof-renderer-read-binding.v1` requires case ID, snapshot ID, revision, snapshot hash and renderer hash. `readBoundApprovedRoofRendererV1` returns an envelope only when:

- the exact immutable snapshot exists in the same case;
- revision and snapshot hash match that record;
- state and approval metadata are approved;
- `renderHash` matches the renderer derived from that same snapshot.

Mixing revision 2 with the revision 3 approved snapshot, or using a renderer hash from another revision, fails with the explicit 409 taxonomy above. Historical approved documents may continue to bind their exact historical revision even when a later case revision exists.

## 7. DEC-RF-001 — technically resolved

`DEC-RF-001_STATUS`: `TECHNICALLY_RESOLVED`

The enforced ownership matrix is:

| Transition/result                     | Allowed owner and evidence                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| create `preliminary`                  | deterministic system/source adapter                                                                                              |
| create `fused_estimate`               | deterministic system/fusion calculator                                                                                           |
| promote to `verified_geometry`        | administrator review; exact revision/hash; quality `pass`; cited snapshot evidence                                               |
| promote to `instrument_site_verified` | administrator review plus accepted observation referencing an `authorized` and `usable` `instrument` source cited by the command |
| approve                               | administrator; separate command; does not promote class                                                                          |

The geometry calculator and repository `calculate` command both reject calculator-side verified-class promotion. The review command rejects non-administrator actors, non-pass quality, missing source refs, non-increasing classes and instrument promotion without accepted instrument evidence.

No additional owner decision is required for technical promotion ownership. A future commercial/product decision may still choose which approved measurement classes are sufficient for a particular price or customer claim, but that does not change this promotion contract.

## 8. Deterministic evidence matrix

The RF test suite now explicitly covers:

- restricted licence → `review_required`;
- unresolved evidence conflict → `review_required`;
- unknown geometric edge → partial result and `review_required`;
- stale expected revision/hash → retryable 409 taxonomy;
- same idempotency key with different command → non-retryable conflict;
- exact calculate/review/correct/approve append-only behavior;
- denied system-side verified promotion;
- denied instrument promotion without evidence and accepted promotion with synthetic authorized instrument evidence;
- cross-revision snapshot/renderer binding failures;
- exact replay behavior and immutable historical revisions.

Golden repository lifecycle evidence is checked in at `src/lib/roof-fusion/__fixtures__/roof-repository-lifecycle-v1.golden-summary.json`.

## Remaining external blockers

RF's requested technical I1 delta is complete. Overall integration remains blocked until the integration/UI streams provide:

1. shared `roofFusionV1` feature registry entry and action capability wiring;
2. a production append-only repository implementation with atomic command ledger;
3. authorized internal snapshot/evidence and approved-renderer read adapters;
4. authorized calculate/review/correct/approve command adapters;
5. cross-case authorization and integration characterization tests;
6. a Gate report tied to the exact RF and UI foundation SHAs.

No persistence schema, route, shared registry, Production flag, external provider, deployment or data mutation was added in this RF milestone.

## Verification

- focused RF tests: 47/47 passed across 7 files;
- full unit regression: 1,055/1,055 passed across 232 files;
- TypeScript: passed;
- RF ESLint: passed without warnings;
- formatting and `git diff --check`: passed.
