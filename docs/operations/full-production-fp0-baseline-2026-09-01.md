# Full Production FP0 baseline — 2026-09-01

## Decision

- Integration branch: `codex/full-production-integration`
- Worktree: `C:\Dev\takfornyelse-full-production-integration-20260901`
- Origin-authoritative base: `1864ba9a775ea5e14401910b2d7b75582c3bc9bc`
- Reconciliation anchor: `5549579c7c40e45abe5aa3968c6f59378d1e9adf`
- Replayed operational commits:
  - `5a45c3e32a2fff972ba7c4caf53ba04bd7e79404`
  - `4a78f9131bda89eaef87d4312d87a05d48a9c4a0`
  - `195f3d958a554e692445c1f5b8b5b9ccf6529bea`
- Assembled integration SHA before this document/CI change:
  `fc7ea33999898675be432c2913aea54b7926243e`
- Assembled tree:
  `839c3c64ab324c0b73be0a2247d4fed0ba9cb499`

The assembled tree exactly matches the local operational candidate
`195f3d958a554e692445c1f5b8b5b9ccf6529bea`. The local `68bb2e1` and remote
`1864ba9` Turnstile commits have the same stable patch id and the same tree, so
`68bb2e1` was not replayed a second time.

This is a reversible local FP0 integration action. It does not deploy, migrate
Production data, enable a feature flag, send a message, or authorize a release.

## Preserved owner files

The original checkout `C:\Dev\takfornyelse-production-a8799d5` remains
untouched. Its four modified and five untracked control documents belong to the
project owner/control stream and are intentionally excluded from this worktree:

- `docs/admin-v2-operational-completion-plan.md`
- `docs/full-platform-implementation-master-plan.md`
- `docs/operations/all-features-controlled-pilot-2026-08-30.md`
- `docs/operations/full-automation-war-room-2026-08-30.md`
- `docs/operations/admin-crm-ux-benchmark-audit-2026-09-01.md`
- `docs/operations/controlled-production-golden-e2e-2026-08-31.md`
- `docs/operations/full-production-program-control-2026-09-01.md`
- `docs/operations/full-production-ui-ux-automation-execution-plan-2026-09-01.md`
- `docs/operations/post-stabilization-product-backlog.md`

Do not stash, reset, move, delete, or implicitly absorb these files. Their
reviewed content may be copied through an explicit control-document commit only.

## Active branch classification

| Branch | Classification | FP0 consequence |
| --- | --- | --- |
| `codex/all-features-controlled-pilot-20260830` | reconciled | Exact operational tree reproduced on the integration branch; do not merge the divergent lineage. |
| `codex/master-platform-implementation` | superseded baseline | Ancestor of the accepted integration tree. |
| `main` | superseded baseline | Ancestor only; not the Admin Next base. |
| `codex/ui-admin-next-fp0-20260901` | continue | Review and integrate only declared UI milestone commits after I1/FP gates. |
| `codex/rf-roof-fusion-engine-20260901` | continue | RF-2 is implemented; integrate declared commits after I1 contract acceptance. |
| `codex/prod-hotfix-commercial-package-safety-20260901` | blocked owner proof | Do not integrate until the exact-Preview Case 13 P1 manual gate passes. |
| `codex/customer-photo-hotfix-20260831` | review/cherry-pick candidate | First commit overlaps the accepted photo vertical; review the append/compact follow-up separately. |
| `codex/worker-portal-kill-switch-20260830` | review/cherry-pick candidate | Safety commit requires focused regression before integration. |
| `codex/operational-scheduler-main-20260830` | review/cherry-pick candidate | Scheduler commit must be separated from its obsolete base lineage. |
| `codex/question-flow-ux-fix` | continue/review | Review the two exclusive question/package commits against the accepted base. |
| `codex/question-flow-backend-hardening` | continue/review | Review the exclusive backend hardening commit. |
| `codex/question-flow-recovery-ux` | continue/review | Review the exclusive recovery UX commit. |
| `codex/question-reply-cas-hardening` | continue/review | Review the exclusive CAS hardening commit. |
| `codex/question-ai-reprepare` | continue/review | Review the exclusive AI draft recovery commit. |

No branch is archived or deleted by this classification.

## CI and rollback

The quality workflow now runs for pull requests targeting both `main` and
`codex/full-production-integration`. Pushes under `codex/**` remain covered.
The local branch must not be called protected or FP0 `PASS` until it is pushed,
remote required checks/review are configured, and the exact assembled SHA has a
green full quality run.

Rollback before any remote publication is local and non-destructive: stop using
this worktree/branch and continue from the preserved source branches. After
remote publication, rollback means creating a new branch from the recorded
baseline tag or reverting reviewed integration commits; never rewrite a shared
branch.

## Remaining FP0 gate

- Run the full local quality baseline on the exact post-commit SHA.
- Record a baseline tag only after that result is green.
- Review active cherry-pick candidates; none may arrive through a blind merge.
- Push through the normal reviewed path, then configure required checks/review.
- Produce exact-SHA Preview and current-function smoke evidence.
- Keep FP0 `NOT_PASS` until all items above are proven.
