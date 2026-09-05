# Admin Unified F2 — Case 360 read projection

Captured on 2026-09-04 from the deterministic `admin-next-case-fixture` route.
The fixture renders the same `AdminNextCaseWorkspaceView` contract used by the
canonical Admin V2 read adapter; it does not execute sends or mutate customer
data.

## Evidence

- `case-360-1440.png` — desktop, full page
- `case-360-375.png` — mobile, full page
- `case-360-evidence-1440.png` — evidence workspace panel
- `case-360-history-1440.png` — audit-history workspace panel
- `case-360-pagination-1440.png` — exact desktop communication pagination UI
- `case-360-pagination-375.png` — exact mobile communication pagination UI
- `case-360-delivery-details-1440.png` — expanded historical delivery journey
- `case-360-question-focus-1440.png` — exact desktop unresolved-question focus
- `case-360-question-focus-375.png` — exact mobile unresolved-question focus
- `case-360-commercial-versions-1440.png` — expanded quote/contract version chain

The case summary and next action stay visible above a sticky, keyboard-accessible
three-panel switcher. Only one of customer dialogue, evidence, or history is
rendered visibly at a time. Secondary commercial versions, the document
register, and the complete business chronology are native disclosures inside
the customer panel. This replaces the previous all-sections-at-once long page
without removing any record data.

## Visible read parity added

- inbound and outbound message direction, exact body, category, channel,
  delivery state and the exact persistent attachments sent with that message;
- customer-question total and unresolved state;
- the exact unresolved question, received time/channel, related quote or contract
  references, current reply stage and the existing Admin V2 reply-workbench
  target;
- quote and contract versions, supersession reference, signature times and
  document hash;
- localized active quote/contract reference, state and effective/working role
  remain visible even while the full version chain is collapsed;
- every document returned by the current Admin V2 case read model;
- business chronology separated from the technical audit trail;
- links back to the exact working Admin V2 case/message or whitelisted PDF/media
  endpoint.

## Bounded communication history

The customer dialogue initially reads the newest 25 canonical messages and
shows the exact loaded/total count. When older records exist, the UI exposes an
explicit localized `Show older messages (N)` control. Each activation reads the
next 25 records through the authenticated, private, no-store Admin Next API.
The continuation cursor combines `createdAt` and message ID, so a newly arrived
message cannot shift or duplicate the older pages already being traversed.
Cancelled AI drafts that were never customer communication are excluded; all
other inbound, outbound, queued, failed and draft messages remain visible.
Each outbound message has a collapsed delivery disclosure. When expanded it
shows the exact historical recipient if the send command persisted one,
provider, approval/queue/send/delivery timestamps, sanitized delivery failure
and any recorded manual-contact recovery. It never substitutes the lead's
current email for a missing historical recipient.

## Deliberate boundary

Admin Next Preview remains read-only and fail-closed. Existing Admin V2 editors,
question workbench, resend/recovery controls, contract-request review, change
agreement controls and signing actions remain the command surface. Production
and shared Preview were not changed by this capture.

The legacy Admin V2 general case read still loads at most 100 messages, but the
Admin Next customer dialogue no longer inherits that presentation cap. Its
dedicated canonical cursor reader can traverse the complete communication
history in bounded pages. Customer-question status continues to use its
separate exact query.
