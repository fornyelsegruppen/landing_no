# ONE UI boundary acceptance — local PostgreSQL

## Accepted scope

The exact fixture commit `95be932e4af2e11a3e2a075228447d6dec2e66be`
was reviewed and explicitly approved by CONTROL, then seeded once. It
completed successfully; no retry, partial repair, schema change, provider
call, real-user change, or application restart was performed.

Application source checkpoint: `cf11bfea346d8e87da601ac6c1e283beb73342aa`.
Commercial guard follow-up: `e793eab`.
Independent review accepted the former source checkpoint with no P0/P1;
the guard follow-up is separately submitted for review.

Actual target attestation:

```text
database: seo_automation_browser_20260912
host: 127.0.0.1
port: 55432
role: phase2b_qa
existing active admin actor: 1
synthetic worker: 2 (NULL hash and salt; no session)
```

## Actual read-only results

| Check | Observed result |
| --- | --- |
| Marker leads | 325 |
| Selective leads / only matching action-worker case | 26 / case 26 |
| Anchor case | 1 |
| Anchor messages / quotes / contracts / invoices | 126 each |
| Anchor document files / unique owner pairs | 756 / 756 |
| Related decoy files on selective case | 501 |
| Invoice owners 31 and 32 | Both belong to case 1; media 185 and 191 |
| History traversal | 31 fixed pages; no duplicate or missing file IDs |
| Worker and action filters | Each returns only case 26, filtered total 1 |
| Current working / effective contract | 126 / 1 |
| Global old invoice filename search | Finds `/api/admin/media/185` despite 501 newer decoys |
| Document page 6 | Contains quote, contract draft, and customer-signed rows |
| Page 6 → Next 7 → Previous 6 | Exact same 25 ordered logical document IDs |
| Type filters | All 10 executed; 9 populated, change-agreement empty |
| Existing SEO post IDs | 1, 2, 3, 4 remain present |

The real guarded PostgreSQL loaders were invoked. The commercial guard
also ran read-only using a minimal Payload `findByID` adapter that projects
the selected records from PostgreSQL and normalizes NUMERIC version fields
to Payload's numeric shape. Working quote/contract 126 with expected
version 126 passed. Work-order creation eligibility from effective contract
1 was rejected with the pending working contract 126 reference, preserving
the existing business rule. No mutation endpoint was called.

The first standalone reader import failed before any DB connection because
`server-only` is bundled/aliased by Next rather than installed as a root
package. The checked-in launcher maps only that marker to Next's existing
server-condition empty module. Admin guards and transactions remain real.
A subsequent verification-adapter NUMERIC string mismatch was corrected;
it changed only read-only test normalization, not application or seed data.

## Reproduce the read-only checks

Use the already installed x64 Node runtime from the workspace. From the
repository root:

```text
node --conditions=react-server --import tsx scripts/one-ui-local-boundary-verify.mjs
```

The reader is fixed to the same loopback database, verifies identity first,
uses read-only transactions, and checks existing fixture rows only. It must
not be confused with the separately gated seed script.

## Source tests

- 11 focused source suites: 92 tests passed (registry SQL action parity,
  auth/transaction lifecycle, ownership history, document builder/adapter,
  current selection/integration, question context, case/commercial models).
- Guard and three route suites: 15 tests passed (9 guard, 6 route).
- Full TypeScript check, focused ESLint, and diff checks passed.
- Browser test discovery lists four tests. The old-message test now
  requires page > 1 and first proves the row is absent from page 1.

## Remaining gates — not claimed passed

- Fresh integrated-runtime browser acceptance at 360/375/768/1280 and
  document/history navigation. The SEO runtime owner controls rebuilds and
  restarts; this task has not restarted local3217.
- No PDF bytes were created in this fixture. Exact links and relationships
  are tested; opening/downloading real files is not proven here.
- Change-agreement is an empty branch in the actual local fixture. Its
  populated behavior is covered by the isolated PostgreSQL-compatible SQL
  tests, not by this live fixture.
- No production performance claim, release, deployment, provider delivery,
  legal-signature validity, or full ONE UI production PASS.
