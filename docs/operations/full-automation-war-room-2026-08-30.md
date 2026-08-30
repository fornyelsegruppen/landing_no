# Full automation war room — 2026-08-30

Status: **ACTIVE — RELEASE CANDIDATE HARDENING**
Release commander: project owner + root Codex agent
Production mutation: **NOT AUTHORIZED** until a separate owner `PRODUCTION GO`

## Objective

Reach a defensible `GO_FULL_AUTOMATION` decision through an exact-SHA release,
controlled Production activation, 20–30 real-case evidence and three physical
roof-measurement comparisons. Synthetic tests accelerate technical verification
but do not replace the real pilot.

## Baseline

- Working branch and origin: `codex/master-platform-implementation`
- Baseline SHA: `18b0ad684dc0e2c17c7cdcf0760be099c5ece1b3`
- Exact-SHA GitHub Quality Gate: `33303957255` — PASS
- Current Preview: `dpl_8vUsAtC7vEqsBarhTVy5nBRUd96t` — READY, exact SHA,
  but `gitDirty=1`; it must not be promoted as the final release artifact.
- Current Production: `dpl_CvS7U3tgY16XmLss8aAciiKtZzK5` — unchanged,
  commit `c5ecf4bae7cbd166b4579b265c7964744574050a`.
- No dependency or migration delta exists between current Production and the
  baseline release candidate.

## Non-negotiable safety rules

1. Production deploy, environment, feature flag, database and Blob mutations
   require a separate owner GO at the relevant gate.
2. Production backup precedes deploy. Restore verification uses only an isolated
   temporary branch; Production data and Blob objects remain read-only.
3. No real customer recipient is used in synthetic UAT.
4. `CRON_SECRET` is not added until due-purge and pending/retry/running job
   inventories are reviewed and accepted.
5. `AUTOMATION_EMERGENCY_PAUSE=true` and new automation flags remain false at
   the initial deploy.
6. Activation is one wave at a time, with a verified rollback before the next
   wave.
7. Pricing, contracts, payment reminders and publication retain human approval
   gates even after technical automation is active.
8. A completion confirmation is always created after approved completion. A
   commercial warranty is created only when applicable and when an administrator
   selects an owner-approved, service-specific warranty package. Generic
   automatic warranty creation is prohibited.

## Workstreams

- A — contract, signature and work-order invariant hardening.
- B — release infrastructure, restore/Blob, environment, queue and rollback
  evidence.
- C — exact-SHA responsive, commercial, worker, reminder and SEO UAT matrix.
- Root — integration, full test suite, clean Preview, GO/NO-GO decision package
  and owner coordination.

## STOP conditions

Stop the affected wave immediately on any unresolved P0/P1, unexpected real
recipient, duplicate send, unauthorized cron success, due-purge mismatch,
signature/document inconsistency, DB/Blob parity failure, unexplained HTTP 5xx,
or rollback failure.

## Release gates

- [x] Signature and work-order invariants hardened and regression-tested.
- [x] Full local unit, migration-test, typecheck and lint gates pass.
- [ ] Clean CI migration/bootstrap and production-build gates pass.
- [ ] Clean exact-SHA Linux Quality Gate passes.
- [ ] Clean immutable Preview is READY.
- [ ] Exact-Preview owner UAT passes at 360/375/768/desktop.
- [ ] Fresh Production snapshot, isolated restore/parity and private Blob proof pass.
- [ ] Production config, queue, provider, monitoring and rollback snapshots pass.
- [ ] Owner issues a separate `PRODUCTION GO`.
- [ ] Controlled deploy and post-deploy smoke pass.
- [ ] PROD-8.4 reminders and SEO waves pass separately.
- [ ] PROD-8.5 evidence covers 20–30 real cases and three physical roof checks.
- [ ] Owner issues a separate `GO_FULL_AUTOMATION`.

## Owner decisions

- 2026-08-30 — Warranty policy approved: completion confirmation always;
  warranty only when applicable and explicitly selected from a separately
  approved service-specific package. This replaces any acceptance wording that
  requires an automatic generic warranty for every completed case.

## Restore and private Blob rehearsal — 2026-08-30 14:18–14:28 EEST

- Temporary Neon branch: `br-round-silence-as5727lk`
  (`warroom-restore-20260830-1420`), parent Production
  `br-tiny-sea-asltfa3n`, snapshot timestamp `2026-08-30T11:18:51Z`.
- Compute type: `read_only`; SQL confirmed `transaction_read_only=on`.
- Aggregate counts: 4 users, 11 leads, 0 posts, 11 messages, 2 quotes,
  2 contracts, 1 work order, 8 private-media records, 40 migrations and
  13 operational jobs.
- Signed-contract integrity: 1 signed, 0 missing required signature evidence.
- Work-order integrity: 0 missing contract, 0 invalid contract and 0 immutable
  document-hash mismatch.
- Relationship integrity: 0 orphan contract→quote, work-order→lead or final
  contract→private-media relations.
- Private Blob inventory: 8 objects / 342,458 bytes, exactly matching DB media
  count and aggregate bytes; authenticated HEAD and full private GET passed,
  size matched, and unauthenticated GET was denied with HTTP 403.
- Purge inventory: 0 trashed and 0 due-for-purge leads.
- Queue inventory: 0 retry/running/attention and 0 stale-running jobs. Three due
  historical `message.delivery` jobs point to messages already marked `sent`;
  the release candidate now reconciles those jobs as completed duplicates
  without creating or invoking an email provider. Sent/delivered and concurrent
  terminal-state paths are regression-tested.
- The tracked Payload invariant script was not used because its development
  bootstrap entered an interactive schema-diff prompt. It was interrupted before
  selection; the read-only database made schema mutation impossible. Direct
  read-only aggregate and relationship queries were used instead.
- Cleanup completed: only `br-round-silence-as5727lk` was deleted after its exact
  ID, name and Production parent were re-verified. The Production parent and
  previously retained backup branches remain unchanged. A new retained snapshot
  is still required immediately before an authorized Production cutover.

## Local release-candidate evidence

- Contract/customer-signature/work-order/scheduler/no-send targeted suite:
  8 files, 58 tests — PASS.
- Full unit/API suite: 208 files, 915 tests — PASS.
- Migration suite: 21 files, 39 tests — PASS.
- TypeScript typecheck, scoped changed-file lint, full repository lint and
  `git diff --check` — PASS.
- Total automated tests in this local gate: 954 — PASS.
- No local production build was run against the existing environment because
  `npm run build` intentionally executes database migrations. The isolated
  PostgreSQL migration/bootstrap/build proof is delegated to the exact-SHA Linux
  Quality Gate.
