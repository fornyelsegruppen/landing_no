# Documents register: bounded read model plan

Status: plan only, for CONTROL review before implementation. No application,
schema, migration, flag or database-content changes in this planning step.

## Verified baseline

- `loadAdminDocuments` reads ten collections with `limit: 500` and
  `pagination: false`, then resolves relations and filters in memory. The page
  calls it twice, once to discover statuses and once for displayed documents.
- The logical register has ten document types (`all` is a filter only). A contract with both signed
  files contributes two rows, even when both refer to the same media ID.
- Global search currently matches customer name, displayed reference,
  displayed filename or decimal lead ID by case-insensitive substring. Type and
  status match exactly. Archived/trashed leads are not excluded.
- Ordering currently uses source `createdAt` descending, without a stable tie
  breaker. Contracts use contract creation time, not signature/media time.
- Read-only inspection of the existing local target confirmed database
  `seo_automation_browser_20260912`, address `127.0.0.1/32`, port `55432`.
  The relation columns below exist. `roof_measurements.version` does not exist;
  its optional DTO version must remain null/undefined, not become an SQL column.
- Installed Payload Postgres adapter exposes its existing `pool` and identifies
  itself as `postgres`; no second application connection string is needed.

## Proposed smallest implementation

Use a server-only Postgres SELECT adapter on the existing Payload pool. Keep the
current `requireAdminUser()` entry guard and require the same active-admin
decision at the public loader boundary before acquiring a connection. Do not
export a callable SQL reader to client components or add a public HTTP endpoint.
Private bytes continue through the guarded `/api/admin/media/:id` handler.

Project the existing ten logical branches into a common DTO. Resolve all
relations by indexed joins/EXISTS inside SQL, never by preloading IDs from the
first N leads, quotes, orders or media records.

| Type | Row source and relation path | File rule |
| --- | --- | --- |
| quote | quotes -> leads | Existing quote PDF endpoint |
| contract_draft | contracts -> quotes -> leads | Only when neither signed-media join exists; quote PDF endpoint |
| customer_signed | contracts -> quotes -> leads; signed_document_id -> private_media | Existing media endpoint |
| final_contract | contracts -> quotes -> leads; company_signed_document_id -> private_media | Separate row; existing media endpoint |
| change_agreement | change_agreements -> work_orders -> leads; accepted_document_id -> private_media | Requires media join |
| measurement | roof_measurements -> leads; map_image_id -> private_media | Requires media join; version NULL |
| work_documentation | private_media -> work_orders -> leads | owner_type is work-order/work, validated numeric owner_id |
| invoice_draft | invoice_records -> leads; document_id -> private_media | Requires media join |
| official_invoice | official_invoices -> leads; original_document_id -> private_media | Requires media join; invoice_number before reference |
| warranty | warranties -> leads; document_id -> private_media | Requires media join |

Use left joins for customer display where appropriate to retain the `#leadId`
fallback; require the quote/order relation when it establishes case ownership.
Preserve current filename/reference fallbacks, including empty-string handling.
For owner_id, use a guarded numeric comparison so malformed values cannot raise
an integer-cast error and numeric legacy values are explicitly covered in tests.

Each branch applies visibility, type, status, search and cursor predicates BEFORE
`ORDER BY ... LIMIT 26`. A literal allowlisted type rank is the stable type key.
Merge with `UNION ALL`; order the at-most-260 candidates by
`created_at DESC, type_rank ASC, source_id DESC`; return 26 and display 25.
This is bounded page-candidate merging, not slicing a capped complete register.
Skip irrelevant branches for a selected type. No OFFSET, recursive page walk,
unbounded ID array or find-all API call.

Generate values using parameters only. Table names, SQL fragments, type ranks,
sort order and direction come from fixed source definitions, never user strings.
Use explicit common casts for enum status, numeric IDs/version and timestamps.
Cursor comparison uses exactly the same timestamp precision and three keys as
the ordering. Three of the ten branches come from contracts: draft, customer
signed and final signed.

## Filter and navigation contract

- Trim query once, cap at the existing admin search convention of 80 characters,
  then compare against the four displayed fields. Escape `%`, `_` and backslash
  so search punctuation is literal. Use a documented Unicode case-folding
  contract and test Norwegian/Lithuanian diacritics against the former JS
  `toLocaleLowerCase("nb-NO")`; database collation differences are a release risk.
- Type/status filters stay global and exact. Resolve a global distinct status
  facet in SQL or use the finite collection-enum union; never load all documents
  to obtain it. Prefer the SQL facet to preserve only-in-use status options.
  Facet results are bounded by the schema enum cardinality, but DB scan cost is
  not constant. A failed facet query shows unavailable state, not an empty list.
- Cursor contains format version, direction, boundary keys and normalized-filter
  fingerprint; bound decoded size and reject invalid values. Changing a filter
  clears cursor state. Cursor grants no authority. Do not treat it as auth.
- Next uses the last displayed key; previous uses the first key with inverse
  ordering, then reverses the bounded returned page. Directional 26th row proves
  more results; a bounded opposite-direction EXISTS query verifies the other
  navigation control when needed. No unverified total/page-count arithmetic.
- Show `25 documents on this page` and Previous/Next. Omit a global total in the
  first slice. Do not label branch counts, 500 caps or source records as a total
  of logical document rows. Empty pages still offer a return-to-start path.
- Keep the existing customer grouping for the current page only. A case can span
  pages; make that clear in the page-level count. If strict global row order is
  required visually, render consecutive customer groups instead of regrouping
  non-adjacent rows. Filtering and cursor boundaries always use the flat order.

## Actual limits and acceptance gates

- No migration is necessary for correctness. Existing FK/created_at indexes help,
  but substring filtering and a distinct facet may scan many database rows.
  Bounded returned rows are NOT a claim of bounded scan cost. Use a read-only
  transaction with statement timeout; inspect EXPLAIN on the local fixture.
  Timeout/failure must be visible and must not fall back to the old capped list.
- Keyset navigation avoids offset movement from newer inserts. Mutable source
  status, customer names, signing transitions or backdated inserts still change
  membership between requests; this is a live register, not an export snapshot.
  No historical snapshot guarantee is made without separate snapshot storage.
- Direct SQL bypasses Payload collection hooks and field access. Current access
  is admin-only; DTO must select only current document metadata, never storage
  URLs, tokens, message bodies or arbitrary columns. Future per-admin/tenant
  restrictions would need matching SQL predicates and regression coverage.
- Postgres is verified locally. SQLite is also configured in the application;
  it requires an equivalent explicit dialect adapter and fixture proof, or a
  clearly reported unsupported-database gate. Do not silently use old capped
  aggregation on SQLite. Production SQL dialect support is not claimed here.
- Stable timestamp ties, two rows from one contract, missing media/relations,
  literal-search punctuation, locale folding, previous/next round trips,
  insertion between pages, exact file links and denied access are acceptance
  cases. Use only the fixed local3217 database workflow for populated QA.

## Existing source package is not full-history PASS

- Case messages have independent server pages, but current process/next-action
  derivation still uses the first 100 source rows. An older unresolved message,
  effective signed contract or active order can fall outside that set.
- Case media pagination derives owner IDs from that bounded current-state DTO.
  It therefore cannot promise all case documents. Older measurements, orders,
  invoices and warranties may be missing even within the first 100 because the
  owner helper uses only the chosen current entity. Quote/contract versions also
  retain a 100-row upstream cap. Messages and attachments are different scopes.
- Case-list related rows are capped globally at 100 across up to 25/50 leads.
  One busy case can hide another case's latest related state. Action and worker
  filters then run after server pagination, so totals describe the prefiltered
  lead set. Reference lookup also stops at 50 matches per source collection.
- These are separate open correctness gates. Proposed follow-up: direct
  per-case relational predicates for history ownership, targeted current-state
  queries rather than truncating before state selection, and server-level
  action/worker filtering with count parity. Do not mark them closed merely
  because page navigation and unit tests pass.
- The current older-message browser test first requires its target to be
  attached on page one, then optionally navigates to a later message page.
  That setup cannot prove a target absent from page one is reachable. The
  local >100 fixture must assert initial absence, navigate to its recorded
  page, then verify the exact target; the existing test needs that correction
  before it can be used as full-history acceptance evidence.
