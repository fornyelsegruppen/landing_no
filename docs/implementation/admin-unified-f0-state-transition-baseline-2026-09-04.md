# Admin Unified F0 state and transition baseline

**Status:** VERIFIED STATIC BASELINE
**Date:** 2026-09-04
**Commit:** `4d03b94`
**Scope:** current canonical statuses, explicit transition guards, derived case
actions and known enforcement gaps
**Production:** untouched; this document does not authorize schema or workflow
changes

## Purpose

This baseline separates facts already enforced in code from the target UI
vocabulary in the approved unified-admin plan. It prevents a visual refactor
from silently inventing a new business state machine.

Status labels:

- `verified` – explicit type/configuration and enforcement code found;
- `partial` – values exist, but one central transition policy was not found;
- `derived` – presentation/read-model output, not a stored canonical status;
- `gated` – planned capability intentionally unavailable for Production;
- `missing` – required target capability not found.

## 1. Current state systems

| Domain | Canonical/status source | Transition enforcement | Baseline |
|---|---|---|---|
| Case / lead | `Leads.status`, `recordState`, `caseRevision` | field hooks, API routes, `case-command`, domain helpers | `partial` – broad enforcement exists, but no single transition matrix |
| Case next action | `deriveCaseNextAction` over related entity states | read model only; commands enforce their own invariants | `derived` |
| Roof measurement | `RoofMeasurements.status` | collection approval/immutability hook and measurement APIs | `verified` |
| Roof Fusion | append-only snapshot state plus command ledger | Preview state machine, CAS/hash/provider gates | `verified` for Preview; commercial mutation `gated` |
| Price calculation | `PriceCalculations.status` | immutable records; producer services | `partial` – no standalone transition table |
| Quote | `Quotes.status` | `assertQuoteTransition`, immutable snapshot/hash hooks | `verified` |
| Contract | `Contracts.status` | `assertContractTransition`, immutable/signature hooks | `verified` |
| Change agreement | `ChangeAgreements.status` | `assertChangeTransition`, approval/hash/immutability hook | `verified` |
| Message | `Messages.status` | route/service-specific actions, system-managed fields | `partial` – no central exhaustive transition table found |
| Customer contract request | `CustomerContractRequests.status` | immutable submitted evidence plus route/service workflow | `partial` |
| Work order | `WorkOrders.status` | `assertWorkOrderTransition`, precheck and worker/admin APIs | `verified` |
| Invoice record | `InvoiceRecords.status` | explicit transition table in collection hook | `verified` |
| Warranty | `Warranties.status` | explicit active-only transition rule and immutability hook | `verified` |
| SEO post | `Posts.editorialStatus` | `assertBlogAction` plus editorial policy | `verified` for guarded actions; direct status coverage requires command inventory |
| Operational job | `OperationalJobs.status` | job-handler-specific services | `partial` – shared values, no one generic transition table |

## 2. Case / lead baseline

### Stored fields

Source: `src/payload/collections/Leads.ts:207-273`.

`Leads.status` values:

```text
new
draft_ready
customer_waiting
waiting_customer
qualified
measuring
quoted
converted
closed
contacted (legacy)
```

Separate record lifecycle:

```text
active → archived | trashed
trashed → active (restore)
trashed → purge (retention and invariant guarded)
```

The lifecycle is not a business-process stage. Archive/trash operations close
the lead and cancel/revoke open related records where allowed. Signed contracts
and accepted quotes enforce retention constraints in
`src/lib/leads/case-lifecycle.ts:75-200`.

Additional coordination fields:

| Field | Current meaning | Target treatment |
|---|---|---|
| `assignedTo` | responsible user | one accountable case owner |
| `nextAction` | free-text operational instruction | compatibility/operator note, not transition truth |
| `nextActionAt` | deadline | input to SLA and Today rank |
| `nextActionOwner` | `administrator | customer | system | worker` | current broad responsibility class; later capability projection |
| `nextActionBlocker` | free-text/code field | compatibility input until first-class blocker records exist |
| `caseRevision` | optimistic concurrency revision | mandatory CAS input for trusted case commands |

### Derived next actions

Source: `src/lib/admin-v2/case-read-model.ts:12-177`.

All current `CaseNextActionKind` values:

```text
approve_measurement
approve_package
approve_message
approve_quote
assign_worker
calculate_price
company_sign_contract
create_quote
create_work_order
generate_reply
follow_up_decline
issue_quote
measurement_required
prepare_package
prepare_question_reply
review_cancellation
review_completion
resolve_work_block
schedule_work
send_closure_confirmation
none
retry_message
wait_customer
wait_scheduled_start
wait_worker_precheck
wait_work_completion
wait_worker_documentation
```

Current resolver order is semantically significant:

1. customer cancellation request;
2. failed/attention message;
3. closing message draft;
4. other actionable message draft;
5. closed case;
6. declined quote follow-up;
7. WorkOrder assignment, scheduling, block, completion or waiting state;
8. company counter-signature;
9. create WorkOrder after full signature;
10. inbound customer question;
11. generate reply;
12. prepare package / approve package / approve measurement;
13. blocked measurement;
14. price calculation;
15. quote draft creation, approval or issue;
16. wait for customer;
17. none.

This resolver is the current broadest presentation source. The narrower Admin
Next Today contract must not replace it until it has exhaustive parity. The
stored free-text `nextAction` must not override it.

### Case command safety

Source: `src/lib/cases/case-command.ts:34-95`.

| Control | Baseline |
|---|---|
| Expected revision / CAS | `verified` when case-state engine v2 is enabled |
| Deterministic correlation/idempotency hash | `verified` |
| Duplicate audit lookup | `verified` |
| Revision increment | `verified` |
| Before/after hash | `verified` |
| Changed-field list | `verified` |
| Full human-readable `from → to` history | `missing` |
| Feature flag off bypasses trusted command path | `partial` / rollout risk |

## 3. Roof measurement and RF baseline

### Legacy/commercial RoofMeasurement

Source: `src/payload/collections/RoofMeasurements.ts:37-45` and
`src/payload/collections/RoofMeasurements.ts:230-417`.

```text
draft
review_required
blocked
approved
superseded
```

Verified controls:

- approved records are immutable;
- new versions use `version` and `supersedes`;
- source, licence, evidence, geometry and input hash are retained;
- approval verifies required evidence and hashes;
- `approvedBy` and `approvedAt` are system-controlled.

### Roof Fusion

Source: `src/payload/collections/RoofFusion.ts:34-98` and
`docs/implementation/admin-next-roof-fusion-one-card-v2-plan-2026-09-04.md`.

Verified Preview properties:

- append-only snapshot IDs, revisions, supersedes and snapshot hash;
- command ledger with case ID, idempotency key, command hash and result;
- CAS save/reload/hash/provider-identity gates;
- One Card state-driven address → building → calculation → result flow.

Gated/missing Production property:

```text
approved RF snapshot
  → exact-hash immutable RoofMeasurement version
  → existing quote engine
  → new quote draft version
```

The approved UI target opens RF directly from the concrete case Next Action.
The technical module-status/UAT route remains diagnostics, not an operator
workflow step.

## 4. WorkOrder transition matrix

Source: `src/lib/work-orders/workflow.ts:1-42`.

| From | Allowed target states |
|---|---|
| `unassigned` | `assigned`, `scheduled`, `blocked`, `cancelled` |
| `assigned` | `scheduled`, `blocked`, `cancelled` |
| `scheduled` | `on_way`, `blocked`, `cancelled` |
| `on_way` | `arrived`, `scheduled`, `blocked` |
| `arrived` | `precheck`, `blocked` |
| `precheck` | `ready`, `blocked` |
| `ready` | `in_progress`, `blocked` |
| `blocked` | `unassigned`, `assigned`, `scheduled`, `on_way`, `precheck`, `cancelled` |
| `in_progress` | `completed`, `blocked` |
| `completed` | `documented` |
| `documented` | terminal |
| `cancelled` | terminal |

An unchanged state is accepted as idempotent by
`assertWorkOrderTransition`. Worker/API guards additionally enforce assigned
worker, required precheck data, safety/scope outcomes, photos and completion
evidence. The target mobile UI must use this same server lifecycle and expose
`pending/offline/conflict` only as command-sync presentation states, not new
WorkOrder business statuses.

## 5. Commercial artefact transition matrices

### Quote

Source: `src/lib/quotes/workflow.ts:1-18`.

| From | Allowed target states |
|---|---|
| `draft` | `approved`, `revoked`, `superseded` |
| `approved` | `sent`, `revoked`, `superseded` |
| `sent` | `viewed`, `accepted`, `declined`, `expired`, `revoked`, `superseded` |
| `viewed` | `accepted`, `declined`, `expired`, `revoked`, `superseded` |
| `accepted` | terminal; controlled change creates a new version |
| `declined`, `expired`, `revoked`, `superseded` | terminal |

### Contract

Source: `src/lib/quotes/workflow.ts:8-18`.

| From | Allowed target states |
|---|---|
| `draft` | `issued`, `revoked`, `superseded` |
| `issued` | `signed`, `declined`, `revoked`, `superseded` |
| `signed`, `declined`, `revoked`, `superseded` | terminal |

Customer and company signatures have separate evidence/document/time fields.
Signed contracts cannot be deleted and immutable fields cannot be edited.

### Change agreement

Source: `src/lib/change-agreements/workflow.ts:1-13` and
`src/payload/collections/ChangeAgreements.ts:1-33`.

| From | Allowed target states |
|---|---|
| `draft` | `approved`, `revoked`, `superseded` |
| `approved` | `sent`, `revoked`, `superseded` |
| `sent` | `viewed`, `accepted`, `declined`, `revoked`, `superseded` |
| `viewed` | `accepted`, `declined`, `revoked`, `superseded` |
| `accepted`, `declined`, `revoked`, `superseded` | terminal |

Approval requires an active admin or trusted approval context and a matching
document hash. Non-draft immutable fields cannot change; accepted agreements
must be retained.

### Price calculation

Source: `src/payload/collections/PriceCalculations.ts:1-37`.

```text
draft | ready | blocked | superseded
```

Records are immutable (`update: false`). Therefore UI must present a new
calculation/version rather than an edit transition. Producer-service rules are
the effective transition policy; F1/F3 must not add direct status mutation.

## 6. Communication baseline

Source: `src/payload/collections/Messages.ts:30-109`.

```text
draft
approved
queued
sent
delivered
failed
attention
cancelled
```

Verified properties:

- status, attachments, provider result and delivery timestamps are
  system-managed;
- idempotency key is required and unique;
- failure text is length-limited and explicitly sanitized;
- AI assistance/model/prompt and human approval evidence are retained.

F0 finding: a single exhaustive `assertMessageTransition` equivalent was not
found. Approval, queue, send, retry and cancel behavior is spread across route
and service handlers. Before one unified composer/inbox can mutate Production,
F3 needs a documented transition/command table and contract tests.

## 7. Customer contract request baseline

Source: `src/payload/collections/CustomerContractRequests.ts:1-137`.

```text
received
admin_review
alternative_requested
follow_up_scheduled
recovered
closed
do_not_contact
```

Customer-submitted evidence is immutable, including source message, request
fingerprint, contract/work state at receipt and timing evidence. The admin
workflow is service-driven rather than represented by one transition table.
`do_not_contact` and cancellation/withdrawal evidence are hard stop inputs to
the case Next Action and communication policy.

## 8. Completion artefacts

### Invoice record

Source: `src/payload/collections/InvoiceRecords.ts:5-28`.

| From | Allowed target states |
|---|---|
| `draft` | `approved`, `cancelled` |
| `approved` | `exported`, `cancelled` |
| `exported` | `sent`, `paid`, `cancelled` |
| `sent` | `paid`, `overdue`, `cancelled` |
| `overdue` | `paid`, `cancelled` |
| `paid`, `cancelled` | terminal |

Amount basis and dates are immutable. `exported/sent/paid/overdue` require an
external accounting reference.

### Warranty

Source: `src/payload/collections/Warranties.ts:5-14`.

```text
active → expired | revoked
expired, revoked → terminal
```

Warranty scope, dates, terms, snapshot and hash are immutable. New warranties
start as active and require approval evidence.

## 9. SEO editorial baseline

Source: `src/lib/blog/transitions.ts:1-52` and
`src/payload/collections/Posts.ts:151-176`.

```text
draft
ai_qa
human_review
rejected
approved
scheduled
published
```

Guarded actions:

| Action | Required current state and evidence |
|---|---|
| `approve` | `ai_qa | human_review | rejected`; quality passed; score ≥75; reviewer name |
| `schedule` | `approved`; valid future publication time |
| `publish` | `approved | scheduled | published`; reviewer name |
| `regenerate` | forbidden only after `published` by this guard; other policies may narrow it |
| `reject` | accepted by this guard for non-published content; route policy must remain authoritative |

Payload `_status` publication visibility remains separate from
`editorialStatus`; public content requires both to be published under the
current editorial policy.

## 10. Operational job baseline

Source: `src/payload/collections/OperationalJobs.ts:4-82`.

```text
pending | running | retry | completed | failed | attention | cancelled
```

Every job has a unique idempotency key, correlation ID, attempts/max attempts,
availability/start/completion times, sanitized last error and reference-only
payload guidance. A central generic transition table and custom-admin
detail/retry/cancel UI were not found. Handler-specific services remain
authoritative until F6.

## 11. Target presentation projection – not new canonical storage

The approved six-stage UI vocabulary is a read-model projection:

```text
inquiry → evidence → commercial → agreement → work → completion
```

It does not replace existing canonical statuses in F1/F2. Initial projection
rules must be deterministic and covered by parity tests:

| Presentation stage | Primary source signals |
|---|---|
| `inquiry` | lead/intake, reply and qualification before a measurement exists |
| `evidence` | measurement/RF required, draft, review-required or blocked |
| `commercial` | approved measurement through quote draft/approval/sent/viewed |
| `agreement` | accepted quote through customer/company contract signatures |
| `work` | WorkOrder creation through completion/documentation |
| `completion` | completion review, invoice, warranty, closure/archive readiness |

`caseState` is separately derived as:

```text
on_track | needs_action | waiting | blocked | completed
```

No stage or case-state value may be stored or edited as a second source of truth
until a separate schema ADR and migration are approved.

## 12. Blocker baseline

Current blocker representations are fragmented:

- `Leads.nextActionBlocker` – one text/code;
- measurement and WorkOrder `blockingReasons` – JSON arrays;
- contract-request/cancellation evidence – structured records;
- failed/attention Messages and OperationalJobs – status-based operational
  blockers;
- case invariants – computed consistency failures.

The target first-class blocker model is `missing`. F2 can initially provide a
read-only normalized projection with source references; creating a new blocker
collection or changing write semantics requires a separate approved schema ADR
and migration plan.

## 13. F0 validation gates

| Gate | Result at this baseline | Required before mutating rollout |
|---|---|---|
| Every `CaseNextActionKind` inventoried | pass | presentation + component test for every value |
| WorkOrder transition table explicit | pass | API/worker parity and exception E2E |
| Quote/contract/change transitions explicit | pass | review/commit and immutable-version E2E |
| Invoice/warranty transitions explicit | pass | completion chain E2E |
| SEO guarded actions explicit | pass | UI/API/cron parity tests |
| Message transition table centralized | fail/partial | command contract and exhaustive tests |
| Customer request transition table centralized | fail/partial | command contract and `do_not_contact` tests |
| Operational job transition table centralized | fail/partial | handler inventory and safe retry/cancel contract |
| First-class blocker model | missing | read projection first; schema decision separately gated |
| Human-readable audit `from → to` | missing | allowlist/redaction projection ADR and tests |
| RF exact-hash commercial bridge | gated | RF Phase E owner approval, implementation and full tests |
| Admin Next Production mutations | gated | module parity, UAT and explicit Production GO |

## Approval boundary

This document completes a static F0 state inventory only. It does not change
any current status, transition, API, Payload hook, feature flag or Production
record. Any divergence discovered during executable tests must be added here as
an evidence-backed amendment before F1 implementation.
