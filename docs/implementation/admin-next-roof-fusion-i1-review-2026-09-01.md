# Admin Next ↔ Roof Fusion I1 contract review — 2026-09-01

## Gate result

- `STATUS`: `BLOCKED_TECH`
- `GATE`: `I1`
- `UI_FOUNDATION_SHA`: `f06aaa03154fbd75d88256d404df21f9fcca9c49`
- `RF_IMPLEMENTATION_SHA`: `eee822333192fff52eeb9df2e0d937d6e6c5a009`
- `RF_I1_PACKAGE_SHA`: `6a024b1f9ede25832dde8ed03539e7d937469e82`
- `UI_DECISION`: contract direction accepted; canonical adapter activation blocked
- `FP0`: `IMPLEMENTED / NOT_PASS` (unchanged)
- `FP1`: `IMPLEMENTED / NOT_PASS`
- `FP2`: `NOT_PASS`

No RF source, migration, API, integration branch, Production flag or approved
dark UI presentation was changed by this review.

## Contract decisions

| Contract | Verdict | UI decision |
| --- | --- | --- |
| `roof-snapshot.v1` | **ACCEPT** | Canonical internal Roof read model. Unknown versions and hash drift fail closed. |
| `roof-renderer.v1` | **ACCEPT** | Common deterministic renderer payload derived from the canonical snapshot. |
| `approved-roof-renderer-envelope.v1` | **ACCEPT** | The only Roof payload allowed for worker, customer, PDF and other downstream consumers. |
| explicit `m`, `m2`, `deg`, coordinate and precision semantics | **ACCEPT** | UI rounds for display only and never changes canonical values or hashes. |
| scalar measurement/confidence structure | **ACCEPT** | Confidence remains attached to each value; unknown/range cannot be promoted by UI or AI. |
| full provenance versus approved renderer boundary | **ACCEPT** | Full provenance is internal; downstream receives only approved customer-safe attribution. |
| append-only snapshot persistence | **CHANGE** | Direction accepted, but the integration stream must name and implement the dedicated repository/collection. `roof-measurements` remains a legacy bridge, not the new authority. |
| approval/correction concurrency commands | **ACCEPT** | Expected hash, idempotency, actor/time and append-only correction semantics are required. UI wiring remains blocked until an authorized command API exists. |
| feature gate `roofFusionV1` | **CHANGE** | Name accepted. It must be added independently to the shared platform registry. Existing `roofMeasurement` or `measurementEvidenceV2` must never enable approval or downstream publication. |

## Seven capability decisions

| Capability | Verdict | Actor and boundary | Adapter maturity / gate |
| --- | --- | --- | --- |
| `roof_fusion.snapshot.read` | **CHANGE** | Full snapshot: case-scoped administrator only. A worker should use the approved renderer envelope unless RF defines a separate worker-safe internal projection. | No canonical UI adapter; blocked. |
| `roof_fusion.evidence.read` | **ACCEPT** | Administrator only; includes internal provenance, licence and fusion evidence. | No authorized endpoint; blocked. |
| `roof_fusion.calculate` | **ACCEPT** | System/service only. Never an ordinary UI or worker action. | RF deterministic library exists; repository/job ownership is not integrated. |
| `roof_fusion.review` | **ACCEPT** | Administrator only; read gates and submit an explicit review outcome. | Preview stays read-only; mutation endpoint is blocked. |
| `roof_fusion.correct` | **ACCEPT** | Administrator only through `roof-snapshot-correction-command.v1`. | Contract accepted; RF-3/repository/API implementation blocked. |
| `roof_fusion.approve` | **ACCEPT** | Administrator only through `roof-snapshot-approval-command.v1` and exact expected hash. | Contract accepted; RF-3/repository/API implementation blocked. |
| `roof_fusion.renderer.read_approved` | **ACCEPT** | Case-scoped administrator, assigned worker, customer token or PDF service; approved envelope only. | Renderer library exists; authenticated delivery adapters are blocked. |

The executable UI registry now records all seven IDs and the accepted target
versions, but deliberately marks the target as
`contract_accepted_adapter_blocked`. It does not add a working shared feature
flag or claim release readiness.

## Exact incompatibilities in the current UI adapter

The existing `AdminNextCaseWorkspaceView.measurementReview` is a deterministic
legacy Preview fixture, not a `roof-snapshot.v1` adapter. A canonical adapter
must resolve these field-level differences:

1. `state: review_required | verified` cannot represent the six snapshot
   lifecycle states: `draft`, `review_required`, `blocked`, `approved`,
   `rejected`, `superseded`.
2. `areaSquareMeters` is ambiguous. The UI must identify whether it shows
   `grossHorizontalArea`, `grossSurfaceArea` or `netSurfaceArea`.
3. `confidencePercent` is a case-wide badge. I1 confidence belongs to each
   measurement value and includes level, score, basis and rationale.
4. `primarySlopes[].areaSquareMeters`, `pitchDegrees` and `perimeterMeters`
   flatten units, ranges, uncertainty and source references.
5. `reviewEdges[].varianceMeters` does not carry the canonical edge type,
   adjacent surfaces, 2D/3D lengths, quality and evidence references.
6. The current single provenance/checksum block does not represent source
   licence, visibility, observations, fusion decisions, `inputHash`,
   `snapshotHash` and `renderHash` as distinct identities.
7. Current photos/sources do not enforce `internal`, `customer_safe` and
   `derived_only` visibility.
8. Current `verified` UI wording cannot substitute for an approved snapshot
   plus approved approval metadata.

The approved R4 drawer design remains usable. Its adapter must change; the UI
must label the chosen canonical area total and render value-level confidence,
quality and source details without mutating canonical values.

## Persistence, API and mutation ownership

Accepted target ownership:

- RF owns schemas, deterministic calculation, canonical normalization,
  hashing, renderer derivation and pure approval/correction command behavior.
- Integration owns the append-only repository/collection, indexes,
  authentication, authorization, API envelopes, audit persistence and feature
  registry wiring.
- Admin Next owns presentation and read adapters. It does not write snapshot
  JSON directly.
- Legacy `roof-measurements` remains linked by
  `subject.legacyMeasurementId`; it must not be recalculated into already
  accepted/signed artifacts.

Required API split:

1. authorized internal snapshot read;
2. administrator-only evidence read;
3. administrator-only review/correct/approve command endpoints;
4. approved renderer envelope read with case/customer/worker scope;
5. exact error behavior for unknown version, stale hash, duplicate
   idempotency key, blocked quality and unauthorized scope.

## Fail-closed rules accepted by UI

- Unknown snapshot, renderer, source or command version is rejected.
- Zero and unknown remain distinct.
- Full provenance never reaches customer, worker or PDF consumers.
- No approved renderer envelope exists before both snapshot and approval state
  are approved.
- Documents bind both `sourceSnapshotHash` and `renderHash`.
- Preview performs no calculate, review, correct or approve mutation.
- `measurementEvidenceV2` may continue to guard the legacy R4 fixture, but it
  cannot enable any Roof Fusion write or publication capability.

## FP1 consequences

`IMPLEMENTED / NOT_PASS`:

- I1 target versions, seven action IDs and legacy-versus-target Roof boundary
  are now explicit in the UI registry.
- FP1 remains blocked until `roofFusionV1` is added to the shared platform
  feature registry and an authorized read-only snapshot adapter is available.
- Case/Property linkage must preserve required `subject.caseId`, optional
  `subject.propertyId` and compatibility-only `legacyMeasurementId`.
- Characterization must prove unknown-version/hash failures fall back safely
  and do not reinterpret the payload as the legacy fixture.

## FP2 consequences

`NOT_PASS`:

- R4 must map canonical lifecycle, totals, per-value confidence, geometry,
  issues, lineage and hashes without lossy reinterpretation.
- Preflight must require an approved renderer envelope and bind both snapshot
  and renderer hashes before generating quote/contract/PDF artifacts.
- Worker/customer/PDF consumers must use only
  `roof_fusion.renderer.read_approved`.
- Review/correct/approve screens remain blocked until RF-3 plus repository/API
  authorization, audit and idempotency evidence exist.
- Full integration CI needs negative cases for unknown versions, stale hashes,
  restricted licence, evidence conflicts, blocked quality and cross-case
  authorization.

## NEEDS_FROM_STREAM: RF

1. Confirm the UI amendment that full `roof_fusion.snapshot.read` is
   administrator-only and workers use the approved renderer envelope; or
   propose a separately named worker-safe projection capability.
2. Publish the RF-3 repository interface and command result/error taxonomy
   without implementing shared routes in the RF branch.
3. Resolve DEC-RF-001 measurement-class promotion ownership.
4. Provide golden/negative fixtures for restricted licence, evidence conflict,
   unknown edge, stale approval hash and cross-revision renderer binding.
5. Keep RF changes isolated until the integration stream supplies the shared
   `roofFusionV1` flag and authorized adapter package.

## Next gate

I1 can move from `BLOCKED_TECH` only after RF accepts or amends item 1 and the
integration stream supplies an interface-only package for the shared feature
gate, append-only repository and authorized read adapters. This decision does
not make FP0, FP1 or FP2 PASS.
