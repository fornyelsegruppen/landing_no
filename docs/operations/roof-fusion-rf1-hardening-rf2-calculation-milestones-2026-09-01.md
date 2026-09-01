# Roof Fusion RF-1 hardening and RF-2 calculation milestones — 2026-09-01

## Status packet

- `STATUS`: `IMPLEMENTED` — both isolated READY milestones are implemented; production integration remains outside this worktree slice.
- `BRANCH`: `codex/rf-roof-fusion-engine-20260901`
- `WORKTREE`: `C:\Users\Fornyelsegruppen\.codex\worktrees\f9a6\takfornyelse-production-a8799d5`
- `BASE_SHA`: `e753423db1d5aef3b680b3221f03031ccc406c99`
- `LAST_SHA`: recorded in the accompanying handoff packet; a commit cannot embed its own SHA.
- `PHASE`: RF-1 adapter/provenance/topology hardening and the first source-neutral RF-2 geometry calculation vertical.
- `BLOCKERS`: no technical blocker for further isolated geometry fixtures. DEC-RF-001 through DEC-RF-005 still gate production promotion, customer policy, review override, commercial labels, and the first real source.
- `OWNER_AND_DEADLINE`: Product Owner decisions remain due before RF-3 contract freeze; no calendar deadline is assigned.
- `NEEDS_FROM_STREAM: UI`: none. No UI, shared capability, migration, CI, infrastructure, package, or lockfile file changed.

## Milestone A — RF-1 hardening

Commit `8e90e29` hardens the existing source contract without changing the public `roof-snapshot.v1` shape:

- direct source-result-to-snapshot conversion now performs the same hash and request integrity validation as adapter ingestion;
- result status semantics reject contradictory normalized/error states;
- provider input version, result timestamp, idempotency key, request hash, and adapter identity are checked;
- declared source records and normalized provenance must match exactly, including licence, visibility, quality, attribution, and raw hash metadata;
- duplicate source records are rejected;
- topology checks now cover degenerate contours, duplicate physical edges, measured edge-length containment, reciprocal surface/edge/opening links, obstacle references, observation targets, and fusion decision buckets;
- rejected sources block the snapshot; limited or unknown suitability remains reviewable;
- negative fixtures cover tampering, omissions, duplicates, drift, bad timestamps, fusion mismatches, broken geometry references, and rejected/limited source states.

## Milestone B — first RF-2 calculation vertical

The new `roof-geometry-input.v1` → `roof-geometry-calculation.v1` pipeline is pure, deterministic, versioned, and source-neutral. It accepts explicit 3D facet vertices in metres and calculates:

- plan-view and 3D surface areas using polygon vector area;
- facet normal, pitch, and downslope azimuth;
- opening horizontal/surface area and net facet area;
- shared-edge topology, 2D/3D length, and geometric `ridge`, `hip`, `valley`, `eave`, `rake`, or `unknown` classification;
- eave-based gutter candidates without asserting that installed guttering was verified;
- input, normalized-content, calculation-trace, snapshot, and renderer hashes;
- a complete or partial `roof-source-result.v1`, followed by the existing quality-gated `roof-snapshot.v1` path.

The calculator rejects non-planar or self-intersecting facets, missing evidence sources, conflicting physical edge IDs, non-manifold edges, missing surface/opening links, openings offset from or outside their facet, and overlapping openings. Ambiguous shared edges remain `unknown`, produce a partial result, and require review.

## Deterministic golden evidence

The checked-in input fixture is `src/lib/roof-fusion/__fixtures__/gable-roof-geometry-input-v1.json`. The compact, owner-readable result is `src/lib/roof-fusion/__fixtures__/gable-roof-geometry-calculation-v1.golden-summary.json`.

Pinned identifiers:

- input hash: `421c96bf07c50ce53bbf397317ec93e9daea64011673f6ee77b396ea754c1664`
- normalized content hash: `7437ce4564f7188ace06426d77ceb40116f7a4854072ab2710d68356f3814bae`
- calculation hash: `c9fe555d0ea647df583eef17a6a16c2db473f4857e54d167ef440d5ceab5fd6c`
- review-state snapshot hash: `20d7481087b8f627633b84913a16c2bb8c921644d39a17ff6067b21c31ce9e89`
- renderer payload hash: `345388e4622b79cfb82126f757ad6f2c3a0b658082ee7a390587c9fe86934aed`

Golden results:

| Quantity                |          Result |
| ----------------------- | --------------: |
| Gross horizontal area   |       80.000 m² |
| Gross surface area      | 92.376043070 m² |
| Opening surface area    |  1.385640646 m² |
| Net surface area        | 90.990402424 m² |
| Eave length             |        20.000 m |
| Gutter candidate length |        20.000 m |
| Verified gutter length  |         Unknown |

The calculated snapshot has seven of seven quality gates at `pass`, but remains `review_required`; this milestone does not automatically promote or approve a `fused_estimate`.

## Accuracy boundary

This first vertical deliberately does not perform point-cloud plane fitting, photogrammetry, CRS transformation, real-provider ingestion, installed-gutter detection, commercial pricing, approval policy, or customer publication. It assumes:

1. vertices use metres in the declared local or projected coordinate system;
2. facets/openings are planar within twice their declared vertex uncertainty;
3. surface rings and stable edge IDs were already normalized by a source adapter or Workbench;
4. geometric edge classifications remain estimates until reviewed under the future RF-3 policy.

These assumptions are explicit in the calculation trace and bound to the calculation hash.

## Verification

- RF module tests: 35 tests across 5 files passed before the full regression run.
- TypeScript: passed.
- ESLint for the RF module: passed with no warnings.
- `git diff --check`: passed.
- Full project unit regression: 1,043 tests across 230 files passed.

No merge, cherry-pick, deploy, real external provider call, or production write was performed.
