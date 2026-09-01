# I1 Roof Fusion contract delta for UI integration — 2026-09-01

## Gate status

- `STATUS`: `READY_FOR_UI_REVIEW`
- `GATE`: `I1`
- `RF_BRANCH`: `codex/rf-roof-fusion-engine-20260901`
- `RF_CONTRACT_BASE_SHA`: `e753423db1d5aef3b680b3221f03031ccc406c99`
- `RF_LATEST_IMPLEMENTATION_SHA`: `eee8223` (`feat(roof-fusion): add deterministic geometry pipeline v1`)
- `SHARED_FILES_CHANGED`: none
- `MIGRATION_OR_API_CHANGE`: none
- `RF3_STATUS`: not started; gated on the UI foundation Gate report
- `NEEDS_FROM_STREAM: UI`: accept, reject, or amend the persistence/API/capability mapping below before RF-3 review/correction expansion.

## Canonical artifacts

| Contract                   | Version                               | Canonical implementation                         |
| -------------------------- | ------------------------------------- | ------------------------------------------------ |
| Roof snapshot              | `roof-snapshot.v1`                    | `src/lib/roof-fusion/roof-snapshot-v1.ts`        |
| Renderer payload           | `roof-renderer.v1`                    | derived inside `roof-snapshot-v1.ts`             |
| Approved renderer envelope | `approved-roof-renderer-envelope.v1`  | `approvedRoofRendererPayloadV1`                  |
| Source request             | `roof-source-request.v1`              | `src/lib/roof-fusion/source-adapter-v1.ts`       |
| Source result              | `roof-source-result.v1`               | `src/lib/roof-fusion/source-adapter-v1.ts`       |
| Geometry input             | `roof-geometry-input.v1`              | `src/lib/roof-fusion/geometry-calculation-v1.ts` |
| Geometry calculation       | `roof-geometry-calculation.v1`        | `src/lib/roof-fusion/geometry-calculation-v1.ts` |
| Approval command           | `roof-snapshot-approval-command.v1`   | `approveRoofSnapshotV1`                          |
| Correction command         | `roof-snapshot-correction-command.v1` | `applyRoofSnapshotCorrectionV1`                  |

Unknown contract versions fail closed. UI/API code must not reinterpret an unknown version as the latest known shape.

## Delta from the current measurement model

The existing `RoofMeasurements` and quote copies remain unchanged in this RF worktree. I1 introduces a proposed canonical append-only roof snapshot rather than another mutable measurement copy.

The snapshot identity and concurrency fields are:

| Field                         | Type/semantics                   | UI integration rule                         |
| ----------------------------- | -------------------------------- | ------------------------------------------- |
| `schemaVersion`               | literal `roof-snapshot.v1`       | required and fail closed                    |
| `snapshotId`                  | stable identifier                | route/display identity                      |
| `revision`                    | positive integer                 | increases on correction                     |
| `supersedesSnapshotId`        | optional identifier              | lineage, never in-place overwrite           |
| `subject.caseId`              | identifier                       | required case ownership                     |
| `subject.propertyId`          | optional identifier              | property linkage                            |
| `subject.legacyMeasurementId` | optional string/positive integer | compatibility linkage only                  |
| `inputVersion`                | source input contract version    | evidence traceability                       |
| `engineVersion`               | RF implementation version        | reproducibility                             |
| `rendererVersion`             | renderer implementation version  | visual reproducibility                      |
| `inputHash`                   | SHA-256                          | binds normalized work to source request     |
| `generatedAt`                 | offset timestamp                 | immutable version timestamp                 |
| `state`                       | lifecycle enum                   | never infer from UI-local booleans          |
| `snapshotHash`                | canonical SHA-256                | ETag/concurrency token and document binding |

Lifecycle states are exactly `draft`, `review_required`, `blocked`, `approved`, `rejected`, and `superseded`. Processing status is separately `complete`, `partial`, `error`, or `unknown`; it includes structured issues with `code`, `severity`, `message`, `retryable`, and optional `sourceRef`.

## Units and coordinate contract

All snapshot quantities carry explicit units. Canonical storage is:

```text
length      = m
area        = m2
angle       = deg
coordinates = m
```

The snapshot declares display precision separately as `lengthDecimals`, `areaDecimals`, and `angleDecimals` from 0–6. UI may round only for display; it must preserve canonical numeric values and hashes unchanged.

Coordinate systems declare:

- `kind`: `local_cartesian`, `wgs84`, or `projected_crs`;
- `reference`: human/machine-readable CRS or local-frame reference;
- `axisOrder`: `x_east_y_north_z_up`, `longitude_latitude`, or `easting_northing`;
- optional WGS84 origin with latitude, longitude, and elevation.

The RF-2 calculator currently accepts metric local/projected vertices. CRS transformation is not part of I1.

## Measurement and confidence contract

Every scalar measurement uses the same structure:

```ts
{
  mode: "exact" | "range" | "unknown";
  unit: "m" | "m2" | "deg";
  min: number | null;
  max: number | null;
  sourceRefs: string[];
  confidence: {
    level: "high" | "medium" | "low" | "unknown";
    score: number | null; // 0..1 when known
    basis:
      | "calibrated"
      | "provider_reported"
      | "human_assessed"
      | "derived"
      | "unknown";
    rationale: string;
  };
}
```

Rules:

- `unknown` requires `min = max = null` and cannot carry a confidence score;
- `exact` requires equal non-null bounds;
- `range` requires non-null ordered bounds;
- confidence belongs to the value; UI must not replace it with one case-wide badge;
- AI text cannot promote `unknown` or a range to an exact value.

Measurement classes are `preliminary`, `fused_estimate`, `verified_geometry`, and `instrument_site_verified`. I1 does not define automatic promotion; that remains DEC-RF-001.

## Geometry and total semantics

The canonical graph includes:

- metric vertices with uncertainty and source references;
- typed contours and ordered vertex rings;
- surfaces with contour, opening, edge, normal, azimuth, pitch, gross/net areas, quality, and sources;
- edges with adjacent surfaces, `ridge|hip|valley|eave|rake|wall|step|unknown`, 2D/3D lengths, gutter-candidate flag, quality, and sources;
- openings and obstacles as separate entities.

UI labels must keep these totals distinct:

| Canonical total         | UI meaning                                                  |
| ----------------------- | ----------------------------------------------------------- |
| `grossHorizontalArea`   | plan-view roof area                                         |
| `grossSurfaceArea`      | sloped surface before opening deductions                    |
| `netSurfaceArea`        | sloped surface after opening deductions                     |
| `footprintPerimeter`    | external plan perimeter                                     |
| `eaveLength`            | geometrically classified eave length                        |
| `gutterCandidateLength` | candidate water-collection edges                            |
| `verifiedGutterLength`  | separately verified installed guttering; may remain unknown |

Zero and unknown are not interchangeable. Footprint perimeter, eave length, and gutter length are not interchangeable.

## Provenance, licence, visibility, and fusion contract

Every source contains:

- stable `sourceId`, source kind, provider and optional provider object ID;
- input/adapter versions, capture/retrieval timestamps, and raw SHA-256;
- licence `status`, `name`, `attribution`, and optional terms version;
- visibility `internal`, `customer_safe`, or `derived_only`;
- quality `usable`, `limited`, `rejected`, or `unknown`, score, and reasons.

Every evidence observation has a target entity, structured value, source references, confidence, reasons, and status `accepted`, `rejected`, `conflicted`, or `unknown`. The fusion decision lists the exact accepted/rejected/conflicted observation IDs, policy version, actor, time, and rationale.

Fail/review behavior:

- denied licence or rejected source quality → quality `fail`, snapshot `blocked`;
- restricted/unknown licence or limited/unknown suitability → `review_required`;
- unresolved evidence conflict or unknown edge → `review_required`;
- declared and normalized source records must match exactly.

Customer consumers must never receive the full provenance block. They receive only the approved renderer payload, whose source list contains non-internal source ID, kind, attribution, and licence status. Raw content, provider secrets, internal source metadata, observations, and administrator identity remain outside that payload.

## Renderer interface

`roof-renderer.v1` is derived from the same canonical snapshot and includes:

- renderer version, display state, measurement class, units/precision, and coordinate system;
- canonical vertices, contours, surfaces, edges, openings, obstacles, and totals;
- customer-safe/derived source attribution only;
- `renderHash`, a SHA-256 over the complete renderer payload excluding the hash itself.

Downstream customer, PDF, worker, and approved admin rendering must use:

```ts
{
  schemaVersion: "approved-roof-renderer-envelope.v1";
  snapshotId: string;
  snapshotRevision: number;
  sourceSnapshotHash: string;
  approval: {
    status: "approved";
    approvedBy: Actor;
    approvedAt: string;
    reviewReason?: string;
  };
  payload: RoofRendererPayloadV1;
}
```

The envelope is unavailable unless snapshot state and approval status are both `approved`. Consumers should bind generated documents to both `sourceSnapshotHash` and `payload.renderHash`.

## Write-command concurrency contract

The UI foundation does not need to implement RF-3 screens yet, but its mutation/read conventions must preserve these fields:

### Approval command

```ts
{
  schemaVersion: "roof-snapshot-approval-command.v1";
  expectedSnapshotHash: string;
  idempotencyKey: string;
  actor: Actor;
  approvedAt: string;
  reviewReason?: string;
}
```

### Correction command

All variants carry `schemaVersion`, `newSnapshotId`, `expectedSnapshotHash`, `idempotencyKey`, `actor`, `correctedAt`, `reason`, and non-empty `sourceRefs`. Current variants are:

- `edge_type`: `edgeId` plus typed edge value;
- `edge_gutter_candidate`: `edgeId` plus boolean value;
- `surface_pitch`: `surfaceId` plus the canonical measurement-value structure in degrees.

An approved/rejected/superseded snapshot is immutable. A correction creates revision +1 with `supersedesSnapshotId`; it does not update the prior JSON in place. Stale hashes fail and repeated idempotency keys return the existing result.

## Proposed capability interface — requires UI acceptance

No central capability or feature registry was changed. RF proposes the following action-level capabilities for the canonical UI foundation:

| Proposed capability ID               | Scope                                        | Intended actors                                |
| ------------------------------------ | -------------------------------------------- | ---------------------------------------------- |
| `roof_fusion.snapshot.read`          | full internal snapshot/read model            | administrator; scoped worker where authorized  |
| `roof_fusion.evidence.read`          | internal provenance and licence details      | administrator only                             |
| `roof_fusion.calculate`              | create deterministic draft/review snapshot   | system/service only                            |
| `roof_fusion.review`                 | view quality gates and submit review outcome | administrator only                             |
| `roof_fusion.correct`                | create a corrected snapshot revision         | administrator only                             |
| `roof_fusion.approve`                | approve exact expected snapshot hash         | administrator only                             |
| `roof_fusion.renderer.read_approved` | approved renderer envelope                   | case-scoped administrator, worker, or customer |

Recommended rollout isolation is one future `roofFusionV1` feature gate plus the action-level capabilities above. The existing `roofMeasurement` and `measurementEvidenceV2` flags must not silently enable RF approval/customer publication. Adding or mapping this flag belongs to the UI/integration stream because it owns the shared registry.

## Proposed persistence/API ownership — requires UI acceptance

Recommendation:

1. store snapshots append-only in a dedicated canonical repository/collection keyed by `snapshotId`, `revision`, `subject.caseId`, and `snapshotHash`;
2. keep the full `roof-snapshot.v1` JSON as the authoritative record rather than rebuilding it from flattened UI fields;
3. expose the full snapshot only on internal, authorized endpoints;
4. expose only `approved-roof-renderer-envelope.v1` to customer/worker/PDF consumers;
5. index lineage/state/hash fields, but never allow indexed copies to become the authority;
6. retain the legacy measurement link during migration without recalculating old accepted/signed artifacts.

No migration or endpoint is implemented in the RF branch. UI/integration owns the final repository, route, authentication, and capability conventions.

## I1 response requested from UI

Return one Gate report with:

- `STATUS`: `PASS`, `BLOCKED_TECH`, or `BLOCKED_OWNER`;
- accepted snapshot/renderer version names;
- accepted units and measurement semantics;
- accepted full-vs-renderer provenance boundary;
- accepted append-only persistence owner and API envelope convention;
- accepted or renamed capability IDs and feature-gate mapping;
- any exact field-level incompatibilities with FP0–FP2 canonical contracts;
- `NEEDS_FROM_STREAM: RF` items, if any;
- UI foundation SHA used for the decision.

RF may continue only isolated RF-2 negative/golden fixtures while this Gate report is pending. RF-3 review/correction expansion remains stopped.

## Evidence

- RF-0/RF-1 contract milestone: `e753423`
- RF-1 hardening milestone: `8e90e29`
- RF-2 geometry milestone: `eee8223`
- RF tests at RF-2: 35/35 passed
- full unit regression: 1,043/1,043 tests across 230 files passed
- TypeScript, RF ESLint, and diff-check: passed
