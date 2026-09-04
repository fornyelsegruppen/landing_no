# Admin Unified F2 — Case 360 read projection

Captured on 2026-09-04 from the deterministic `admin-next-case-fixture` route.
The fixture renders the same `AdminNextCaseWorkspaceView` contract used by the
canonical Admin V2 read adapter; it does not execute sends or mutate customer
data.

## Evidence

- `case-360-1440.png` — desktop, full page
- `case-360-375.png` — mobile, full page

## Visible read parity added

- inbound and outbound message direction, exact body, category, channel and
  delivery state;
- customer-question total and unresolved state;
- quote and contract versions, supersession reference, signature times and
  document hash;
- every document returned by the current Admin V2 case read model;
- business chronology separated from the technical audit trail;
- links back to the exact working Admin V2 case/message or whitelisted PDF/media
  endpoint.

## Deliberate boundary

Admin Next Preview remains read-only and fail-closed. Existing Admin V2 editors,
question workbench, resend/recovery controls, contract-request review, change
agreement controls and signing actions remain the command surface. Production
and shared Preview were not changed by this capture.

The current Admin V2 general case read loads at most 100 messages. Customer
question threads use their separate exact query. A claim of unlimited full
communication history therefore still requires a paginated canonical read
contract and acceptance approval.
