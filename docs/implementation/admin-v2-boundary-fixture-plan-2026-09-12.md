# Admin-v2 boundary fixture plan (local3217)

Status: discovery/manifest only. No database writes were performed for this
plan.

## Fixed local harness and target

The existing isolated browser harness is:

`C:/Users/Fornyelsegruppen/.codex/worktrees/seo-automation-core-414f65f-20260912/scripts/seo-local-browser.mjs`

Its runbook is
`docs/operations/seo-local-browser-2026-09-12.md` in that same worktree. It
creates the schema and starts the disposable browser candidate on
`http://localhost:3217`; the local server is already running as session/PID
`78367`, so a fixture operator must not restart it.

The only permitted database target is:

```text
database: seo_automation_browser_20260912
role: phase2b_qa
host: 127.0.0.1
port: 55432
url: postgresql://phase2b_qa@127.0.0.1:55432/seo_automation_browser_20260912
```

Before any future seed, attest the target in a read-only transaction with a
five-second statement/lock timeout and `ROLLBACK`, checking
`current_database()`, `inet_server_addr()`, and `inet_server_port()`. Also
confirm that the harness worktree has no `.env*` file (other than
`.env.example`), that `CANDIDATE_QA_SEED_ALLOWED` is the explicit local-only
write gate if a new seed command is added, and that no provider credentials are
inherited. A mismatch is a hard stop; do not “repair” the target by creating
or dropping databases. The already observed probe returned the expected
database, loopback address, and port.

The harness's existing `seed` flow is the only approved schema/bootstrap path.
Do not point it at this worktree's default SQLite database, a staging/Preview
URL, or production. The final fixture record must retain the source SHA,
server process/session identity, and the exact target attestation output.

## Deterministic fixture manifest

Use an unambiguous marker prefix in every synthetic value:
`boundary-20260912-`. Every reference, email, idempotency key, filename and
text body must use `example.invalid` or a loopback URL. Abort if the marker is
already present; do not update or delete pre-existing rows. Capture generated
IDs in a manifest after creation instead of assuming a numeric sequence.

### Leads: 325 rows

Create 325 leads with unique marker emails and references in deterministic
creation order. Use 305 `recordState=active`, 15 `recordState=archived`, and 5
`recordState=trashed`, so the active registry has more than 300 rows while
archive/trash filters are also non-empty. Give all rows valid required fields
(`name`, `address`, `postal`, `inquiryType`, `language`, `caseRevision`, and
`nextActionOwner`); use `takvask`, `no`, `caseRevision=1`, and
`nextActionOwner=administrator` unless a scenario below requires otherwise.
The anchor lead is the first active row and is identified by
`boundary-20260912-anchor@example.invalid`.

Expected checks: active `/admin-v2/cases` reports 305 rows and 13 pages at 25
rows per page; archived and trashed views remain reachable without leaking
active rows. A page-two request must include the same filters in its URL.

### Anchor relation graph

Attach all deep-history records to the anchor lead. Create the minimum graph
needed by the existing Payload required relations:

- one draft roof measurement and one draft price calculation;
- one quote version with valid required snapshot/hash, terms and dates;
- two contract rows for that quote, versions 1 and 2, with distinct immutable
  references and hashes. Version 2 supersedes version 1. If signed rows are
  needed for the read-model scenario, create both through the verified
  signature context (never by weakening a hook); retain customer/company
  signature evidence and the two distinct document links;
- one work order linked to the quote and contract, with valid summary/hash and
  `status=unassigned`;
- optional one customer-contract-request linked to the same lead/quote/
  contract/work order and a source message, using a deterministic active status.

The two contract versions deliberately test that a relation owner pair is
treated as two exact contract IDs, rather than one quote/contract “current
row”.

### Messages: 501 rows (at least 126 required)

Create 501 messages for the anchor lead, ordered oldest to newest, using
required `lead`, `direction`, `category`, `channel`, `subject`, `bodyText`,
`status`, and unique `idempotencyKey` fields. Use `status=delivered`,
`channel=email`, and marker subjects. Include one inbound
`category=customer_question` and one outbound draft reply linked by
`replyToMessage`; keep the remaining rows as delivered outbound follow-ups.
The oldest row must have a unique marker such as
`boundary-20260912-oldest-message`, and at least one row must be positioned
past history page 5. This simultaneously proves that >125 history rows and
relations with IDs greater than 500 are real, not just synthetic labels.

Expected checks: page 1 and a later `messagePage` show different marker rows;
the oldest deep-link opens the correct disclosure; no 100-row query can make
the old marker disappear.

### Private media: exact owner-pair stress set

`private-media` rejects direct collection creates by design, so future fixture
work must use the approved local-only metadata/storage path (or a transaction-
scoped SQL insert after schema inspection), never change collection access.
The collection has no `version` column; do not invent one. Create at least 101
anchor media metadata rows, with deterministic `filename`, `classification`,
`ownerType`, `ownerId`, and safe local `alt` values. Use several exact owner
pairs represented by the anchor graph:

```text
(lead, anchorLeadId)
(quote, quoteV1Id), (quote, quoteV2Id)
(contract, contractV1Id), (contract, contractV2Id)
(work-order, workOrderId), (work, workOrderId)
```

Add decoys with the same `ownerType` but another ID and the same `ownerId` but
another `ownerType`. Include marker files older than the first 100 rows. This
proves that the history query uses exact `(ownerType, ownerId)` pairs and that
older media remains addressable; it must not use independent `ownerType IN` and
`ownerId IN` predicates, which create a cross-product leak.

### Optional >500 relation expansion

If the local browser assertion needs a relation collection with more than 500
rows independently of messages, add 501 deterministic non-anchor rows only
after the required graph exists (for example additional draft quote/measurement
chains with all required references). Record every generated ID and keep them
outside the anchor's owner pairs. Do not fake a `version` field on
`roof-measurements`: discovery confirmed that table has no `version` column.
This expansion is optional because the 501-message history already exercises
IDs and pagination beyond 500; it must not be used to justify an unbounded
read in application code.

## Current cap risks and fallacies to assert

- The legacy document center composes multiple collections and currently uses
  `limit: 500` plus `pagination: false` per source. It cannot be safely paged
  by slicing its composed array; it remains an explicit unresolved item for
  the document read-model owner.
- The case list's related-record query has a global fixed `limit: 100` for the
  25 leads on the current page. Five or more related rows per early lead can
  starve later lead IDs, so a global limit is not equivalent to a per-lead
  limit. The fixture should include at least four related rows for several
  leads if this behavior is audited.
- Case `action` and `worker` are derived after the lead page query. Therefore a
  reported `totalDocs` can describe pre-filter leads while rendered items are
  post-filter; tests must not claim that those totals prove all derived-action
  matches are reachable.
- Contract/media history must match exact owner pairs. A query that combines
  owner types and IDs independently can return another case's document and
  falsely pass a count-only test.
- Two contract versions for one quote must remain distinct immutable rows. A
  “latest only” fixture or a single signed row cannot detect accidental
  collapse of version history.

## Bounded execution order (future, not performed here)

1. Attest the fixed database and existing loopback process as above.
2. Verify marker absence with read-only counts; stop on any collision.
3. Create the anchor graph, then deterministic bulk rows in bounded batches
   (for example 25–50 writes per batch), recording IDs after each batch.
4. Run read-only Payload/SQL counts and URL/browser checks against port 3217;
   never use a count-only result as proof of owner-pair correctness.
5. Persist only the synthetic manifest, attestation, process identity, test
   URLs, and source SHA in the local QA handoff. No production or deployment
   artifact may reference this database or fixture.
