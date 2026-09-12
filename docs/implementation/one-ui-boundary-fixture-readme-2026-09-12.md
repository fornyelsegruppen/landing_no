# ONE UI local boundary fixture

Status: source prepared; seed has not run. CONTROL review of the exact commit
is required before invoking seed. This does not restart or rebuild local3217.

## Exact target and safety

- Script: `scripts/one-ui-local-boundary-fixture.mjs`.
- PostgreSQL: database `seo_automation_browser_20260912`, role `phase2b_qa`,
  host `127.0.0.1`, port `55432` only.
- Browser: `http://127.0.0.1:3217`; the separately frozen SEO runtime and its
  blog fixtures must not be changed by this script.
- Default/`manifest` mode never opens a database connection.
- Explicit `seed` requires `ONE_UI_BOUNDARY_FIXTURE_ACTOR`, identifying an
  existing active local admin. It refuses a different DATABASE_URL and
  inherited provider credentials, attests actual database/host/port/role,
  checks schema, and refuses marker collisions.
- A transaction-scoped advisory lock serializes this fixture's marker check
  and insertion. Failed runs roll back. There is no delete, cleanup, schema
  push, migration, Payload hook, HTTP request, or provider call.
- The only new user is the explicitly CONTROL-approved synthetic worker
  `boundary-20260912-worker@example.invalid`, with NULL salt/hash and no
  password, token, or session. Existing users and roles are never modified.
- Document relationship UPDATEs target IDs returned by inserts in the same
  transaction; no pre-existing entity is updated.

## Bounded synthetic data

- 325 leads: 305 active, 15 archived, 5 trashed.
- First 26 names contain `selective`; lead ordinal 26 is the only one with
  the synthetic worker and an `unassigned` work order.
- Anchor lead ordinal 1 has 126 versions of each related owner type, plus
  126 delivered history messages. The selective case has one additional
  measurement/price/quote/contract/work/invoice/warranty chain.
- 756 anchor files: one per version of each of six ownership types. All
  anchor files are older than 501 actual private-media decoy rows associated
  with the selective case's real work-order ID, so the decoys participate in
  document relationship queries too.
- Invoice owner version ordinals 31 and 32 belong to the same anchor lead;
  their actual database IDs and media IDs are printed after seed.
- 126 official invoice records and 126 contract requests belong to the
  anchor case. These are marked QA data, not evidence of legal signatures,
  real delivery, or invoice validity.
- The oldest anchor contract has synthetic signed/company-signed timestamps
  and status; newer issued versions must not hide its effective role.
- Output includes anchor/selective/worker IDs, invoice owner/media IDs,
  oldest message ID with page 6, and a configured document link/name.

## Schema observation

Early local read-only discovery found no `roof_measurements.version` column.
A later probe of the same fixed database found that column required, with
no default. The fixture explicitly checks this capability and supplies a
version when present; it never adds/removes the column. It also supplies
required `work_orders.contract_document_hash` and
`customer_contract_requests.received_at`. This observation is not evidence
of the production schema. The document register intentionally does not
depend on measurement version availability.

## Verification and remaining gate

Before seed: syntax check, two offline guard tests, ESLint, complete script
review, exact commit handoff to CONTROL. Use the x64 Node runtime already
identified for this workspace (the default ARM64 runtime cannot load the
installed test runner binding).

After accepted seed: attest marker counts and exact relationships read-only;
verify worker/action filtering, old invoice owners, document keyset
Next/Previous, and off-page history. The current app source must be rebuilt
and frozen by the runtime owner before browser acceptance of the new UI.
Test discovery (`--list`) alone is not browser acceptance.
