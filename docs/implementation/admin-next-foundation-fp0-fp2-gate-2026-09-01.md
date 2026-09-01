# Admin Next foundation FP0–FP2 gate — 2026-09-01

## Decision

The consolidation vertical is **IMPLEMENTED**. FP0, FP1 and FP2 remain **NOT
PASS** until the dependency evidence below is supplied. This milestone does
not authorize merge, deploy, Production activation or a Roof Fusion contract
change.

## Branch and ownership audit

- Worktree: `C:\Dev\takfornyelse-ui-admin-next-fp0-20260901`
- Branch: `codex/ui-admin-next-fp0-20260901`
- Audited `main` / merge-base: `380f64d2d7092cfb0bdf7f681ad6afebe30030c1`
- Audit distance: `main...HEAD = 0 behind / 294 ahead` before this milestone.
- The repository has no `.github/CODEOWNERS` file.
- This stream owns `src/lib/admin-next/**`, `src/components/admin-next/**`,
  protected Preview routes and UI evidence only.
- This stream explicitly does not own `src/lib/roof-fusion/**`, canonical API
  mutations, Payload collections/migrations, deployment or Production flags.

Integrator consequence: do not merge the entire long-lived branch by
assumption. Use the reviewed UI milestone commits or a declared integration
branch, then rerun the full quality gate against that exact base.

### Central integration target audit

Read-only verification of `C:\Dev\takfornyelse-production-a8799d5` found:

- requested ref `codex/full-production-integration` exists neither locally nor
  under `origin`;
- the checkout is on `codex/all-features-controlled-pilot-20260830` at
  `195f3d958a554e692445c1f5b8b5b9ccf6529bea`;
- it is dirty with four modified control/plan documents and five untracked
  control/QA/backlog documents;
- relative to `origin/codex/all-features-controlled-pilot-20260830` it is
  `ahead 4 / behind 1`;
- the origin alternative is
  `1864ba9a775ea5e14401910b2d7b75582c3bc9bc`; the local equivalent Turnstile
  change is `68bb2e139cd4f009ec617a73afd8f35520060b5e`;
- `68bb2e1` is an ancestor of local `195f3d9`. The later local-only commits are
  `5a45c3e`, `4a78f91` and `195f3d9`;
- the common reconciliation anchor is
  `5549579c7c40e45abe5aa3968c6f59378d1e9adf`.

Exact base candidates requiring an integrator/owner decision:

1. **Local operational candidate:**
   `195f3d958a554e692445c1f5b8b5b9ccf6529bea`, only if the local Turnstile,
   secure-photo, removable-selection and quote-idempotency chain is accepted.
2. **Origin-authoritative candidate:**
   `1864ba9a775ea5e14401910b2d7b75582c3bc9bc`, followed by explicit review and
   cherry-pick of `5a45c3e`, `4a78f91` and `195f3d9` as required. Do not also
   cherry-pick patch-equivalent `68bb2e1`.

The reconciliation anchor is evidence only, not a recommended release base.
No branch creation or rebase is authorized by this report.

After the dirty control documents have an explicit owner and the base SHA is
approved, create the integration branch in a new worktree so the production
checkout remains untouched:

```powershell
git worktree add -b codex/full-production-integration-20260901 `
  C:\Dev\takfornyelse-full-production-integration-20260901 <APPROVED_BASE_SHA>
```

Before running this command, verify that the target directory and branch do
not exist and record the dirty production documents separately. Do not stash,
reset, move or commit those documents without their owner's instruction.

## Canonical capability boundaries

The executable registry is
`src/lib/admin-next/capability-registry.ts`.

| Capability | Canonical source | Preview read boundary | Mutation owner |
| --- | --- | --- | --- |
| Case | `leads` | Admin V2 case read model / Case adapter | existing Admin V2 lead APIs and case commands |
| Property | `leads` address/property projection | Case adapter | existing Admin V2 lead APIs |
| Customer | `leads` customer projection | Case adapter | existing lead/contact APIs |
| Roof | `roof-measurements` legacy bridge; target append-only `roof-snapshot.v1` repository | current Case adapter; target internal snapshot plus approved renderer-envelope adapters | future authorized Roof Fusion command API |
| Visit | `work-orders` | `AdminNextFieldVisitAdapter` | worker work-order APIs and workflow |

Every Preview contract is read-only. `previewMutationPolicy` is `forbidden`;
every Admin Next module is `fixture_only` and delegates mutations to the
legacy/canonical owner.

## Implemented foundation vertical

- One typed capability registry now owns module dependencies, canonical
  capabilities, FP target, adapter maturity and legacy fallbacks.
- R4 is classified as `adapter_ready`, not release-ready. Its protected route
  now gates on `roofWorkbench` and `measurementEvidenceV2`, not on the broader
  Case module.
- One `resolveAdminNextPreviewAccess` decision is used by Today, Case, R4,
  preflight and worker Preview routes.
- Preview access is granted only to `preview_ready`; Production active access
  is granted only to `enabled`. Adapter-only modules therefore fall back in
  Production even if a global release reference exists.
- Today now checks its own dependencies instead of inheriting only the global
  Preview shell gate.
- Worker fallback resolves to `/user`; Admin fallbacks remain inside Admin V2.
- The dark UI and all approved visual evidence are unchanged.

## Characterization and CI evidence

The new tests characterize:

- all five canonical capability boundaries;
- fixture-only / legacy-only ownership;
- rollout-off fallback for every module;
- per-module Preview dependency readiness;
- adapter-only Production denial;
- worker-versus-admin fallback selection.

Existing Admin V2 case read-model, work-order workflow and platform feature
tests remain the canonical behavior references. The repository quality
workflow runs lint, typecheck, unit/API tests, migrations, build and browser
smoke. Its default flags remain fail-closed. It does not yet run an
authenticated Admin Next Preview matrix.

Local milestone evidence:

- `npm run typecheck` — PASS;
- `npm run lint` — PASS;
- focused foundation/Admin characterization — 16 files / 94 tests PASS;
- full `npm run test:ci:unit` — 238 files / 1050 tests PASS;
- `git diff --check` — PASS;
- no Roof Fusion, API, Payload or visual artifact file changed.

## Remaining gates

### FP0 — NOT PASS

- No formal CODEOWNERS or signed file-ownership/dependency manifest exists.
- `codex/full-production-integration` does not exist; the integration target,
  approved base and exact cherry-pick set are not declared.
- The production checkout is dirty and its local branch diverges from origin;
  the `195f3d9` versus `1864ba9` decision is unresolved.
- Full CI evidence must be produced on the integrator's assembled branch, not
  inferred from this isolated worktree.

### FP1 — NOT PASS

- Today and Case Workspace still use deterministic fixtures rather than a
  canonical read-only Case/Property/Customer adapter.
- A side-by-side characterization suite must prove that the new adapter
  preserves Admin V2 next action, ownership, SLA, stages and fallback links on
  representative canonical records.
- Authenticated Preview route smoke is not present in CI.

### FP2 — NOT PASS

- Roof, document preflight and Visit remain fixture adapters.
- R4 requires formal immutable measurement evidence/private-storage readiness
  and the I1 Roof Fusion read contract reviewed in
  `admin-next-roof-fusion-i1-review-2026-09-01.md`; this stream does not change
  Roof Fusion.
- Preflight requires exact canonical quote/contract/recipient/PDF revisions,
  hashes and action-time owner-gate evidence.
- Visit requires a read-only canonical work-order adapter and state mapping
  characterization against the existing worker workflow.

## Integrator handoff requirements

1. Declare the integration branch/base and the UI commit list.
2. Reconcile `195f3d9` with origin `1864ba9` and assign ownership of every
   dirty production control document before creating a new worktree.
3. Confirm ownership for Admin Next, canonical Case, Roof/Roof Fusion and Visit
   boundaries.
4. Implement canonical read-only adapters behind the existing interfaces.
5. Add authenticated Preview matrix smoke to CI with all Production mutations
   still disabled.
6. Run the full quality workflow and record the exact SHA before considering
   any FP phase for PASS.
