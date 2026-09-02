# Admin Next + Roof Fusion Preview gate — 2026-09-03

## Decision

- `STATUS`: `IMPLEMENTED / PENDING_OWNER_UAT`
- `SOURCE_HEAD_SHA`: `f231492c4e314ca6b90f45e04e86f384ec95321e`
- `MERGED_INTEGRATION_SHA`: `e53ab85`
- `MERGED_INTEGRATION_TITLE`: `feat(roof-fusion): integrate real roof data and licensed ortho preview (#16)`
- `PRODUCTION`: `NO_GO`

This report reconciles the September 1 gate documents with the current source
tree. The September 1 reports remain historically correct for their audited
SHAs, but they are now stale about Preview integration depth. Between merged
integration SHA `e53ab85` and source HEAD `f231492`, the repository gained
working Preview-only wiring for real-address lookup, real roof-surface preview,
licensed `norgeibilder.no` capture, and the protected UAT operator surface.

This report does not authorize Production activation, feature-flag enablement
in Production, customer communication, or any unrecorded owner acceptance.

## Reconciled September 1 deltas

The following September 1 statements are no longer current at source HEAD:

- `roofFusionV1` is no longer "missing from the shared registry". It exists in
  the executable feature registry and release-gate logic:
  [features.ts](../../src/lib/platform/features.ts),
  [release-gate.ts](../../src/lib/platform/release-gate.ts),
  [capability-contract-v1.ts](../../src/lib/roof-fusion/capability-contract-v1.ts).
- Preview integration is no longer fixture-only at the UAT entry point. The
  protected route now drives real address lookup, real OSM candidate selection,
  real Kartverket DOM/DTM roof-surface preview, ridge correction, and licensed
  Norge i bilder capture:
  [page.tsx](<../../src/app/(admin-shell)/admin-next-preview/roof-fusion/uat/page.tsx>),
  [admin-next-roof-fusion-uat-control.tsx](../../src/components/admin-next/admin-next-roof-fusion-uat-control.tsx),
  [norge-i-bilder-capture route](../../src/app/api/admin/roof-fusion/norge-i-bilder-capture/route.ts).
- Measurement propose/create APIs now include the approved Norge i bilder
  screenshot lane behind admin-only guards and evidence validation:
  [propose route](../../src/app/api/admin/measurements/propose/route.ts),
  [measurements route](../../src/app/api/admin/measurements/route.ts).

The following September 1 constraints remain current and are reaffirmed:

- `roofFusionV1` remains Preview-only and fail-closed for Production.
- Production activation remains blocked by release-gate evidence and the
  explicit Production block constant
  `ROOF_FUSION_V1_PRODUCTION_ACTIVATION_FORBIDDEN`.
- Owner/operator acceptance is still required before the live analyze/create/R4
  journey can be treated as accepted for business use.

## Verified current state

### Implemented in source

- Shared feature registry contains `roofFusionV1` and the release gate treats
  it as Preview-only:
  [features.ts](../../src/lib/platform/features.ts),
  [release-gate.ts](../../src/lib/platform/release-gate.ts).
- Roof Fusion capability contract remains explicit and fail-closed:
  [capability-contract-v1.ts](../../src/lib/roof-fusion/capability-contract-v1.ts).
- Protected Preview route exists and refuses non-Preview access:
  [page.tsx](<../../src/app/(admin-shell)/admin-next-preview/roof-fusion/uat/page.tsx>).
- Licensed screenshot capture is server-resolved from the canonical lead case,
  admin-only, and returns case-bound media plus geo-reference metadata:
  [norge-i-bilder-capture route](../../src/app/api/admin/roof-fusion/norge-i-bilder-capture/route.ts).
- Proposal and measurement creation flows validate approved private screenshot
  evidence before use:
  [propose route](../../src/app/api/admin/measurements/propose/route.ts),
  [measurements route](../../src/app/api/admin/measurements/route.ts).

### Recorded verification already completed

The following evidence was completed and recorded in the current working
context before this report. This report records it but does not re-run or
upgrade any claim:

- Full unit/API suite: `276` files / `1,243` tests `PASS`.
- Focused integration verification: `14` files / `62` tests `PASS`.
- Post-dependency-update capture verification: `4` files / `21` tests `PASS`.
- `npm run typecheck`: `PASS`.
- `npm run lint`: `PASS` with `0` errors; `2` intentional `<img>` warnings were
  noted.
- Vercel Preview builds for the UAT lane: `PASS`.
- Live authenticated Preview UAT capture succeeded for test case `TF-13` at
  `Lyngveien 28A, 1182 OSLO`, with a successful private image render,
  attribution `©norgeibilder.no`, and visible ortho quality suitable for
  operator review.

### Still pending

- `PENDING_OWNER_UAT`: the live operator path
  `lookup -> select -> preview -> capture -> analyze -> create -> open R4`
  has not yet been recorded as fully accepted by the owner on the current exact
  source SHA.
- The September 1 reports remain as historical evidence and must be read
  together with this newer reconciliation report.

## Gate result

### Preview

`PREVIEW_GO_FOR_OWNER_UAT`

The current source tree is suitable for exact-SHA owner acceptance work in the
protected Preview environment. The remaining high-value task is to record one
full authenticated owner UAT pass for the live analyze/create/R4 operator
journey on source HEAD `f231492`.

### Production

`NO_GO`

Production remains blocked for three independent reasons:

1. `roofFusionV1` is explicitly classified as Preview-only in the release gate.
2. No exact-SHA Production release evidence is supplied by this report.
3. Owner acceptance for the final live operator path is still pending.

## Immediate next milestone

One exact-SHA owner UAT pack on source HEAD `f231492`:

1. open the protected Preview UAT route;
2. run one real address lookup and building selection;
3. validate height-surface preview and ridge correction behavior;
4. capture one licensed Norge i bilder screenshot;
5. run analyze/create;
6. open the resulting R4 view and visually confirm the operator result.

Until that pack is recorded, this stream should be treated as
`IMPLEMENTED / PENDING_OWNER_UAT`, not as Production-ready.
