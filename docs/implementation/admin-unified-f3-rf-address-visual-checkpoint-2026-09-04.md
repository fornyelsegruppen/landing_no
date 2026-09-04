# Admin Unified F3 — RF address and visual checkpoint

## Outcome

The owner-approved RF address contract and the latest visual acceptance details
are now represented in the shared ONE UI implementation and backlog.

Implemented in protected/read-only Preview:

- immutable case address plus case/measurement revision context in the RF
  workbench slot and R4 review;
- separate address-correction entry point and explicit invalidation disclosure;
- fail-closed diagnostic label on the legacy UAT free-address input;
- screen-stable source, approved, ridge/valley and vertex geometry styling;
- one semantic Lucide icon language for the four main RF result metrics;
- a single bounded R4 drawer scroll region that remains usable on 375 px.

Still gated:

- the address-correction ReviewAndCommit mutation;
- atomic case/measurement revision creation and source invalidation;
- restored-draft 'Continue old / Start new' command behavior;
- immutable approval and RF-to-offer command;
- Production routing or writes.

## Required next authorization

No user action is required to review these read-only visuals. Before implementing
the first state-changing step, the owner must give a separate explicit
**Preview mutation/schema GO** for the audited address-correction and revision
contract. A later, separate **PRODUCTION GO** remains mandatory for rollout.

Visual evidence:

- [evidence README](./evidence/admin-unified-f3-rf/README.md)
- [Windows 150 % / RF 100 % workbench](./evidence/admin-unified-f3-rf/rf-workbench-win150-100.png)
- [Windows 150 % / RF 300 % canvas](./evidence/admin-unified-f3-rf/rf-canvas-win150-300.png)
- [R4 address and metric icons](./evidence/admin-unified-f3-rf/r4-case-address-icons-1440.png)
- [R4 mobile metrics](./evidence/admin-unified-f3-rf/r4-metrics-mobile-375.png)
