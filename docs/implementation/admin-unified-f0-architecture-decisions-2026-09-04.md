# Takfornyelse unified admin — F0 architecture decisions

**Owner:** PLATFORM

**RF boundary owner:** RF

**Status:** F0 ADR REGISTER — documentation approved; implementation not started

**Date:** 2026-09-04

**Audited code baseline:** `4d03b94`

**Source plan:** `docs/product/takfornyelse-unified-admin-ui-ux-system-plan-2026-09-04.md`
**Production:** untouched; this register does not authorize deploy, schema migration,
feature activation, customer communication, pricing changes, or Production data writes

## 1. Purpose and decision status

This document turns the approved F0 direction into auditable architecture decision
records before any unified-admin implementation begins. It records the target
boundaries, the validation evidence required to cross each later phase gate, and a
safe fallback if parity or safety cannot be proven.

Status meanings:

- **`accepted-by-GO`** — the F0 owner GO accepts the architecture boundary as the
  default for subsequent design and validation. It does **not** mean the code exists,
  a database migration is approved, or Production release is authorized.
- **`proposed`** — the direction is recorded, but a named validation or owner decision
  is still required before it can become binding for implementation.

Where an ADR has a split status, only the explicitly accepted boundary is binding;
the remaining implementation or release choice stays proposed.

## 2. Audited current-state evidence

| Area | Current code evidence | Architectural implication |
|---|---|---|
| Custom operator shell | `src/app/(admin-shell)/admin-v2/layout.tsx:13`, `src/components/admin-v2/admin-navigation.tsx:8` | A real dark custom shell and eleven operator destinations already exist; replacing it with a third shell would duplicate navigation, authentication, and rollout behavior. |
| Technical Payload UI | `src/app/(payload)/admin/[[...segments]]/page.tsx:3`, `src/app/(payload)/admin/[[...segments]]/page.tsx:21`, `src/app/(admin-shell)/admin-v2/layout.tsx:47` | `/admin` is an active Payload catch-all and is already labelled as technical backoffice from the custom shell. |
| Route isolation | `src/proxy.ts:27`, `src/proxy.ts:30` | The proxy explicitly excludes the `admin` namespace from locale middleware; changing that boundary casually risks both Payload and custom-admin routing. |
| Preview shell drift | `src/components/admin-next/admin-next-shell.tsx:84`, `src/components/admin-next/admin-next-shell.tsx:85`, `src/components/admin-next/admin-next-capability-board.tsx:233` | Admin Next is a protected preview with a second navigation model; its Cases link currently resolves to Today and RF can be reached through a diagnostic UAT surface. |
| Next action | `src/lib/admin-v2/case-read-model.ts:12`, `src/lib/admin-v2/case-read-model.ts:80`, `src/lib/admin-v2/case-workspace-view-model.ts:281`, `src/lib/admin-v2/case-workspace-view-model.test.ts:135` | Admin V2 already has a typed deterministic resolver and an exhaustive presentation mapping that should be consolidated, not rewritten in the UI. |
| Today adapter | `src/lib/admin-next/today-contract.ts:1`, `src/lib/admin-next/today-contract.ts:10`, `src/lib/admin-next/today-read-adapter.ts:9` | Today currently narrows real work to four fixed stages/actions/reasons, so it cannot yet be the canonical process dictionary. |
| Case command safety | `src/lib/cases/case-command.ts:34`, `src/lib/cases/case-command.ts:45`, `src/lib/cases/case-command.ts:55`, `src/lib/cases/case-command.ts:67` | A reusable command boundary already demonstrates idempotency, optimistic case revision checks, trusted state writes, and correlated audit recording. Coverage is not yet universal. |
| Current roles | `src/payload/access/roles.ts:3`, `src/payload/access/roles.ts:14`, `src/payload/access/roles.ts:61`, `src/payload/collections/Users.ts:117` | Backend identity recognizes only active `admin` and `worker`; finer UI personas do not yet have enforceable server capabilities. |
| Audit store | `src/payload/collections/AuditEvents.ts:5`, `src/payload/collections/AuditEvents.ts:24`, `src/payload/collections/AuditEvents.ts:39`, `src/lib/audit/audit-event.ts:4`, `src/lib/audit/audit-event.ts:78` | Audit records are append-only, store changed field names and integrity hashes, and reject sensitive metadata keys, but do not provide a safe human-readable `from → to` projection. |
| Timeline fidelity | `src/lib/admin-next/case-read-adapter.ts:139`, `src/lib/admin-next/case-read-adapter.ts:145`, `src/lib/admin-next/case-workspace-fixture.ts:246` | The preview timeline can hardcode `Takfornyelse CRM` as actor, so it is not yet a trustworthy audit-history view. |
| Customer and Property | `src/payload/collections/Leads.ts:114`, `src/payload/collections/Leads.ts:154`, `src/lib/admin-next/capability-registry.ts:36`, `src/lib/admin-next/capability-registry.ts:44` | Customer contact and property address are fields/projections of `leads`; there are no independent canonical Customer or Property collections. |
| Async feedback | `src/components/admin-v2/measurement-review-panel.tsx:325`, `src/components/admin-v2/company-signature-panel.tsx:23`, `src/components/worker/worker-order-actions.tsx:484` | Local `busy` labels are common and the worker surface uses `aria-busy`, but there is no shared command/navigation feedback contract and no route-level `loading.tsx` under `src/app`. |
| RF persistence | `src/payload/collections/RoofFusion.ts:8`, `src/payload/collections/RoofFusion.ts:34`, `src/payload/collections/RoofFusion.ts:44`, `src/payload/collections/RoofFusion.ts:61`, `src/payload/collections/RoofFusion.ts:73` | RF snapshots and their command ledger are already append-only with stable snapshot ID, revision, hash, state, command hash, and idempotency key. |
| Measurement and quote immutability | `src/payload/collections/RoofMeasurements.ts:14`, `src/payload/collections/RoofMeasurements.ts:37`, `src/payload/collections/RoofMeasurements.ts:173`, `src/payload/collections/RoofMeasurements.ts:379`, `src/payload/collections/Quotes.ts:6`, `src/payload/collections/Quotes.ts:24` | Approved measurements and approved/issued quote inputs are protected from overwrite, but no exact RF snapshot identity is yet persisted through the measurement-to-quote chain. |
| Worker offline baseline | `src/components/worker/worker-order-actions.tsx:60`, `src/components/worker/worker-order-actions.tsx:108`, `src/components/worker/worker-order-actions.tsx:170` | The worker UI saves non-file form drafts to `localStorage` and submits directly to server routes; no service worker, offline command ledger, background sync, or explicit conflict protocol was found. |

## 3. Decision summary

| ADR | Decision | Status |
|---|---|---|
| F0-001 | Evolve one custom shell; do not create `admin-v3` | `accepted-by-GO` |
| F0-002 | Keep Payload `/admin` technically reserved and keep the custom shell on its current namespace during foundation rollout | `accepted-by-GO` for the boundary; final friendly alias remains `proposed` |
| F0-003 | Use one process vocabulary and one deterministic, explainable NextAction resolver | `accepted-by-GO` |
| F0-004 | Make server commands the final enforcement point for every material mutation | `accepted-by-GO` |
| F0-005 | Build server capabilities before shipping role-specific UI | `accepted-by-GO` |
| F0-006 | Project audit history through an allowlisted, PII-redacted read model | `accepted-by-GO` |
| F0-007 | Ship Customer/Property read projections before considering canonical entity migration | `accepted-by-GO` |
| F0-008 | Standardize action-specific async loading, completion, failure, retry, and conflict feedback | `accepted-by-GO` |
| F0-009 | Make RF discoverable from the case and preserve an exact-hash RF → RoofMeasurement → quote-draft boundary | `accepted-by-GO` for the boundary; Phase E implementation remains `proposed` and separately gated |
| F0-010 | Require a mobile offline threat-model gate before any offline/PWA rollout | `accepted-by-GO` |

## ADR-F0-001 — One evolving custom shell; no `admin-v3`

**Status:** `accepted-by-GO`

### Context

The repository currently has a production-capable custom Admin V2 shell and a
separate Admin Next Preview shell. The preview has useful tokens, adapters, One Card
patterns, and fail-closed rollout logic, but it also duplicates navigation and still
links some destinations back to Admin V2. A third permanent shell would create three
places to maintain authentication, navigation, responsive behavior, translations,
accessibility, deep links, loading states, and module fallbacks.

### Decision

There will be one custom operator shell. It will evolve from the existing
`(admin-shell)` and Admin V2 runtime while progressively absorbing validated Admin
Next tokens, layouts, read adapters, and One Card components.

- Do not create an `admin-v3` route tree, layout, or navigation registry.
- Keep Admin Next Preview as a read-only test/evidence surface until each vertical is
  either absorbed into the common shell or retired by a later explicit decision.
- Migrate by vertical slice behind module-level rollout gates.
- A migrated module must retain its canonical/legacy mutation owner until the server
  command for that module passes its own gate.
- The technical Payload shell is not part of this consolidation and remains a
  separately labelled backoffice.

### Consequences

- Positive: one navigation and interaction contract; lower drift; gradual parity can
  be proven against real routes.
- Positive: useful Admin Next work is reused without making its preview fixtures or
  diagnostic surfaces production truth.
- Cost: the existing Admin V2 shell and large case page must be decomposed in place
  through adapters and components rather than replaced in one clean rewrite.
- Constraint: a shared visual shell does not authorize moving domain mutations into
  React components.

### Validation gate

Before the first module is considered migrated:

1. One navigation registry covers desktop and mobile and has no duplicate module
   labels or dead destinations.
2. Authentication, locale, focus management, keyboard navigation, and logout parity
   pass at 1440, 1024, 768, and 375 px.
3. The module has canonical read parity, a named mutation owner, and a tested legacy
   fallback.
4. Preview fixtures cannot appear in canonical/Production mode.
5. No new route, component, or document refers to `admin-v3` as an implementation
   target.

### Rollback / fallback

Disable the migrated module gate and route the user to the current Admin V2 module.
Do not roll back by duplicating the module into another shell. Keep legacy behavior
available until parity, UAT, and a separate release GO have passed.

## ADR-F0-002 — URL namespace and the Payload `/admin` boundary

**Status:** `accepted-by-GO` for reserving `/admin` and retaining the current custom
namespace during foundation rollout; `proposed` for any final friendly alias or
redirect

### Context

`/admin` is not an unused desirable URL: it is implemented by Payload's catch-all
`RootPage`, excluded from locale middleware, and linked from the custom shell as
technical backoffice. The operator UI currently lives under `/admin-v2`; the protected
Admin Next test surface lives under `/admin-next-preview`. Custom server mutations
use `/api/admin/*`, which is an API namespace and does not collide with the Payload UI
route.

Changing `/admin` would affect Payload import maps, authentication expectations,
middleware, bookmarks, operational runbooks, and emergency access. The holistic plan
also makes URL renaming explicitly non-P0.

### Decision

The route boundary during F0/F1 and vertical rollout is:

| Namespace | Owner and permitted use |
|---|---|
| `/admin` | Payload technical backoffice only; privileged, separately labelled, and absent from daily primary navigation |
| `/admin-v2/*` | Current custom operator shell and the safe host namespace for incremental consolidation |
| `/admin-next-preview/*` | Protected read-only preview/UAT evidence; never the default operator entry point |
| `/api/admin/*` | Custom server command/read endpoints; authorization and domain enforcement remain mandatory |
| `/user/*` | Worker/mobile-first experience |

No code in F0/F1 will move Payload, alias the custom shell onto `/admin`, or add an
`admin-v3` namespace. A later URL ADR may choose a durable human-friendly alias only
after link inventory, middleware, authentication, redirect, telemetry, and rollback
tests. The alias name is deliberately not invented here.

### Consequences

- Positive: Payload's emergency/technical path remains stable while the operator UI
  changes safely.
- Positive: foundation work can proceed without a broad URL migration.
- Cost: `/admin-v2` remains visible during rollout even though the target experience
  is no longer conceptually “V2”.
- Constraint: UI navigation must label destinations by purpose, not expose Payload as
  an equivalent daily admin module.

### Validation gate

Before proposing a final alias or redirect:

1. Produce a machine-readable inventory of internal links, emails, tests, bookmarks
   documented in runbooks, auth redirects, middleware matchers, Payload import-map
   assumptions, and external callbacks that mention `/admin-v2` or `/admin`.
2. Prove static and dynamic route precedence for `/admin`, `/api/admin`, localized
   site routes, and `/user`.
3. Test direct navigation, refresh, authentication expiry, deep links, and rollback
   from the candidate alias.
4. Keep `/admin` available to authorized technical administrators throughout a
   canary unless a separate Payload migration decision is explicitly approved.

### Rollback / fallback

The no-redirect fallback is the current route map. Remove or disable only the new
alias/redirect gate; do not move Payload or rewrite stored URLs as part of rollback.

## ADR-F0-003 — One process vocabulary and deterministic NextAction

**Status:** `accepted-by-GO`

### Context

The current system uses multiple overlapping concepts: `Leads.status`,
`recordState`, free-text `Leads.nextAction`, `nextActionBlocker`, WorkOrder status,
document statuses, and a narrower Admin Next Today vocabulary. Admin V2 already has
a typed `CaseNextActionKind` resolver and an exhaustive presentation mapping, while
Today currently projects only four fixed action categories. Without one dictionary,
the same record can show conflicting stage, color, blocker, and CTA across modules.

### Decision

The target dictionary is:

| Term | Canonical meaning |
|---|---|
| `processStage` | `inquiry → evidence → commercial → agreement → work → completion` |
| `caseState` | Derived `on_track | needs_action | waiting | blocked | completed` |
| `recordState` | Persistence lifecycle `active | archived | trashed` |
| `nextActionKind` | Typed command, guided question/panel, waiting state, or no action |
| `priority` | Explainable queue order, separate from stage, state, risk, and color |
| `risk` | SLA, financial, legal, safety, or data-integrity exposure |
| `blocker` | Structured unmet condition/relationship with owner, state, and resolution |
| `artifactVersion` | Immutable system ID/version/hash and optional `supersedes` link |
| `visitState` | WorkOrder/visit lifecycle, separate from case process stage |

One pure, deterministic resolver becomes the truth for case presentation and Today:

```ts
type NextAction = {
  kind: string
  reasonCode: string
  ownerId?: string
  ownerCapability?: string
  dueAt?: string
  priority: string
  requiredCapability?: string
  blockerIds: string[]
  command?: string
  reviewMode: 'inline' | 'review_and_commit' | 'danger' | 'waiting'
  expectedResult: string
  href: string
}
```

The logical precedence is:

1. legal, safety, or integrity stop;
2. failed command/delivery recovery;
3. customer question or time-bound communication;
4. today's SLA or visit action;
5. normal process action;
6. waiting with a named owner and wake-up condition;
7. completed/no action.

`Leads.nextAction` remains a compatibility/operator-note field during migration and
must not authorize a transition. `nextActionBlocker` remains a compatibility code
until structured blockers exist. AI may summarize the explanation or draft content,
but cannot choose a forbidden transition, reorder hard priorities, or bypass evidence
and hash gates.

### Consequences

- Positive: Today, case workspace, mobile deep links, automation wake-ups, and history
  can explain the same next action.
- Positive: queue order is testable and no longer inferred from arbitrary card order
  or status color.
- Cost: all current action kinds, statuses, exception states, and legacy free text need
  a characterization matrix and adapters.
- Constraint: blockers do not create extra process stages; `caseState=blocked` is
  derived from open transition-blocking conditions.

### Validation gate

1. Inventory every current `CaseNextActionKind`, WorkOrder state, message recovery,
   quote/contract transition, document review, SEO action, and operational retry.
2. Every active case fixture and representative canonical record resolves to exactly
   one executable/waiting action or one explicit blocker.
3. Every resolver kind has an exhaustive presentation and localization test.
4. Shadow-read comparison shows the consolidated resolver preserves intended Admin
   V2 results and identifies every deliberate difference.
5. Property tests prove priority determinism, stable tie-breaking, timezone/SLA
   boundaries, and blocker precedence.
6. Today canonical mode contains no fixed demo action/reason constants.

### Rollback / fallback

Retain the current Admin V2 resolver as the canonical adapter and disable the new
Today/workspace projection. Never fall back to free-text `nextAction` as authority.

## ADR-F0-004 — Server commands are the final mutation enforcement point

**Status:** `accepted-by-GO`

### Context

The codebase has strong examples of server enforcement—administrator checks,
transition guards, optimistic case revisions, immutable versions, idempotency keys,
correlation IDs, and audit events—but those safeguards are spread across collection
hooks, route handlers, services, and feature-flag paths. `executeCaseCommand` provides
a useful pattern, yet `updateCaseState` can still use a direct legacy update when the
case-state feature is disabled. A unified UI must not duplicate or weaken domain
rules in client components.

### Decision

Every material mutation exposed by the unified admin must invoke one named server
command owned by the relevant domain. The command is the final arbiter and executes,
in order:

1. authenticated actor and required capability/scope;
2. input schema and request-origin rules;
3. current entity state and allowed transition;
4. required evidence, approvals, versions, hashes, and blockers;
5. expected revision/CAS or equivalent stale-context check;
6. idempotency claim before side effects;
7. atomic write or explicit command-ledger/job orchestration;
8. correlated append-only audit outcome;
9. return of the refreshed safe projection and deterministic next action.

React `disabled`, hidden buttons, page loaders, and Payload collection access are
defence layers, not the command authority. A command that uses `overrideAccess` must
have already made an explicit capability decision and must pass trusted context only
to narrow, audited domain hooks.

The F0 mutation inventory must record for each command: UI/API caller, owner,
authorization, transition validator, expected revision/version, idempotency,
side-effects/jobs, audit event, response, and legacy fallback.

### Consequences

- Positive: desktop, mobile, API, webhook, and automation cannot apply contradictory
  rules to the same business transition.
- Positive: retries and stale tabs have explicit outcomes instead of duplicate writes
  or silent overwrite.
- Cost: large route handlers and direct Payload updates must be characterized and
  progressively wrapped or extracted; this is not a single refactor.
- Constraint: UI consolidation cannot proceed ahead of a module's command inventory
  for any mutating action.

### Validation gate

For every migrated command, automated tests must prove:

- unauthenticated, unauthorized, out-of-scope, stale-revision, invalid-transition,
  missing-evidence, and hash-mismatch denial;
- identical idempotency key plus identical payload returns the same result;
- same key plus different payload conflicts;
- double click and transport retry do not duplicate records, messages, captures, or
  jobs;
- partial side-effect failure is either rolled back or visible as resumable/failed,
  never reported as complete;
- one correlation ID connects command, created records, job(s), and audit event(s);
- the returned next action matches a fresh server read.

### Rollback / fallback

Disable the new UI command adapter and call the existing canonical legacy route or
service. Do not roll back by permitting client-side state mutation or bypassing CAS,
authorization, immutable-version, or audit guards.

## ADR-F0-005 — Capability enforcement before role-specific UI

**Status:** `accepted-by-GO`

### Context

Backend authorization currently recognizes only active `admin` and `worker`, while
the target experience describes dispatcher, commercial reviewer, SEO editor,
auditor, operator, field worker, and administrator profiles. Shipping those as UI-only
personas would merely hide buttons while existing broad server permissions remain.

### Decision

Capability checks are implemented and denial-tested on server commands and read
projections before a role-specific Production UI is enabled.

- Keep the current `admin|worker` identity roles as the compatibility source during
  F0/F1.
- Define atomic server capabilities and scopes first, for example case read/assign,
  measurement review/approve, quote review/approve/issue, contract review,
  work dispatch, assigned-visit transition, SEO edit/review/publish, audit read, and
  technical administration.
- Compose human-facing profiles as capability bundles; profiles are not authorization
  code.
- A server capability decision returns `allowed`, a stable reason code, and scope.
- The server-provided action projection is filtered by both capability and current
  state. The client may further simplify presentation but cannot add an action.
- Overrides require a separate capability, reason, review mode, and audit event; they
  never appear as the ordinary primary CTA.
- Technical Payload access remains a distinct capability from daily operator access.

### Consequences

- Positive: least privilege and role-specific UX become the same policy rather than
  two drifting systems.
- Positive: mobile and desktop can show different layouts without silently changing
  authority.
- Cost: permissions, scopes, migration defaults, support procedures, and denial tests
  must exist before the more tailored screens can ship.
- Constraint: the UI must distinguish “not relevant”, “not permitted”, and “blocked
  by state”; not every unavailable action is treated the same way.

### Validation gate

1. A signed capability matrix maps every read projection and mutation command to
   capability, scope, current compatibility role, target bundle, and owner.
2. Default is deny for unknown role, missing capability, deactivated user, and
   out-of-scope entity.
3. Route/service tests assert denials independently of UI visibility.
4. Assigned-worker restrictions remain enforced for worker records and media.
5. An auditor bundle is read-only, including direct API attempts.
6. Role changes and deactivation invalidate or revoke active sessions as required.
7. Only after these pass may the matching role-specific navigation and CTA set be
   enabled.

### Rollback / fallback

Keep the current broad admin UI for active administrators and the current assigned
worker UI. Do not expose a new profile whose server capability bundle is incomplete;
fail closed to the legacy surface.

## ADR-F0-006 — Privacy-safe audit history projection

**Status:** `accepted-by-GO`

### Context

`audit-events` is immutable and intentionally avoids raw customer data. It stores the
actor relationship, action, entity, correlation ID, changed field names, before/after
hashes, and allowlisted metadata. This is a sound integrity store, but it is not yet a
usable operator history. The current case timeline is largely reconstructed from
entity timestamps, and the Admin Next adapter can hardcode an actor label.

Persisting raw before/after snapshots merely to make the UI convenient would expose
names, addresses, contact details, notes, tokens, signatures, or other PII in an
append-only log and in caches. The history experience therefore needs a separate
projection rather than a less safe event store.

### Decision

Create a read-only `AuditHistoryProjection` over real audit events and, only where
authorized and safe, current/versioned domain records. It returns:

```ts
type AuditHistoryItem = {
  eventId: string
  occurredAtUtc: string
  actor: { kind: 'user' | 'api' | 'webhook' | 'job' | 'system'; label: string }
  action: string
  entity: { type: string; id: string; version?: string }
  correlationId: string
  changes: Array<{ field: string; from?: string; to?: string; redacted?: true }>
  reason?: string
  result: 'succeeded' | 'partial' | 'failed' | 'compensated'
  produced: Array<{ type: string; id: string; version?: string }>
  nextActionKind?: string
}
```

Projection policy:

- field-specific allowlists define whether semantic `from → to` values may be shown;
- status, state, version, owner reference, due date, totals already safe for the
  viewer, and stable reason codes may be projected;
- customer names, contact values, addresses, free-text notes, tokens, secrets,
  signatures, authorization data, and raw document/snapshot content are redacted or
  summarized, never copied into `audit-events`;
- actor labels are resolved from the real actor/source under `audit.read` capability;
- hashes remain integrity evidence and are not presented as a substitute for a human
  change explanation;
- UTC is canonical; the UI localizes time and shows timezone on demand;
- pagination and filtering happen server-side.

### Consequences

- Positive: the operator can answer who changed what and what followed without
  weakening the append-only store's privacy model.
- Positive: automation, webhook, job, and compensation outcomes become distinguishable
  from human edits.
- Cost: each auditable field/action needs projection policy and tests; some events can
  initially show only a safe semantic summary.
- Constraint: no timeline item may fabricate an actor or infer a successful command
  only from `updatedAt`.

### Validation gate

1. Redaction tests inject names, email, phone, address, notes, tokens, cookies,
   signature values, document bodies, and nested metadata and prove none escape.
2. Allowlist tests prove expected safe `from → to` values for status, state, owner,
   due date, version, and result.
3. Actor/source, UTC/local display, correlation, produced artifacts, and failure/
   compensation are represented from real events.
4. Missing/deleted actors degrade to a safe stable label without losing event identity.
5. Viewer capability and case scope are checked server-side.
6. Case timeline parity explicitly replaces timestamp-derived and hardcoded-actor
   items; unresolved gaps are labelled, not invented.

### Rollback / fallback

Fall back to a minimal history of real event timestamp, action, entity, changed field
names, result, and correlation ID. Do not fall back to raw snapshots or unredacted
domain records.

## ADR-F0-007 — Customer and Property read projections before canonical migration

**Status:** `accepted-by-GO`

### Context

The target information architecture needs customer and property views, but current
canonical storage does not have Customer or Property collections. Name/contact and
address/building context live on each Lead, and Admin Next already declares Customer
and Property as lead-backed read capabilities. Treating them as independent canonical
entities now would imply deduplication, multi-property ownership, cross-case identity,
and write semantics that the data model does not support.

### Decision

F1/F2 may expose read-only `CustomerSummary` and `PropertySummary` projections, each
explicitly lead-backed:

- stable projection IDs are namespaced by source, for example
  `customer:lead:<leadId>` and `property:lead:<leadId>`;
- every projection contains `sourceCollection=leads`, `sourceLeadId`, and an explicit
  maturity marker such as `lead_projection`;
- no automatic cross-lead deduplication or merge is treated as authoritative;
- one projected customer/property per Lead is the safe compatibility assumption;
- edits continue through the existing Lead/case command owner;
- contact fields are capability-filtered and can be masked for profiles that need
  only operational context;
- customer/property indexes may aggregate cases for navigation only when matches are
  labelled as probable, not canonical identity.

A canonical Customer/Property migration is a separate future ADR requiring identity
rules, collision handling, reversible backfill, relationship migration, retention,
audit lineage, and read parity. It is not implicitly authorized by the new IA.

### Consequences

- Positive: the user gets a coherent customer/property mental model without a risky
  big-bang schema change.
- Positive: existing Lead ownership, retention, and APIs remain truthful during UI
  consolidation.
- Cost: apparent duplicates can remain and multi-property views are limited until a
  canonical migration is deliberately designed.
- Constraint: UI copy must not claim a global “single customer record” or authoritative
  property ownership from heuristic matches.

### Validation gate

1. Projection contract tests cover missing contact, missing/legacy address, duplicate
   names, shared email/phone, changed communication address, and archived/trashed Lead.
2. Stable projection IDs and source lineage survive sort, search, pagination, and deep
   links.
3. Capability/redaction tests cover each target UI profile.
4. V2 case values and projection values pass shadow-read parity on representative
   records.
5. Every projected edit deep-links to or invokes the existing canonical Lead command;
   no new projection write path exists.
6. A future migration cannot proceed until backfill, collision report, rollback, and
   old-ID resolution are separately approved.

### Rollback / fallback

Remove the Customer/Property index/navigation modules and continue showing the same
Lead fields inside the case workspace. No data rollback is required because the
projections do not own writes or create canonical records.

## ADR-F0-008 — Action-specific asynchronous loading and feedback

**Status:** `accepted-by-GO`

### Context

Current components often implement their own `busy` boolean and change button text,
while some worker actions additionally use `aria-busy`. The patterns are not uniform,
route navigation has no shared pending contract, no route-level `loading.tsx` was
found under `src/app`, and `router.refresh()` can leave old content visible without a
clear statement of whether it is still current. RF, uploads, document generation,
email, and operational retries can take long enough that ambiguous feedback causes
double clicks, navigation away, or false success assumptions.

### Decision

Every unified-admin navigation or command that does not present its visual result
within 150 ms must show localized, action-specific feedback in the same context.

The common feedback state is:

```ts
type AsyncFeedback =
  | { state: 'idle' }
  | { state: 'loading'; actionKey: string; startedAt: string }
  | { state: 'succeeded'; messageKey: string; correlationId?: string }
  | { state: 'failed'; messageKey: string; retryable: boolean; correlationId?: string }
  | { state: 'conflict'; messageKey: string; recoveryHref?: string; correlationId?: string }
```

Rules:

- use concrete labels such as “Opening RF measurement”, “Checking snapshot hash”,
  “Creating quote draft”, or “Uploading photo”, not only “Loading”;
- mark the affected region with `aria-busy`, announce meaningful state changes through
  an appropriate live region, and preserve keyboard focus;
- prevent duplicate submit while keeping cancel/back available when safe;
- do not show old data as current after a mutation; label it as refreshing or replace
  it with a contextual pending state;
- success is shown only after the server confirms the durable result; queued side
  effects are labelled queued, not sent/completed;
- failure preserves safe user input and provides retry, correction, or return path;
- conflict explains what changed and offers reload/compare/reapply as supported;
- navigation, command, upload, long job, and reconnect states use the same semantics,
  though their visual component may differ.

### Consequences

- Positive: operators know what is happening and avoid duplicate actions or premature
  abandonment.
- Positive: async behavior becomes testable for accessibility and error recovery.
- Cost: existing local `busy` implementations need adapters before replacement, and
  action-specific localization must be maintained.
- Constraint: a spinner or disabled button alone does not satisfy the contract.

### Validation gate

1. Component tests cover idle, delayed loading, success, queued, failure, retryable,
   non-retryable, stale conflict, and navigation-away cases.
2. Fake timers/network delay prove feedback is visible by 150 ms and cannot flash an
   incorrect success state.
3. Double-click tests produce one command/idempotency claim.
4. Screen-reader and keyboard tests verify live announcements, `aria-busy`, focus, and
   preserved form state.
5. Slow RF/provider, PDF, email, photo upload, document load, and `router.refresh()`
   scenarios have action-specific labels and recovery.
6. The server response distinguishes durable completion from queued side effects.

### Rollback / fallback

Retain the existing component-specific busy label and disable the new feedback shell
for that module. The fallback must still prevent duplicate submission and must not
convert queued or failed server work into success.

## ADR-F0-009 — RF discoverability and exact-hash RF → RoofMeasurement → quote draft

**Status:** `accepted-by-GO` for discoverability and the immutable integration
boundary; `proposed` for RF One Card Phase E command implementation until RF-owner,
test, migration, UAT, and separate release gates pass

### Context

RF is currently easiest to find through protected Preview/diagnostic navigation, not
as the obvious next step from a real case. At persistence level, RF already has an
append-only snapshot repository and command ledger with snapshot ID, revision, hash,
state, command hash, and idempotency key. Approved RoofMeasurements and Quotes are
versioned and protected from overwrite, but RoofMeasurement does not yet contain the
exact RF snapshot identity chain required to prove which RF result reached a quote.

The separate RF One Card plan deliberately gates approval and add-to-offer work in
Phase E. This unified-admin ADR must preserve that ownership and cannot implement the
bridge indirectly.

### Decision

#### A. Discoverability

The normal operator path starts in a concrete case:

`Case NextAction → Open/continue measurement → RF workbench`

- It takes one deliberate selection from the case's NextAction card.
- The deep link carries stable case identity, exact measurement/RF context when known,
  and a validated `returnTo` back to the same case context.
- RF UAT, capability boards, and “module status” pages remain diagnostic surfaces and
  are not part of the daily operator journey.
- The RF workbench uses the same deterministic action and blocker explanation as the
  case; it cannot invent a parallel workflow state.

#### B. Exact-hash commercial bridge

The only permitted add-to-offer input is an approved, persisted RF snapshot. The
server command receives or derives:

- `caseId` and expected `caseRevision`;
- `rfSnapshotId`, RF revision, schema version, and client-claimed hash;
- approval actor/time and evidence/provenance references;
- current pricing and terms versions;
- idempotency key and correlation ID.

The server reloads the stored snapshot, canonicalizes it under the recorded schema,
recomputes the hash, and requires an exact match. It then:

1. validates actor capability/scope, case revision, RF approval/state, evidence,
   critical blockers, and current commercial basis;
2. creates a new immutable RoofMeasurement version that records RF snapshot ID,
   revision, schema, snapshot hash, input hash, evidence/provenance, and `supersedes`
   where applicable;
3. passes only the persisted RoofMeasurement ID/version/input hash and approved
   pricing/terms basis into the existing quote engine;
4. creates a new quote **draft** version;
5. records one correlated command-ledger/audit chain and returns the created IDs,
   versions, hashes, and `review_quote` next action.

The command does not approve, issue, send, sign, or mutate an earlier quote. A newer
RF calculation creates a new snapshot and can only produce a new measurement/quote
version. If atomic multi-record persistence is unavailable, the RF command ledger plus
an OperationalJob must provide resumable or compensating behavior; partial success is
never labelled complete.

### Consequences

- Positive: the operator can reach RF without knowing a technical URL and can create a
  commercial draft without copying measurements by hand.
- Positive: every quote can prove its exact RF, measurement, evidence, pricing, and
  terms lineage.
- Cost: an additive measurement lineage migration, command orchestration, and
  cross-domain contract tests are required.
- Constraint: Preview results, blocked/review-only snapshots, stale revisions, and hash
  mismatches fail closed.
- Constraint: acceptance of this ADR is not acceptance of RF Phase E implementation
  or Production activation.

### Validation gate

Discoverability gate:

1. An operator with no technical URL or instruction reaches the correct RF workbench
   from a representative case in one selection and returns in one selection.
2. Case ID, snapshot/measurement context, locale, and return target survive refresh,
   authentication renewal, and deep linking.
3. Diagnostic/UAT routes are absent from ordinary primary actions.

Bridge gate:

1. RF owner approves the Phase E command contract and additive lineage schema.
2. Unit/contract tests cover exact hash, canonicalization stability, schema version,
   approval state, evidence, capability, case revision, blocker, price version, and
   terms version.
3. Duplicate request returns the same measurement/quote result; same key with changed
   payload conflicts.
4. Partial write/job failure can resume or compensate without duplicate quote drafts.
5. Integration/E2E proves `RF snapshot → RoofMeasurement → price calculation → quote
   draft → history` and proves no approve/send/customer side effect.
6. New RF snapshot leaves the old measurement and quote unchanged and offers an
   explicit new-version path.
7. Owner UAT, feature flag, monitoring, migration rollback, and a separate release GO
   pass before any Production use.

### Rollback / fallback

Keep the Phase E feature gate off. From the case, fall back to the current canonical
measurement review workflow with an explicit explanation that RF add-to-offer is not
available. Existing measurement and quote versions remain unchanged. Never fall back
to copying raw RF metrics from the browser or accepting a client hash without server
recalculation.

## ADR-F0-010 — Mobile offline threat-model gate

**Status:** `accepted-by-GO`

### Context

The worker portal is mobile-oriented and already preserves non-file form drafts in
browser `localStorage`, submits state transitions and photos directly to server APIs,
shows some busy/retry feedback, and refreshes the route. This is useful online draft
recovery but is not a complete offline model. No service worker, encrypted offline
store, background sync, offline command ledger, remote revoke, or explicit
server/client conflict protocol was found.

Expanding the current draft behavior into PWA/offline mode could place customer,
property, job, safety, financial, and image data on lost/shared devices and could
create false success or duplicate/stale transitions after reconnect.

### Decision

No offline/PWA command execution, broad offline dataset, or background upload ships
until an owner-approved threat model and data-flow design pass the F4 gate.

The threat model must decide and document:

- which minimum records/fields/media are available offline per assigned worker;
- data classification, lawful basis, device storage, encryption, key/session binding,
  expiry, logout wipe, account deactivation, and remote revoke;
- shared/lost/rooted device assumptions and supported platform/browser boundaries;
- screenshot/export/download policy for sensitive evidence;
- command envelope with command ID, idempotency key, expected server revision,
  client timestamp, device/session identity, payload hash, and evidence references;
- pending, syncing, failed, conflict, compensated, and confirmed semantics;
- server-wins/client-wins/manual conflict rules per field and transition;
- ordering and dependency rules for status changes, checklists, and photo uploads;
- clock drift, duplicate reconnect, partial upload, app kill, cache eviction, storage
  quota, and long-disconnected-device behavior;
- operator-visible sync age, item-level pending state, retry count, and supervisor
  handoff.

Until then, “saved draft” means only a local draft and must not be presented as a
registered server event. “Success” requires durable server acknowledgement. Current
`localStorage` scope must not be widened as a shortcut to offline support.

### Consequences

- Positive: offline capability is treated as a security and distributed-state feature,
  not a visual toggle.
- Positive: false completion, duplicated visits/uploads, and silent last-write-wins
  behavior are explicitly prevented.
- Cost: offline delivery is delayed until security, storage, sync, conflict, and
  operational support are designed and tested.
- Constraint: desktop/mobile continuity before that gate uses the same server states
  and responsive UI, but remains online for authoritative mutations.

### Validation gate

1. Approved threat model includes data-flow and attack trees for lost/shared device,
   stolen session, cache extraction, over-broad sync, replay, stale command, malicious
   file, and remote deactivation.
2. Offline profile contains only assigned work and minimum required fields/media, with
   measured storage and expiry limits.
3. Encryption/key management, logout/deactivation wipe, and remote revoke are proven
   on every supported platform.
4. Reconnect tests cover duplicate command, out-of-order commands, dispatcher edit,
   stale revision, partial photo upload, retry after process kill, expired assignment,
   and manual conflict resolution.
5. Every item shows `synced | pending | offline | conflict | failed`; no aggregate icon
   hides an individual failed transition.
6. Audit records original client time, authoritative server time, actor, source,
   command ID, and final outcome.
7. Accessibility, field UAT, support runbook, data-removal procedure, telemetry, and
   feature-gate rollback are signed before Production activation.

### Rollback / fallback

Disable offline/PWA and background-sync flags and return to the current online worker
flow. Preserve unsent user input only within the reviewed local-draft policy; label it
local, clear it according to the approved session/expiry rules, and require explicit
server retry. Never replay queued commands through an unaudited generic fetch loop.

## 4. Cross-ADR implementation order

These decisions deliberately constrain later phases in this order:

1. F0 completes the route/mutation/action/capability inventory and validation matrices.
2. ADR-F0-001 and ADR-F0-002 establish the one-shell and URL foundation.
3. ADR-F0-003 defines the shared vocabulary/read contract.
4. ADR-F0-004 and ADR-F0-005 establish enforceable command/capability boundaries.
5. ADR-F0-006 and ADR-F0-007 provide safe history and entity projections.
6. ADR-F0-008 provides consistent pending/error/conflict behavior before long-running
   verticals are exposed.
7. ADR-F0-009 may connect RF to commerce only after its separate RF Phase E gate.
8. ADR-F0-010 blocks offline activation until the F4 threat model and sync protocol
   pass.

No later ADR may use UI parity, visual polish, or a hidden button as evidence that a
server, privacy, immutability, or offline safety gate has passed.

## 5. F0 completion evidence still required

This register records the decisions but does not by itself close F0. The following
evidence remains required by the holistic plan:

- machine-readable route, collection, mutation-owner, action, transition, role, and
  audit-event inventory;
- full current `CaseNextActionKind` and cross-domain transition/capability matrix;
- canonical/legacy shadow-read parity samples;
- instrumented click/time/RF-discoverability baseline;
- responsive screenshot baseline at 1440, 1024, 768, and 375 px;
- isolated dependency restore plus current lint, typecheck, unit/API, migration, build,
  and browser baseline;
- named owners for every unresolved module gate and proposed decision.

Unanswered items block only the affected module. They do not authorize assumptions,
Production writes, or silent weakening of the accepted safety boundaries.

## 6. Explicit non-authorization

Creating this ADR register authorizes no application implementation. In particular it
does not authorize:

- creating a new shell, route alias, redirect, or Payload relocation;
- changing roles, capabilities, collections, migrations, or stored customer data;
- replacing existing command handlers or enabling Admin Next mutations;
- persisting a new audit diff format;
- creating canonical Customer or Property records;
- implementing or enabling the RF Phase E add-to-offer command;
- enabling PWA/offline storage, command queues, background sync, or broader local data;
- deploying, merging, changing Production flags, or running a Production migration.

A later implementation step must cite the relevant ADR, pass its validation gate, and
receive the phase/release authority required by the source plan.
