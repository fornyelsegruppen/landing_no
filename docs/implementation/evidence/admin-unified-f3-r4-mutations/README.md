# Admin Next R4 Preview mutation reviews

Source-rendered desktop evidence for the integrated R4 mutation controls. These
captures are not generic mockups: the guarded fixture renders the production
`AdminNextR4MeasurementReview`, `AdminNextCaseAddressCorrection`,
`AddressCorrectionReviewAndCommit`, and `AdminNextRfOfferBridgeAction`
components with deterministic synthetic Preview bindings.

## Captures

- `address-review-1440.png` — address form completed and the real destructive
  ReviewAndCommit overlay opened, including before/after, reason, invalidated RF
  sources/drafts, preflight checks, and typed confirmation.
- `offer-review-1440.png` — verified R4 snapshot and the real material
  ReviewAndCommit overlay opened, including exact case/address/snapshot revisions
  and the explicit list of actions that do not happen.

The capture script does not confirm either review and asserts that no mutating
Admin API request occurs. `layout-gate-results.json` records route allowlisting,
viewport/overflow/stacking checks, keyboard focus, review structure, and zero
mutation requests.

## Guard

The fixture route requires both `NODE_ENV !== production` and
`ADMIN_NEXT_VISUAL_FIXTURE=true`. Its unit test verifies that production,
disabled-gate, and unknown-state requests fail closed via `notFound()`.

## Reproduce

Run a local development server with `ADMIN_NEXT_VISUAL_FIXTURE=true`, then run:

```powershell
node scripts/f3-capture-r4-mutation-reviews.mjs
```
