# FP1 UI + Roof Fusion integration gate — 2026-09-01

## Decision

The reviewed UI and Roof Fusion milestone set is **IMPLEMENTED** and
`READY_FOR_PR` against the protected FP0 integration branch. FP1 and FP2 remain
`NOT_PASS`; this package does not authorize deployment, Production activation,
database mutation, customer communication, or the Case 13 P1 hotfix.

PR #2 is open. Merge remains withheld until the exact post-portability-fix SHA
passes the protected Linux CI gate.

## Exact integration boundary

- Target branch: `codex/full-production-integration`
- Target baseline SHA: `450ad8a0f774e903b371ea6e4f26bf9459af6445`
- Baseline tag: `full-production-fp0-baseline-20260901`
- Working branch: `codex/fp1-ui-rf-contract-integration-20260901`
- Assembled milestone SHA before this report:
  `fb0160188fbb7440a2609ef0656345bb19d17fbe`

Roof Fusion source milestones:

- `e753423db1d5aef3b680b3221f03031ccc406c99`
- `8e90e29feebf0efbe6a90486e8818dbaf3c64160`
- `eee822333192fff52eeb9df2e0d937d6e6c5a009`
- `6a024b1f9ede25832dde8ed03539e7d937469e82`
- `509fbf26360f585c7399ad678deadbff60f9ad01`

UI source milestones:

- `ac893cc`
- `22056d5`
- `41bc64d`
- `96207ff51b33b9d82fa86189b699426d9e238f99`
- `32d78da575546e872ad01d33be83f6a21df05169`
- `f06aaa03154fbd75d88256d404df21f9fcca9c49`
- `863affeec3fa26083c9b0071a8c7a05ce4cd30e7`

All twelve milestones replayed without conflict. The approved graphite/navy +
amber Dark Design Lock, R4 measurement drawer and four-state worker visit flow
remain unchanged.

## Cross-platform CI incident and remediation

The first Linux CI attempt exposed ICU/OS-dependent `localeCompare` ordering in
canonical RF hash paths. Windows evidence was green, but Ubuntu produced six
golden/hash failures across four RF test files. The PR remained unmerged.

- RF source fix: `7909657c8bf114857e9287a2e1f16e62e8bc3298`;
- integrated fix: `2fbcf0b`;
- shared canonicalization now uses locale-independent UTF-16 code-unit ordering,
  Unicode NFC, LF line endings and recursive `undefined` pruning;
- regression coverage locks LF/CRLF, Unicode, locale independence and optional
  field boundaries to one canonical golden set;
- no OS-specific golden alternatives were accepted.

## Contract result

The I1 technical boundary is accepted:

- full `roof-snapshot.v1` and evidence reads are administrator-only;
- workers consume only `approved-roof-renderer-envelope.v1`;
- calculation can produce only preliminary/fused-estimate state;
- administrator review owns hash/revision-bound verified promotion;
- approval is separate and cannot silently promote measurement class;
- calculate/review/correct/approve use append-only repository and command
  contracts with revision, hash, idempotency, audit and stable error semantics;
- no persistence adapter, API route or Production flag is enabled by this PR.

## Local evidence

- production dependency audit at `high`: PASS (six transitive moderate
  development-tool findings remain upstream with no available fix);
- TypeScript: PASS;
- ESLint: PASS;
- unit/API: 245/245 files, 1098/1098 tests PASS;
- migration up/down: 21/21 files, 39/39 tests PASS;
- generated Payload type parity: PASS;
- diff check: PASS;
- worktree: clean before this report.

Post-portability-fix evidence:

- RF source worktree: 233/233 files, 1059/1059 tests PASS;
- integration worktree focused RF: 8/8 files, 51/51 tests PASS;
- integration worktree TypeScript: PASS;
- integration worktree targeted ESLint: PASS;
- exact post-fix Linux CI: pending at the time of this update.

The protected target branch must run the full PostgreSQL build, authenticated
Playwright and backup/restore quality gate on the final PR SHA before merge.

## Remaining FP1/FP2 gates

- Add the shared `roofFusionV1` feature/capability wiring without allowing the
  legacy measurement flags to activate Roof Fusion writes.
- Implement the Production append-only repository/atomic command-ledger adapter
  and authorized internal/approved-renderer read adapters behind the accepted
  interfaces.
- Add cross-case authorization characterization and authenticated Preview matrix
  coverage for canonical Case, Roof and Visit adapters.
- Replace fixture-only UI adapters only after parity evidence is green; keep
  legacy fallbacks and fail-closed Preview behavior until then.
- Produce exact-SHA immutable Preview and visual/current-function smoke evidence.
