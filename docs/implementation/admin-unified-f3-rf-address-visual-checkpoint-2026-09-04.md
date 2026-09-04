# Admin Unified F3 — RF address and visual checkpoint

## Outcome

The owner-approved RF address contract and the latest visual acceptance details
are now represented in the shared ONE UI implementation and backlog.

Implemented in protected Preview:

- immutable case address plus case/measurement revision context in the RF
  workbench slot and R4 review;
- separate address-correction entry point and explicit invalidation disclosure;
- fail-closed diagnostic label on the legacy UAT free-address input;
- screen-stable source, approved, ridge/valley and vertex geometry styling;
- one semantic Lucide icon language for the four main RF result metrics;
- a single bounded R4 drawer scroll region that remains usable on 375 px.

After the owner's separate `PREVIEW MUTATION/SCHEMA GO`, the following are now
implemented behind independent Preview-only flags:

- typed address-correction `ReviewAndCommit` with exact before/after values,
  reason, idempotency and revision CAS;
- atomic case/address revision advancement and exact RF source invalidation;
- fail-closed restored-draft `Continue old / Start new` decisions bound to the
  current case/address/source/snapshot/draft hashes;
- hash-bound RF approval and transactional RF → immutable measurement → price
  calculation → offer draft → contract draft;
- explicit proof that the bridge creates no customer message, issue, approval,
  signature or send side effect.

Still gated: protected owner UAT, Preview feature activation and all Production
routing or writes.

## Required next authorization

The Preview mutation/schema authorization has been consumed for this isolated
implementation. Before any Production migration, route/config activation or
deployment, a separate explicit **PRODUCTION GO** remains mandatory.

Visual evidence:

- [evidence README](./evidence/admin-unified-f3-rf/README.md)
- [Windows 150 % / RF 100 % workbench](./evidence/admin-unified-f3-rf/rf-workbench-win150-100.png)
- [Windows 150 % / RF 300 % canvas](./evidence/admin-unified-f3-rf/rf-canvas-win150-300.png)
- [R4 address and metric icons](./evidence/admin-unified-f3-rf/r4-case-address-icons-1440.png)
- [R4 mobile metrics](./evidence/admin-unified-f3-rf/r4-metrics-mobile-375.png)
- [real integrated address-correction review](./evidence/admin-unified-f3-r4-mutations/address-review-1440.png)
- [real integrated RF-to-offer review](./evidence/admin-unified-f3-r4-mutations/offer-review-1440.png)
- [R4 mutation layout and zero-request gate](./evidence/admin-unified-f3-r4-mutations/layout-gate-results.json)

## Preview mutation/schema quality gate

The final local verification after combining the address command, draft
recovery, offer bridge, immutable commercial drafts, and case-history
projection is green:

- unit/API/component: 344 files and 1,929 tests passed;
- migration up/down: 24 files and 45 tests passed;
- TypeScript: passed;
- semantic token gate and ESLint: passed with the one existing intentional
  authenticated RF image `<img>` optimization warning;
- generated Payload types: reproducible with no diff;
- dependency audit at the CI `high` threshold: passed; seven transitive
  `moderate` advisories have no available upstream fix.

The two additive migrations both contain explicit `down` rollback functions.
They have only been exercised in isolated migration tests; no Production
database, route, flag, message, quote approval, contract issue, or signature
state was changed.
