# Roof Fusion RF-0/RF-1 milestone — 2026-09-01

## Status packet

- `STATUS`: `IMPLEMENTED` — isolated contract-first vertical is implemented and verified; production persistence and UI/API integration are intentionally not part of this milestone.
- `BRANCH`: `codex/rf-roof-fusion-engine-20260901`
- `WORKTREE`: `C:\Users\Fornyelsegruppen\.codex\worktrees\f9a6\takfornyelse-production-a8799d5`
- `BASE_SHA`: `195f3d958a554e692445c1f5b8b5b9ccf6529bea`
- `LAST_SHA`: recorded in the accompanying handoff packet; a commit cannot embed its own SHA.
- `PHASE`: RF-0 inventory plus RF-1 canonical contract and first deterministic vertical.
- `BLOCKERS`: no technical blocker for the next isolated RF-1/RF-2 work; DEC-RF-001 through DEC-RF-005 must be resolved before production promotion, customer exposure, or approval-policy freeze.
- `OWNER_AND_DEADLINE`: Roof Fusion stream owns the next isolated adapter/geometry work. Product owner decisions are required before RF-3 contract freeze; no calendar deadline has been assigned.
- `NEEDS_FROM_STREAM: UI`: none for this isolated milestone. Before integration, UI must consume the versioned renderer payload and submit `expectedSnapshotHash` plus an idempotency key on approval/correction writes. No shared UI, capability, migration, CI, or lockfile file was changed here.

## Baseline and read-only inputs

The worktree started detached at `195f3d958a554e692445c1f5b8b5b9ccf6529bea` and was moved to the dedicated branch named above. No repository `AGENTS.md` was present. The following main-checkout documents were read without modification:

- `docs/operations/full-production-program-control-2026-09-01.md`
- `docs/operations/full-production-ui-ux-automation-execution-plan-2026-09-01.md`
- `docs/operations/admin-crm-ux-benchmark-audit-2026-09-01.md`
- `docs/operations/post-stabilization-product-backlog.md`

## RF-0 inventory result

The existing roof path has three independent geometry/render projections and several partially overlapping hashes. The legacy proposal model carries WGS84 plane polygons and slope intervals, but it does not carry a canonical edge graph, openings, obstacles, explicit units/CRS, complete provenance, or stable renderer contract. Quote, PDF, customer, worker, and admin copies can therefore drift.

The existing approval protection also does not lock every field that can change price or evidence meaning. In particular, area/range values, calculation snapshot, confidence/reasoning, provenance, source licence metadata, and some hash semantics remain distributed. Approval endpoints do not consistently require the expected snapshot hash or a revision, so a stale-write risk exists outside this isolated module.

## Implemented vertical

`roof-snapshot.v1` is now a strict, versioned and hash-bound snapshot contract. It includes:

- explicit units and coordinate reference system;
- vertices, surface contours, typed shared edges, openings, and obstacles;
- gross horizontal area, gross surface area, net surface area, footprint perimeter, eave length, gutter-candidate length, and verified gutter length as separate values;
- exact/range/unknown measurement modes with confidence and source references;
- evidence observations, fusion decisions, source/licence/visibility policy, manual corrections, audit trail, quality checks, approval state, and renderer payload;
- canonical geometry ordering and SHA-256 integrity checks;
- fail-closed unknown contract versions and tamper detection;
- expected-hash and idempotency checks for approval/correction operations;
- approved-snapshot immutability; corrections create a new draft snapshot version;
- a fake versioned provider adapter, error/partial/empty/unknown-version mapping, and idempotent replay checks;
- a compatibility adapter from current roof-plane proposals that retains the legacy aggregate result without inventing edge semantics;
- one approved renderer envelope reused byte-for-byte by admin, worker, customer, and PDF consumer tests;
- a deterministic, customer-safe SVG proof generated only from an approved payload.

No external provider or system is contacted. The fixture and fake provider are deterministic.

## Owner-visible proof

The concrete fixture is assembled by `src/lib/roof-fusion/gable-roof-fixture-v1.ts` from `src/lib/roof-fusion/__fixtures__/gable-roof-normalized-v1.json`. It produces one exact `roof-snapshot.v1` object, an approved renderer envelope, and the checked-in golden SVG at `src/lib/roof-fusion/__fixtures__/gable-roof-approved-v1.golden.svg`.

Pinned proof identifiers:

- approved snapshot hash: `1feae771b507a76a4cf91e0ea13480caf45b25711e3879821338e07dc567ee1d`
- renderer payload hash: `31009c8980383d0abf653c2a8ad188f8d3eac39a0b84ab3f1a6fb189e822ead7`
- SVG artifact hash: `eb29e389a9cd9b9da528e2d1b45f2fe35f491d198e075746c799d63e8125e2ac`

Fixture totals:

| Quantity                |          Result |
| ----------------------- | --------------: |
| Gross horizontal area   |       80.000 m² |
| Gross surface area      | 92.376043070 m² |
| Net surface area        | 90.990402424 m² |
| Footprint perimeter     |        36.000 m |
| Eave length             |        20.000 m |
| Gutter candidate length |        20.000 m |
| Verified gutter length  |         Unknown |

The last line is deliberate: an eave or gutter candidate is not silently promoted to a verified installed gutter measurement.

## Quality gate summary

The approved fixture has seven deterministic gates, all `pass`:

| Gate                      | Result | Meaning                                                      |
| ------------------------- | ------ | ------------------------------------------------------------ |
| `INGEST_STATUS`           | pass   | Declared provider input normalized completely                |
| `GEOMETRY_PRESENT`        | pass   | At least one roof surface exists                             |
| `TOPOLOGY_AND_REFERENCES` | pass   | Geometry and provenance references are internally consistent |
| `SOURCE_LICENSE`          | pass   | Every used source has authorized status                      |
| `EDGE_CLASSIFICATION`     | pass   | All fixture edges are explicitly classified                  |
| `EVIDENCE_CONFLICTS`      | pass   | No unresolved evidence conflict remains                      |
| `MEASUREMENT_CONFIDENCE`  | pass   | Measurement confidence is high                               |

The contract also exercises `review_required` for partial/ambiguous input and `fail` for failed, empty, unauthorized, or unknown-version input. A `fail` snapshot cannot be approved. A `review_required` snapshot currently requires a human review reason; the final class-specific override rule is DEC-RF-003.

## Decision packages

### DEC-RF-001 — measurement-class promotion

- `QUESTION`: which actor and evidence threshold may promote `preliminary` or `fused_estimate` to `verified_geometry` or `instrument_site_verified`?
- `IMPACT`: controls whether price, work order, customer material, and claims can be presented as exact/verified.
- `RECOMMENDATION`: allow automation to produce `preliminary` and `fused_estimate`; require a named human approval plus passing relevant quality gates for `verified_geometry`; reserve `instrument_site_verified` for an identified on-site instrument workflow and evidence record.
- `ALTERNATIVES`: require human approval for every class; or permit calibrated-provider auto-promotion after a separately approved validation study.
- `CONTINUES_WHILE_WAITING`: adapters, deterministic fixtures, topology checks, and snapshot/render hash tests.

### DEC-RF-002 — customer source and licence exposure

- `QUESTION`: which raw provider/photo/source artefacts may be visible to customers and in PDFs?
- `IMPACT`: licence compliance, privacy, explainability, and customer trust.
- `RECOMMENDATION`: keep raw restricted/provider/manual artefacts internal; expose only derived geometry plus explicitly customer-approved attribution. `restricted` or `unknown` source rights require review; `denied` fails closed.
- `ALTERNATIVES`: allow raw previews only where a source-specific licence grant is stored; or use a global derived-only customer policy.
- `CONTINUES_WHILE_WAITING`: internal provenance capture and derived-only renderer tests. The current proof uses derived-only customer visibility.

### DEC-RF-003 — `review_required` approval override

- `QUESTION`: when may a human approve a snapshot whose deterministic quality result is `review_required`?
- `IMPACT`: determines whether ambiguity can leak into exact price or verified claims.
- `RECOMMENDATION`: permit a reasoned override only for `preliminary`/`fused_estimate` and only when the unresolved item is shown to downstream consumers; require every price-relevant gate to pass for verified classes. Never override `fail`.
- `ALTERNATIVES`: prohibit all overrides; or create per-gate override permissions with two-person approval.
- `CONTINUES_WHILE_WAITING`: fail-closed behavior, audit metadata, stale-hash protection, and explicit review-state rendering. The current reversible implementation requires a human reason but does not yet encode the final class matrix.

### DEC-RF-004 — area and gutter semantics

- `QUESTION`: which quantities are allowed in quotes/customer material, and under what labels?
- `IMPACT`: prevents gross/net area and eave/gutter figures from being interpreted as interchangeable.
- `RECOMMENDATION`: always label gross horizontal, gross surface, and net surface separately; keep footprint perimeter, eave, gutter candidate, and verified gutter separate; preserve `unknown` rather than substituting zero or a candidate value.
- `ALTERNATIVES`: expose only net area externally; or expose a purpose-specific commercial area derived by an approved pricing policy.
- `CONTINUES_WHILE_WAITING`: explicit quantities and units remain available without choosing a commercial presentation.

### DEC-RF-005 — first reliable production geometry source

- `QUESTION`: which source should be the first production path for facet geometry and edge semantics?
- `IMPACT`: controls RF-2/RF-3 accuracy, Workbench effort, provider licensing, and rollout risk.
- `RECOMMENDATION`: ship a human-reviewed Workbench/structured-import path first, keep the legacy plane bridge `preliminary`, and evaluate a licensed structured provider against golden fixtures before any automatic promotion.
- `ALTERNATIVES`: integrate a licensed provider first; or invest first in photogrammetry/LiDAR plane fitting.
- `CONTINUES_WHILE_WAITING`: source-neutral contract, fake adapters, geometry validation, and legacy compatibility regression.

## Acceptance evidence

The milestone is accepted as `IMPLEMENTED`, not production `PASS`. Required production persistence, endpoint integration, frozen UI consumer contract, real provider validation, and owner decisions are still outside this slice. Verification commands and final commit SHA are recorded in the handoff message accompanying this document.
