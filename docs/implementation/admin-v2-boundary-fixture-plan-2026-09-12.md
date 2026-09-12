# Admin-v2 boundary fixture plan (local3217)

Status: discovery/manifest only. No database writes were performed for this
plan.

## Fixed local harness and target

The existing isolated browser harness is:

`C:/Users/Fornyelsegruppen/.codex/worktrees/seo-automation-core-414f65f-20260912/scripts/seo-local-browser.mjs`

Its runbook is
`docs/operations/seo-local-browser-2026-09-12.md` in that same worktree. It
creates the schema and starts the disposable browser candidate on
`http://localhost:3217`. CONTROL recorded historical tool session `78367`;
that is not a PID or proof of the currently running process. Do not restart
the server based on that session reference. If process identity is needed,
attest it independently from the current local process table.

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
`.env.example`) and that no provider credentials are inherited. The fixed
database target, marker-collision check, and harness environment sanitization
are the safety gates; this plan does not invent an additional seed approval
variable. A mismatch is a hard stop; do not “repair” the target by creating
or dropping databases. The already observed probe returned the expected
database, loopback address, and port.

The harness's existing `seed` flow is the only approved schema/bootstrap path.
Do not point it at this worktree's default SQLite database, a staging/Preview
URL, or production. The final fixture record must retain the source SHA,
server process/session identity, and the exact target attestation output.

## Deterministic fixture manifest

Use an unambiguous marker prefix in every synthetic value:
`boundary-20260912-`. Synthetic email addresses must use `example.invalid` and
synthetic URLs must stay on loopback; ordinary names, references, idempotency
keys and body text only need the marker prefix. Abort if the marker is already
present; do not update or delete pre-existing rows. Capture generated IDs in a
manifest after creation instead of assuming a numeric sequence.

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

Expected checks (relative to the read-only baseline count captured immediately
before seeding): the active `/admin-v2/cases` count increases by 305 and spans
13 pages at 25 rows per page; archive and trash deltas are 15 and 5. Existing
rows may already be present in the isolated database, so never assert absolute
counts without subtracting that baseline. A page-two request must include the
same filters in its URL.

### Anchor relation graph and 126 owner versions

Attach all deep-history records to the anchor lead. Create exactly 126 rows in
each of these owner-bearing histories, with references/IDs recorded in the
manifest and timestamps ordered oldest to newest:

- `roof-measurements`: 126 valid draft rows, each with the required address,
  license/source, geometry, hashes and calculation fields. The SQL table has
  no `version` column, so use distinct marker references and relation IDs;
  never invent or insert a version column.
- `price-calculations`: 126 rows, each linked to its matching measurement and
  one approved price rule, with valid snapshots, hashes and amounts.
- `quotes`: 126 immutable draft/issued rows, each linked to the matching
  measurement and price calculation, with distinct marker references,
  snapshots, hashes, terms and dates. Quote 126 is the newest.
- `contracts`: 126 immutable rows, one per quote, with distinct references,
  hashes and version numbers 1–126. Contract 126 is the current signed row;
  create the signed state and evidence through the verified signature context,
  not by weakening a hook. Contract 1 is also a signed older row (and may be
  marked superseded only through the supported workflow), so two signed rows
  exist for the owner-pair regression and both IDs remain discoverable.
- `work-orders`: 126 historical orders, each linked to its matching quote and
  contract, with valid summary/hash fields and deterministic statuses.
- `invoice-records` and `warranties`: 126 rows each, linked one-to-one to the
  matching work orders and anchor lead, with all required snapshots, hashes,
  terms, dates and approval fields.
- `official-invoices`: 126 rows linked one-to-one to the invoice records, with
  unique original hashes and valid original-document references. Reusing an
  anchor media row is acceptable; do not create a second unbounded media set.

Create one customer-contract-request linked to the newest graph row and one
source message if that scenario is needed. The 126-row sets are required: they
exercise the existing `limit:100` relation reads and prevent a “two rows only”
fixture from hiding owner-history truncation. The exact owner-pair set must
include all 126 quote IDs, all 126 contract IDs, and all 126 measurement/order/
invoice/warranty IDs that the read model derives.

### Messages: 126 rows minimum

Create exactly 126 messages for the anchor lead, ordered oldest to newest,
using required `lead`, `direction`, `category`, `channel`, `subject`,
`bodyText`, `status`, and unique `idempotencyKey` fields. Use
`status=delivered`, `channel=email`, and marker subjects. Include one inbound
`category=customer_question` and one outbound draft reply linked by
`replyToMessage`; keep the remaining rows as delivered outbound follow-ups.
The oldest row must have a unique marker such as
`boundary-20260912-oldest-message`, and at least one row must be positioned
past history page 5. This tests history pagination only; message IDs above 500
are not evidence of document-owner coverage.

Expected checks: page 1 and a later `messagePage` show different marker rows;
the oldest deep-link opens the correct disclosure; no 100-row query can make
the old marker disappear.

### Private media: exact owner-pair stress set

`private-media` rejects direct collection creates by design, so future fixture
work must use the approved local-only metadata/storage path (or a transaction-
scoped SQL insert after schema inspection), never change collection access.
The collection has no `version` column; do not invent one. Create exactly 101
anchor media metadata rows, with deterministic `filename`, `classification`,
`ownerType`, `ownerId`, and safe local `alt` values. Use several exact owner
pairs represented by the anchor graph:

```text
(lead, anchorLeadId)
(quote, all126QuoteIds)
(contract, all126ContractIds)
(work-order, workOrderId), (work, workOrderId)
```

Add exactly 501 media decoys in the actual `private-media` source queried by
the document center: exactly 500 `ownerType=work-order` rows with distinct
`ownerId=boundary-20260912-decoy-work-order-001` through `-500`, plus one
`ownerType=work` row reusing decoy owner ID `-500`. These pairs are all outside
the anchor owner-pair set and use marker filenames. Create at least one oldest
anchor file before those decoys in creation order, so a newest-first 500-row
query can omit it. This is mandatory:
501 messages or an ID greater than 500 does not exercise the document center's
old-500 source cap. The 501 decoys must be present in the queried source so an
old anchor document can be omitted by the current `limit:500,
pagination:false` path. Also add same-type/different-ID and same-ID/
different-type decoys to prove exact owner-pair matching; independent `IN`
predicates create a cross-product leak.

The 501 decoys may point at a non-existent owner because the metadata table has
no relation foreign key; if a valid decoy work order is used, keep it outside
the anchor graph and record it. The exact bounded media total is 602 (101
anchor rows + 501 source decoys), excluding any pre-existing baseline.

## Current cap risks and fallacies to assert

- The legacy document center composes multiple collections and currently uses
  `limit: 500` plus `pagination: false` per source. It cannot be safely paged
  by slicing its composed array; it remains an explicit unresolved item for
  the document read-model owner. With 501 newer source decoys and an older
  anchor file, the expected current-code evidence is a missing oldest anchor
  document (not a blanket PASS); capture the omitted marker and source count.
- The case list's related-record query has a global fixed `limit: 100` for the
  25 leads on the current page. Five or more related rows per early lead can
  starve later lead IDs, so a global limit is not equivalent to a per-lead
  limit. The 126-row anchor histories should produce explicit missing oldest
  measurement/quote/order/invoice/warranty markers under current code; capture
  those omissions as expected failure evidence.
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
