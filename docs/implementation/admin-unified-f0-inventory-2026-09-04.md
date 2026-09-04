# Unified Admin F0 inventory — 2026-09-04

## 1. Scope and audit contract

This is a static, read-only inventory of the repository at commit `4d03b941cfc9b895113f674540b1ef811d165f4e`. The audited workspace root is `C:\Users\Fornyelsegruppen\.codex\worktrees\f42d\takfornyelse-production-a8799d5`.

Only this document was added. Application code, configuration, migrations, production data and files owned by other F0 workstreams were not changed. No runtime environment, database, external provider or deployed route was exercised, and no test suite was run. A route or control marked below is therefore verified in source, not in a live environment.

### Status vocabulary

| Status | Meaning in this inventory |
|---|---|
| `verified` | The route, collection or control is directly present in source and its relevant guard/behavior is traceable. |
| `partial` | A control or capability exists only for some actions, relies on a weak replay key, has non-atomic side effects, or lacks an operator-facing surface. |
| `missing` | No implementation was found after repository-wide source search. |
| `gated` | The implementation exists but is restricted by role, feature flag, rollout state or deployment environment; runtime activation was not verified. |

### System-wide authorization and command caveats

- Internal roles are only `admin` and `worker`; both must be active. The common access predicates are at `src/payload/access/roles.ts:3-36`. Assigned-worker scoping is at `src/payload/access/roles.ts:61-69`.
- All custom Admin V2 pages inherit an administrator requirement from `src/app/(admin-shell)/admin-v2/layout.tsx:14-16`. Admin Next inherits the same requirement and a rollout fallback from `src/app/(admin-shell)/admin-next-preview/layout.tsx:8-12`.
- The case-command layer implements idempotency through an immutable audit-event lookup, optimistic `caseRevision`, and an audit write at `src/lib/cases/case-command.ts:34-85`. However, `updateCaseState` bypasses all of those controls unless `FEATURE_CASE_STATE_ENGINE_V2 === "true"`: `src/lib/cases/case-command.ts:88-95`. Any mutation relying only on this wrapper is therefore marked `gated` or `partial` below.
- Payload REST access is collection-driven. The catch-all exports all REST verbs at `src/app/(payload)/api/[...slug]/route.ts:1-12`; individual collection access definitions remain the security boundary.
- Opaque customer tokens are hashed, expire, can be revoked and can be single-use: `src/lib/security/opaque-token.ts:12-58`. Quote and change token resolution is implemented at `src/lib/quotes/customer-access.ts:19-27` and `src/lib/change-agreements/customer-access.ts:15-23`.

## 2. Route inventory

### 2.1 Custom Admin V2 pages

All rows below are `verified` as source routes and administrator-only through the shared layout. The route-specific purpose is included so that F0 can preserve the current production capability during navigation consolidation.

| Route | Purpose / current behavior | Status | Evidence |
|---|---|---:|---|
| `/admin-v2` | Dashboard, search and action queues. | `verified` | `src/app/(admin-shell)/admin-v2/page.tsx:60`; queue definitions `src/app/(admin-shell)/admin-v2/page.tsx:21-34`. |
| `/admin-v2/cases` | Case list with query, state, action, worker and date filters. | `verified` | `src/app/(admin-shell)/admin-v2/cases/page.tsx:66`; filters `src/app/(admin-shell)/admin-v2/cases/page.tsx:20-64`. |
| `/admin-v2/cases/[id]` | Unified case workspace: intake, communication, measurement, commercial package, contract, work, changes, documents, invoices, warranty and lifecycle. | `verified` | `src/app/(admin-shell)/admin-v2/cases/[id]/page.tsx:725`; integrated load `src/app/(admin-shell)/admin-v2/cases/[id]/page.tsx:730-758`. |
| `/admin-v2/contract-requests` | Customer withdrawal/change/cancellation request queue and decision workflow. | `verified` | `src/app/(admin-shell)/admin-v2/contract-requests/page.tsx:27`; status modes `src/app/(admin-shell)/admin-v2/contract-requests/page.tsx:36-40`. |
| `/admin-v2/offers` | Quote list with `all`, `draft`, `sent` views; rows deep-link to a case. | `partial` | `src/app/(admin-shell)/admin-v2/offers/page.tsx:12-16`; generic loader `src/lib/admin-v2/operational-lists.ts:22-45`. |
| `/admin-v2/contracts` | Contract list with `all`, `draft`, `signed` views; rows deep-link to a case. | `partial` | `src/app/(admin-shell)/admin-v2/contracts/page.tsx:12-16`. |
| `/admin-v2/work` | Work-order list with `all`, `unassigned`, `assigned`, `active`, `finished` views. | `verified` | `src/app/(admin-shell)/admin-v2/work/page.tsx:12-17`. |
| `/admin-v2/documents` | Cross-collection document register, filters and monthly accounting export. | `partial` | `src/app/(admin-shell)/admin-v2/documents/page.tsx:22-50`; document aggregation `src/lib/admin-v2/documents.ts:37-159`. |
| `/admin-v2/blog` | Up to 200 draft-aware posts and manual generation entry point. | `partial` | `src/app/(admin-shell)/admin-v2/blog/page.tsx:11`. |
| `/admin-v2/blog/[id]` | Blog editor, QA/review and public preview. | `verified` | `src/app/(admin-shell)/admin-v2/blog/[id]/page.tsx:16-36`. |
| `/admin-v2/employees` | Administrator-managed internal accounts. | `verified` | `src/app/(admin-shell)/admin-v2/employees/page.tsx:14-19`. |
| `/admin-v2/archive` | Archived/trash case search and lifecycle actions. | `verified` | `src/app/(admin-shell)/admin-v2/archive/page.tsx:15-35`. |
| `/admin-v2/settings` | Site settings, platform health/release gate and production contract terms. | `verified` | `src/app/(admin-shell)/admin-v2/settings/page.tsx:17-88`. |
| `/admin-v2/next-preview` | Admin Next capability/rollout board. | `gated` | `src/app/(admin-shell)/admin-v2/next-preview/page.tsx:7-14`. |

Admin V2 has a desktop sidebar and mobile `<details>` navigation in `src/app/(admin-shell)/admin-v2/layout.tsx:14-68`. Its 11 navigation destinations are declared at `src/components/admin-v2/admin-navigation.tsx:8-20`.

### 2.2 Admin Next and preview-only pages

| Route | Current data source / behavior | Status | Evidence |
|---|---|---:|---|
| `/admin-next-preview/today` | Canonical adapter only in Vercel preview; otherwise fixture or legacy fallback. | `gated` | `src/app/(admin-shell)/admin-next-preview/today/page.tsx:14-29`. |
| `/admin-next-preview/cases/[caseId]` | Preview case workspace; canonical source only in Vercel preview. Primary CTA returns to V2. | `gated` | `src/app/(admin-shell)/admin-next-preview/cases/[caseId]/page.tsx:14-41`; adapter CTA `src/lib/admin-next/case-read-adapter.ts:147-150`. |
| `/admin-next-preview/cases/[caseId]/measurements/[measurementId]` | R4/Roof Fusion measurement review through preview resolver and snapshot repository. | `gated` | `src/app/(admin-shell)/admin-next-preview/cases/[caseId]/measurements/[measurementId]/page.tsx:26-71`. |
| `/admin-next-preview/cases/[caseId]/documents/preflight` | Document preflight preview; capability registry still calls the module fixture-only. | `gated` | `src/app/(admin-shell)/admin-next-preview/cases/[caseId]/documents/preflight/page.tsx:11-30`; `src/lib/admin-next/capability-registry.ts:167-176`. |
| `/admin-next-preview/roof-fusion/uat` | Vercel-preview-only Roof Fusion golden lifecycle, real-address lookup and height analysis server actions. | `gated` | Environment and role gate `src/app/(admin-shell)/admin-next-preview/roof-fusion/uat/page.tsx:65-73`; server actions `src/app/(admin-shell)/admin-next-preview/roof-fusion/uat/page.tsx:75-99`, `:108-170`, `:174-263`. |
| `/worker-next-preview/visits/[visitId]` | Worker-facing Admin Next field-visit adapter; canonical only in Vercel preview. | `gated` | `src/app/(worker-shell)/(protected)/worker-next-preview/visits/[visitId]/page.tsx:18-49`. |

Admin Next is not a production mutation owner. Every registered module has `mutationPolicy: "legacy_only"` at `src/lib/admin-next/capability-registry.ts:132-188`. Navigation is also incomplete: the “Cases” link points to Today, and Customers, Work and Documents bridge to V2 at `src/components/admin-next/admin-next-shell.tsx:83-90`.

### 2.3 Ungated UI fixture pages

These routes contain synthetic visual fixtures. Their shared layout sets `noindex`, but no authentication, deployment-environment or feature gate was found in `src/app/(ui-fixtures)/layout.tsx:4-20`.

| Route | Status | Evidence |
|---|---:|---|
| `/admin-next-fixture` | `partial` | `src/app/(ui-fixtures)/admin-next-fixture/page.tsx:8`. |
| `/admin-next-case-fixture` | `partial` | `src/app/(ui-fixtures)/admin-next-case-fixture/page.tsx:6`. |
| `/admin-next-r4-fixture` | `partial` | `src/app/(ui-fixtures)/admin-next-r4-fixture/page.tsx:6`. |
| `/admin-next-document-preflight-fixture` | `partial` | `src/app/(ui-fixtures)/admin-next-document-preflight-fixture/page.tsx:6`. |
| `/admin-next-field-visit-fixture` | `partial` | `src/app/(ui-fixtures)/admin-next-field-visit-fixture/page.tsx:8`. |

### 2.4 Payload admin and preview routes

| Route | Purpose | Status | Evidence |
|---|---|---:|---|
| `/admin/[[...segments]]` | Payload admin application and collection/global CRUD according to each access policy. | `verified` | `src/app/(payload)/admin/[[...segments]]/page.tsx:20-23`. |
| `/api/[...slug]` | Payload REST GET/POST/DELETE/PATCH/PUT/OPTIONS catch-all. | `verified` | `src/app/(payload)/api/[...slug]/route.ts:7-12`. |
| `/api/preview` | Enables draft mode using `PREVIEW_SECRET` or an authenticated admin and sanitizes the redirect path. | `verified` | `src/app/api/preview/route.ts:22-58`. |
| `/api/exit-preview` | Disables the caller's draft-mode cookie and redirects to locale root. | `verified` | `src/app/api/exit-preview/route.ts:6-14`. |

Payload injects a custom operational dashboard before its default dashboard at `src/payload.config.ts:141-145`. It exposes counts, health, SEO tooling and technical collection links in `src/app/(payload)/admin/components/AdminDashboard.tsx:29-68` and `:126-202`. This is a separate operator experience from Admin V2.

### 2.5 Worker pages

| Route | Authorization and purpose | Status | Evidence |
|---|---|---:|---|
| `/user/login` | Public login page; authenticated internal users are redirected to `/user`. | `verified` | `src/app/(worker-shell)/(public)/user/login/page.tsx:11-12`. |
| `/user` | Feature-gated internal page; lists assigned work grouped into today/upcoming/attention. | `gated` | `src/app/(worker-shell)/(protected)/user/page.tsx:13-51`. |
| `/user/arbeid/[id]` | Feature-gated internal work detail. Workers are scoped to their assignment; admins may inspect any work order. Contract/document hash is checked before display. | `gated` | `src/app/(worker-shell)/(protected)/user/arbeid/[id]/page.tsx:22-44`. |

The portal shell is feature-gated and authenticated at `src/app/(worker-shell)/(protected)/user/layout.tsx:11-14`. The gate reads `FEATURE_WORKER_PORTAL`: `src/lib/worker-portal/gate.ts:7` and `src/lib/platform/features.ts:28`.

### 2.6 Customer and public-site pages

| Route | Purpose / access | Status | Evidence |
|---|---|---:|---|
| `/tilbud/[token]` | Personal quote, questions, decline, signature and contract-request UI through an opaque quote token. | `verified` | `src/app/tilbud/[token]/page.tsx:21-40`; token resolver `src/lib/quotes/customer-view.ts:5-7`. |
| `/endring/[token]` | Customer change-agreement acceptance/decline through an opaque token. | `verified` | `src/app/endring/[token]/page.tsx:10`; resolver `src/lib/change-agreements/customer-view.ts:7`. |
| `/kontakt/[token]` | Single-use manual-contact email recovery. | `verified` | `src/app/kontakt/[token]/page.tsx:21-29`; token resolution/consumption `src/lib/manual-contact/recovery.ts:63-145`. |
| `/henvendelse/[id]?token=...` | Read-only submitted enquiry and photo gallery through a signed lead-photo token. | `verified` | `src/app/henvendelse/[id]/page.tsx:19-35`, `:53-65`. |
| `/[locale]` | Localized public home. | `verified` | `src/app/(site)/[locale]/page.tsx:47`. |
| `/[locale]/[slug]` | Localized CMS page. | `verified` | `src/app/(site)/[locale]/[slug]/page.tsx:112`. |
| `/[locale]/blogg` | Public blog index. | `verified` | `src/app/(site)/[locale]/blogg/page.tsx:131`. |
| `/[locale]/blogg/[slug]` | Public blog article. | `verified` | `src/app/(site)/[locale]/blogg/[slug]/page.tsx:116`. |
| `/[locale]/angreskjema` | Withdrawal form/instructions. | `verified` | `src/app/(site)/[locale]/angreskjema/page.tsx:41`. |
| `/[locale]/kundeomtaler` | Customer reviews page. | `verified` | `src/app/(site)/[locale]/kundeomtaler/page.tsx:105`. |
| `/[locale]/personvern` | Privacy page. | `verified` | `src/app/(site)/[locale]/personvern/page.tsx:132`. |
| `/[locale]/takk` | Lead submission thank-you page. | `verified` | `src/app/(site)/[locale]/takk/page.tsx:28`. |

## 3. Registered Payload data model

The authoritative registration list is `src/payload.config.ts:162-196`. “Access” below summarizes the collection's external Payload policy; trusted server code frequently uses `overrideAccess: true` after its own route/domain checks.

| Registered slug | Domain purpose | Payload access / visibility | Status | Evidence |
|---|---|---|---:|---|
| `users` | Admin and worker accounts, role, language, active/security state. | Admin-only CRUD. | `verified` | `src/payload/collections/Users.ts:12`; access `:39-44`. |
| `media` | Public CMS/blog image library and attribution metadata. | Public read; admin create/delete/update. | `verified` | `src/payload/collections/Media.ts:5-16`. |
| `services` | Published service content. | Published or authenticated read; admin writes. | `verified` | `src/payload/collections/Services.ts:9-20`. |
| `projects` | Published project/case-study content. | Published or authenticated read; admin writes. | `verified` | `src/payload/collections/Projects.ts:9-20`. |
| `products` | Published product content. | Published or authenticated read; admin writes. | `verified` | `src/payload/collections/Products.ts:9-19`. |
| `faq` | Published FAQ content. | Published or authenticated read; admin writes. | `verified` | `src/payload/collections/Faq.ts:9-19`. |
| `pages` | Localized CMS pages. | Published or authenticated read; admin writes. | `verified` | `src/payload/collections/Pages.ts:10-21`. |
| `posts` | Blog/editorial content, quality, source and performance data. | Only fully published posts are public; admin writes. | `verified` | `src/payload/collections/Posts.ts:16-45`. |
| `redirects` | Site redirect rules. | Active internal read; admin writes. | `verified` | `src/payload/collections/Redirects.ts:20-32`. |
| `leads` | Case aggregate root, customer/contact/property fields and pipeline state. | Admin-only collection access; selected fields system-managed. | `verified` | `src/payload/collections/Leads.ts:88-110`; case/record state `:207-273`. |
| `messages` | Inbound/outbound drafts, delivery state and communication evidence. | Admin-only CRUD; system-managed delivery/idempotency fields. | `verified` | `src/payload/collections/Messages.ts:7-20`; idempotency/evidence `:89-107`. |
| `roof-measurements` | Legacy production measurement versions, evidence and approval. | Admin-only CRUD. | `verified` | `src/payload/collections/RoofMeasurements.ts:201-223`. |
| `price-rules` | Approved, versioned pricing rules. | Admin-only. | `verified` | `src/payload/collections/PriceRules.ts:25-33`. |
| `price-calculations` | Immutable calculation input/output snapshots. | Admin create/read/delete; update denied. | `verified` | `src/payload/collections/PriceCalculations.ts:5-12`. |
| `quotes` | Versioned offers, snapshots, validity and customer status. | Admin-only. | `verified` | `src/payload/collections/Quotes.ts:37-44`; immutable commercial fields `:53-76`. |
| `contracts` | Versioned contract snapshots, customer/company signatures and documents. | Admin-only. | `verified` | `src/payload/collections/Contracts.ts:63-70`; signature evidence `:77-92`. |
| `change-agreements` | Versioned price/scope changes and customer acceptance. | Admin-only. | `verified` | `src/payload/collections/ChangeAgreements.ts:37-40`; evidence/status `:48-66`. |
| `contract-terms` | Legally reviewed terms versions and production pilot approval. | Admin-only. | `verified` | `src/payload/collections/ContractTerms.ts:27-43`. |
| `work-orders` | Assignment, schedule, worker workflow, precheck, pricing and completion. | Admin writes; admin or assigned worker reads. | `verified` | `src/payload/collections/WorkOrders.ts:134-164`. |
| `invoice-records` | Internal non-booked invoice drafts. | Admin create/read/update; deletion denied. | `verified` | `src/payload/collections/InvoiceRecords.ts:33-56`. |
| `official-invoices` | Imported/confirmed issued invoices, payment and bank check data. | Admin create/read/update; deletion denied. | `verified` | `src/payload/collections/OfficialInvoices.ts:59-92`. |
| `customer-contract-requests` | Customer withdrawal/change/cancellation requests and admin decisions. | Admin create/read/update; deletion denied. | `verified` | `src/payload/collections/CustomerContractRequests.ts:38-47`; unique request fingerprint `:97-113`. |
| `warranties` | Confirmed post-work warranty snapshots/documents. | Admin create/read/update; deletion denied. | `verified` | `src/payload/collections/Warranties.ts:19-37`. |
| `seo-topics` | Topic/search-signal queue and aggregate performance signals. | Admin-only. | `verified` | `src/payload/collections/SeoTopics.ts:5-24`. |
| `seo-runs` | SEO generation-run status and sanitized diagnostics. | Admin-only. | `verified` | `src/payload/collections/SeoRuns.ts:5-18`. |
| `audit-events` | Immutable central audit trail with actor, action, correlation and before/after hashes. | Admin create/read; update/delete denied. | `verified` | `src/payload/collections/AuditEvents.ts:5-25`; fields `:27-54`. |
| `operational-jobs` | Durable async/retry/attention work queue. | Admin-only CRUD. | `verified` | `src/payload/collections/OperationalJobs.ts:5-26`. |
| `access-tokens` | Hashed customer access and recovery tokens. | Admin create/read/update; deletion denied. | `verified` | `src/payload/collections/AccessTokens.ts:5-25`; expiry/revocation fields `:34-45`. |
| `private-media` | Evidence, signatures, invoices, work photos and other protected files. | Hidden; admin read; external create/update/delete denied. Trusted storage service required. | `gated` | `src/payload/collections/PrivateMedia.ts:5-21`. |
| `roof-fusion-snapshots` | Append-only canonical Roof Fusion snapshots. | Hidden; all external access denied; trusted repository only. | `gated` | `src/payload/collections/RoofFusion.ts:28-37`, `:57-70`. |
| `roof-fusion-commands` | Append-only Roof Fusion command ledger. | Hidden; all external access denied; trusted repository only. | `gated` | `src/payload/collections/RoofFusion.ts:74-101`. |
| `roof-fusion-workbench-drafts` | Append-only preview workbench drafts with revision/hash/idempotency. | Hidden; all external access denied; trusted repository only. | `gated` | `src/payload/collections/RoofFusionWorkbenchDrafts.ts:25-48`. |
| global `site-settings` | Public site content/settings and navigation. | Published/authenticated read; admin update. | `verified` | Registration `src/payload.config.ts:196`; definition `src/payload/collections/SiteSettings.ts:6-16`. |

No `customers`, `clients`, `properties` or `objects` collection is registered. Customer and property data are fields on `leads`: `src/payload/collections/Leads.ts:114-195`. Admin Next also declares `leads` as the canonical source for Customer and Property: `src/lib/admin-next/capability-registry.ts:36-50`.

## 4. API route inventory

### 4.1 Administrator API

Unless noted otherwise, each route authenticates with Payload and explicitly requires `userIsAdmin`. “Mutation control” is a route-level summary; the detailed domain-control matrix follows in section 5.

| Endpoint | Method(s) | Purpose | Status | Evidence |
|---|---|---|---:|---|
| `/api/admin/blob` | GET | Read an allow-listed private Vercel Blob URL. | `verified` | `src/app/api/admin/blob/route.ts:11-64`; admin/host checks `:13-49`. |
| `/api/admin/media/[id]` | GET | Read private-media by ID. | `verified` | `src/app/api/admin/media/[id]/route.ts:10-19`. |
| `/api/admin/leads/[id]` | GET, POST | Load a case action context; execute reply/package/message/intake/review/measurement/close actions. | `partial` | `src/app/api/admin/leads/[id]/route.ts:227`, `:261`; action schema `:69-139`. |
| `/api/admin/leads/[id]/photo` | GET | Stream an authorized lead photo. | `verified` | `src/app/api/admin/leads/[id]/photo/route.ts:23-52`. |
| `/api/admin/leads/[id]/lifecycle` | POST | Archive, trash, restore or purge. | `partial` | `src/app/api/admin/leads/[id]/lifecycle/route.ts:11-67`. |
| `/api/admin/leads/[id]/commercial-package` | POST | Idempotently rebuild price calculation, quote and contract package. | `verified` | `src/app/api/admin/leads/[id]/commercial-package/route.ts:29-91`. |
| `/api/admin/measurements` | GET, POST | Lookup candidates and create visual/manual measurement versions. | `partial` | `src/app/api/admin/measurements/route.ts:358`, `:437`; create actions `:48-90`. |
| `/api/admin/measurements/[id]` | POST | Approve, create version, area override or calculate price. | `partial` | `src/app/api/admin/measurements/[id]/route.ts:22-35`, `:67`. |
| `/api/admin/measurements/free-proposal` | POST | Kartverket/OSM building proposal. No durable domain mutation. | `gated` | `src/app/api/admin/measurements/free-proposal/route.ts:22-81`; feature gate `:24`. |
| `/api/admin/measurements/propose` | POST | AI proposal from licensed captured imagery. | `gated` | `src/app/api/admin/measurements/propose/route.ts:45-69`; feature/provider gate `:48-55`. |
| `/api/admin/quotes` | POST | Create quote and contract draft from a calculation. | `partial` | `src/app/api/admin/quotes/route.ts:12-32`. |
| `/api/admin/quotes/[id]` | POST | Approve, issue, regenerate link or revoke. | `partial` | `src/app/api/admin/quotes/[id]/route.ts:18-76`. |
| `/api/admin/quotes/[id]/pdf` | GET | Render/administer quote/contract PDF. | `verified` | `src/app/api/admin/quotes/[id]/pdf/route.ts:10-17`. |
| `/api/admin/contracts/[id]/sign` | POST | Company countersignature and final contract delivery. | `partial` | `src/app/api/admin/contracts/[id]/sign/route.ts:63-368`. |
| `/api/admin/customer-contract-requests/[id]` | POST | Resolve request: close, continue, alternative, follow-up or do-not-contact. | `partial` | `src/app/api/admin/customer-contract-requests/[id]/route.ts:22-40`, `:64-404`. |
| `/api/admin/change-agreements` | POST | Create change-agreement draft for a work order. | `partial` | `src/app/api/admin/change-agreements/route.ts:12-21`. |
| `/api/admin/change-agreements/[id]` | POST | Approve, issue or revoke a change agreement. | `partial` | `src/app/api/admin/change-agreements/[id]/route.ts:12-42`. |
| `/api/admin/change-agreements/[id]/pdf` | GET | Render change-agreement PDF. | `verified` | `src/app/api/admin/change-agreements/[id]/pdf/route.ts:7-14`. |
| `/api/admin/contract-terms/production-pilot` | POST | Activate legally referenced production-pilot terms. | `verified` | `src/app/api/admin/contract-terms/production-pilot/route.ts:9-94`. |
| `/api/admin/work-orders` | POST | Create or reuse work order from fully signed contract; optional plan/notify. | `partial` | `src/app/api/admin/work-orders/route.ts:27-96`. |
| `/api/admin/work-orders/[id]` | PATCH | Save/reassign/reschedule, cancel or notify. | `partial` | `src/app/api/admin/work-orders/[id]/route.ts:16-166`. |
| `/api/admin/work-orders/[id]/complete-review` | POST | Final admin review, completion document and invoice draft. | `partial` | `src/app/api/admin/work-orders/[id]/complete-review/route.ts:10-40`. |
| `/api/admin/work-orders/[id]/completion-communication` | POST | Explicitly dispatch/retry completion communication. | `partial` | `src/app/api/admin/work-orders/[id]/completion-communication/route.ts:13-59`. |
| `/api/admin/invoice-records/[id]` | PATCH | Update internal invoice-draft status/reference/note. | `partial` | `src/app/api/admin/invoice-records/[id]/route.ts:9-29`. |
| `/api/admin/invoice-records/[id]/official-invoice` | POST | Import official invoice PDF and extract review metadata. | `partial` | `src/app/api/admin/invoice-records/[id]/official-invoice/route.ts:19-78`. |
| `/api/admin/official-invoices/[id]` | PATCH | Confirm, send, check bank, record payment or draft reminder. | `partial` | `src/app/api/admin/official-invoices/[id]/route.ts:21-40`, `:62-472`. |
| `/api/admin/official-invoices/export` | GET | Export a confirmed monthly accounting package; records an audit event despite GET. | `partial` | `src/app/api/admin/official-invoices/export/route.ts:24-66`. |
| `/api/admin/messages/[id]/manual-contact` | POST | Prepare or record manual-contact recovery. | `partial` | `src/app/api/admin/messages/[id]/manual-contact/route.ts:14-24`, `:40-175`. |
| `/api/admin/employees` | POST | Create internal employee. | `partial` | `src/app/api/admin/employees/route.ts:9-50`. |
| `/api/admin/employees/[id]` | PATCH, DELETE | Update/deactivate or guarded permanent delete. | `partial` | `src/app/api/admin/employees/[id]/route.ts:53-111`, `:122-187`. |
| `/api/admin/settings` | POST | Update `site-settings` global. | `partial` | `src/app/api/admin/settings/route.ts:9`. |
| `/api/admin/platform-health` | GET | Integration, operational and release-gate health. | `verified` | `src/app/api/admin/platform-health/route.ts:10-32`. |
| `/api/admin/invariants` | GET, POST | GET scans and persists invariant jobs; POST performs safe reconciliation and re-scans. | `partial` | `src/app/api/admin/invariants/route.ts:10-38`. |
| `/api/admin/blog/generate` | POST | Manual AI draft generation. | `gated` | `src/app/api/admin/blog/generate/route.ts:14-47`; AI feature gate `:21-26`. |
| `/api/admin/blog/posts/[id]` | POST | Save, stock image, approve, reject, schedule, publish or regenerate. | `partial` | `src/app/api/admin/blog/posts/[id]/route.ts:22-40`, `:47-291`. |
| `/api/admin/blog/topics` | POST | Import CSV/Search Console signals or seed manual topics. | `partial` | `src/app/api/admin/blog/topics/route.ts:20-49`. |
| `/api/admin/blog/performance` | POST | Refresh attribution, Search Console and content-audit data. | `partial` | `src/app/api/admin/blog/performance/route.ts:15-99`. |
| `/api/admin/roof-fusion/norge-i-bilder-capture` | POST | Persist licensed screenshot evidence. | `gated` | `src/app/api/admin/roof-fusion/norge-i-bilder-capture/route.ts:55-186`. |
| `/api/admin/roof-fusion/workbench-draft` | GET, POST | Load or CAS-append preview workbench draft. | `gated` | `src/app/api/admin/roof-fusion/workbench-draft/route.ts:61-107`, `:115-143`. |
| `/api/admin/roof-fusion/workbench-height-adapter` | POST | Preview height-surface analysis adapter. | `gated` | `src/app/api/admin/roof-fusion/workbench-height-adapter/route.ts:118-186`. |

### 4.2 Worker API

All worker endpoints are gated by the worker feature and use `loadAuthorizedWorkOrder`, which permits an admin or the specifically assigned active worker: `src/lib/work-orders/access.ts:10-15`.

| Endpoint | Method | Purpose | Status | Evidence |
|---|---|---|---:|---|
| `/api/worker/work-orders/[id]` | POST | `on_way`, `arrive`, `begin_precheck`, `submit_precheck`, `start`, `mark_completed`, `submit_documentation`. | `gated` | `src/app/api/worker/work-orders/[id]/route.ts:25-93`, `:133-396`. |
| `/api/worker/work-orders/[id]/photos` | POST | Sanitized/integrity-checked before/after photo upload and work-order attachment. | `gated` | `src/app/api/worker/work-orders/[id]/photos/route.ts:16-62`. |
| `/api/worker/work-orders/[id]/media/[mediaId]` | GET | Read private work media after assignment and ownership verification. | `gated` | `src/app/api/worker/work-orders/[id]/media/[mediaId]/route.ts:11-20`. |
| `/api/worker/work-orders/[id]/lead-photo` | GET | Read customer-submitted photo for an authorized work order. | `gated` | `src/app/api/worker/work-orders/[id]/lead-photo/route.ts:15-28`. |

### 4.3 Customer-token API

| Endpoint | Method(s) | Purpose / authorization | Status | Evidence |
|---|---|---|---:|---|
| `/api/customer/quote/[token]` | GET, POST | Load quote; submit question/decline/sign/cancel request/withdrawal/change request using opaque token plus POST rate limit. | `verified` | Methods `src/app/api/customer/quote/[token]/route.ts:104`, `:143`; actions `:66-102`; token/rate limit `:150-169`. |
| `/api/customer/quote/[token]/pdf` | GET | Return signed or generated contract PDF after quote-token resolution. | `verified` | `src/app/api/customer/quote/[token]/pdf/route.ts:10-18`. |
| `/api/customer/quote/[token]/measurement-evidence` | GET | Return measurement evidence attached to token-authorized quote. | `verified` | `src/app/api/customer/quote/[token]/measurement-evidence/route.ts:9-18`. |
| `/api/customer/change/[token]` | GET, POST | Load and accept/decline a change agreement using opaque token plus POST rate limit. | `verified` | `src/app/api/customer/change/[token]/route.ts:33`, `:66`; token/rate limit `:74-83`. |
| `/api/customer/change/[token]/pdf` | GET | Return accepted or generated change PDF after token resolution. | `verified` | `src/app/api/customer/change/[token]/pdf/route.ts:7-10`. |
| `/api/customer/contact/[token]` | POST | Validate single-use recovery token, update email, resend and consume token. | `verified` | `src/app/api/customer/contact/[token]/route.ts:49-60`, `:85-216`. |

### 4.4 Public lead, user-preference, webhook and scheduled APIs

| Endpoint | Method | Purpose / gate | Status | Evidence |
|---|---|---|---:|---|
| `/api/lead` | POST | Public lead creation with rate limit and Turnstile; schedules receipt/AI processing. | `partial` | `src/app/api/lead/route.ts:122-175`, `:267-409`. |
| `/api/lead/upload-ticket` | POST | Short-lived upload ticket after rate limit and Turnstile. | `verified` | `src/app/api/lead/upload-ticket/route.ts:10-29`. |
| `/api/lead/photo-upload` | POST | Ticket-authorized, sanitized private Blob upload. | `verified` | `src/app/api/lead/photo-upload/route.ts:30-99`. |
| `/api/lead/photos` | PATCH | Append photo URLs to a lead through a signed lead-photo token. | `partial` | `src/app/api/lead/photos/route.ts:17-57`. |
| `/api/lead/photo` | POST | Disabled legacy endpoint; always returns 410. | `gated` | `src/app/api/lead/photo/route.ts:3-14`. |
| `/api/lead/blob` | GET | Token-authorized read of a Blob URL already attached to the lead. | `verified` | `src/app/api/lead/blob/route.ts:13-107`. |
| `/api/user/interface-language` | POST | Set HTTP-only per-browser panel-language cookie. No login is required and no account row is changed. | `verified` | `src/app/api/user/interface-language/route.ts:5-37`. |
| `/api/webhooks/resend` | POST | Signed Resend outbound delivery event webhook. | `verified` | `src/app/api/webhooks/resend/route.ts:5-8`; signature verification `src/lib/messages/resend-webhook-handler.ts:10-42`. |
| `/api/webhooks/resend-inbound` | POST | Signed Resend inbound-email webhook. | `verified` | `src/app/api/webhooks/resend-inbound/route.ts:5-8`; deduplication `src/lib/messages/resend-inbound.ts:37-52`. |
| `/api/cron/operational-jobs` | GET | Cron-secret-authorized invariant scan and durable job processing; automatic communication can be paused. | `gated` | `src/app/api/cron/operational-jobs/route.ts:24-65`; cron auth `src/lib/security/cron-auth.ts:3-14`. |
| `/api/cron/seo-drafts` | GET | Cron-secret and AI-feature-gated SEO draft generation with slot idempotency. | `gated` | `src/app/api/cron/seo-drafts/route.ts:14-42`. |
| `/api/cron/publish-posts` | GET | Cron-secret-authorized scheduled post publication. | `gated` | `src/app/api/cron/publish-posts/route.ts:22-76`. |
| `/api/cron/purge-leads` | GET | Cron-secret-authorized retention purge with legal/data guards. | `gated` | `src/app/api/cron/purge-leads/route.ts:13-58`. |

## 5. Critical mutation ownership and control matrix

The “owner” column identifies the current source module that contains the domain decision, not the desired future owner. A `verified` audit can be either the central `audit-events` collection or, where explicitly stated, an immutable embedded command ledger. A simple `console`/monitoring record is not counted as an audit trail.

| Critical mutation | Current domain owner and entry point | Authorization | Idempotency | Audit | Failure fallback / compensation | Overall |
|---|---|---:|---:|---:|---:|---:|
| Public lead creation | Route/orchestrator `src/app/api/lead/route.ts:122-409`; message/job owner `src/lib/messages/message-engine.ts:278-372`. | `verified` public anti-abuse: rate limit + Turnstile at `src/app/api/lead/route.ts:171-175`. | `missing` no client request key or lead fingerprint was found. | `missing` no central audit event for lead creation in this route. | `partial` lead persistence succeeds independently; AI/email failures are caught and monitored at `src/app/api/lead/route.ts:291-328`, `:365-409`. | `partial` |
| Public lead photo upload and attachment | Upload ticket and image sanitizer in `src/app/api/lead/upload-ticket/route.ts:10-29`, `src/app/api/lead/photo-upload/route.ts:30-99`; attachment `src/app/api/lead/photos/route.ts:17-57`. | `verified` short-lived ticket for upload and signed lead token for attachment. | `partial` merged URL set limits duplicates, but upload itself has no request/digest replay key: `src/app/api/lead/photos/route.ts:42-51`. | `missing` no central audit event. | `partial` unsafe uploads are rejected, but an uploaded Blob can remain unattached if the second call fails. | `partial` |
| Admin case actions and communication drafting/sending | Route action orchestrator `src/app/api/admin/leads/[id]/route.ts:69-139`, `:261-1053`; case owner `src/lib/cases/case-command.ts:40-95`; message owner `src/lib/messages/message-engine.ts:110-173`. | `verified` admin auth at `src/app/api/admin/leads/[id]/route.ts:215-220`. | `partial` message delivery/jobs use unique keys, while several case keys are correlation-derived and the case engine is feature-gated: `src/app/api/admin/leads/[id]/route.ts:680-700`, `:884-901`, `:958-1017`. | `verified` explicit `lead.<action>` audit at `src/app/api/admin/leads/[id]/route.ts:1030-1049`; message state also has durable fields. | `partial` generation/persistence and delivery failures are caught/queued/monitored, but the route coordinates many non-transactional side effects. | `partial` |
| Archive / trash / restore / purge | Lifecycle owner `src/lib/leads/case-lifecycle.ts:107-199`; API `src/app/api/admin/leads/[id]/lifecycle/route.ts:18-67`. | `verified` admin-only and purge requires exact case-number confirmation plus retention/legal guards: `src/lib/leads/case-lifecycle.ts:181-199`. | `partial` correlation-derived key at `src/app/api/admin/leads/[id]/lifecycle/route.ts:30-35`; replay protection is gated by the case engine. | `verified` action and purge-authorization audit at `src/app/api/admin/leads/[id]/lifecycle/route.ts:39-59`. | `partial` open quote/contract/message activity is cancelled before case-state update at `src/lib/leads/case-lifecycle.ts:95-131`; no encompassing transaction was found. Permanent purge has no recovery by design. | `partial` |
| Measurement candidate lookup / AI proposal | Providers and proposal code in `src/app/api/admin/measurements/free-proposal/route.ts:22-81`, `src/app/api/admin/measurements/propose/route.ts:45-247`. | `verified` admin-only. | `missing` proposal job key contains `Date.now()` at `src/app/api/admin/measurements/propose/route.ts:178-183`, so a retry is a new request. | `missing` no central audit event for proposal generation alone. | `verified` explicit address/building/provider failure codes and feature-unavailable response. | `gated` |
| Licensed Norge i bilder capture | Capture owner `src/app/api/admin/roof-fusion/norge-i-bilder-capture/route.ts:55-186`; evidence policy `src/lib/measurements/persist-evidence.ts:57-90`. | `verified` admin, server-bound source metadata and allowed-source validation: route `:65-84`, `:133-145`. | `missing` no stable request replay key found. | `verified` `norge-i-bilder.captured` at `src/app/api/admin/roof-fusion/norge-i-bilder-capture/route.ts:143-149`. | `partial` failures are monitored; no durable request/job claim or explicit media compensation was found in the route. | `gated` |
| Legacy measurement create/manual/candidate selection | Route owner `src/app/api/admin/measurements/route.ts:437-824`; evidence persistence `src/lib/measurements/persist-evidence.ts:91-154`. | `verified` admin auth helper `src/app/api/admin/measurements/route.ts:110-116`; optional expected case revision `:455-468`. | `partial` case update uses a measurement-specific key (`:578-583`), but measurement creation itself has no pre-create request key. | `verified` manual and building-selected events `src/app/api/admin/measurements/route.ts:609-622`, `:774-803`. | `partial` measurement/evidence is deleted if the case update fails (`:592-600` and create helper cleanup `:324-331`); automatic commercial package creation occurs later and is not in the same transaction. | `partial` |
| Measurement approve / new version / area override / price calculation | API/domain orchestration `src/app/api/admin/measurements/[id]/route.ts:22-35`, `:67-465`; evidence verification `src/lib/measurements/persist-evidence.ts:161-272`. | `verified` admin-only `src/app/api/admin/measurements/[id]/route.ts:72-82`. | `missing` no idempotency key or command claim around these four actions. | `verified` separate area, approval, version and price events at `src/app/api/admin/measurements/[id]/route.ts:140-145`, `:208-214`, `:380-386`, `:449-455`. | `partial` version creation deletes generated evidence on failure at `:356-363`; other actions rely on state/hash guards rather than compensation. | `partial` |
| Commercial package rebuild | Request claim owner `src/lib/pricing/commercial-package-request.ts:117-208`; package owner `src/lib/pricing/commercial-package.ts:14`; API `src/app/api/admin/leads/[id]/commercial-package/route.ts:29-91`. | `verified` admin-only and requires expected revision/source quote: schema `src/app/api/admin/leads/[id]/commercial-package/route.ts:16-26`, auth `:33-35`. | `verified` required `Idempotency-Key`, durable claim/replay/processing result at `:36-60`. | `verified` `quote.commercial-package-rebuilt` at `:71-77`. | `verified` failed claims are marked failed at `:90-91`; stale/current commercial guards are inside package owner. | `verified` |
| Quote + contract draft creation from calculation | Quote engine `src/lib/quotes/payload-quote-engine.ts:30-166`; API `src/app/api/admin/quotes/route.ts:12-32`. | `verified` admin-only `src/app/api/admin/quotes/route.ts:13-18`; engine validates approved measurement/rule/legal terms `src/lib/quotes/payload-quote-engine.ts:45-79`. | `missing` version/reference calculation is not a request-level replay claim; concurrent duplicate creation remains possible. | `verified` `quote.draft-created` at `src/app/api/admin/quotes/route.ts:21-28`. | `partial` a created quote is deleted when contract creation fails at `src/lib/quotes/payload-quote-engine.ts:135-164`; no DB transaction was found. | `partial` |
| Quote approve / issue / link regeneration / revoke | API plus commercial guards `src/app/api/admin/quotes/[id]/route.ts:18-76`; issuance/message owner in quote customer-access/message modules. | `verified` admin-only and expected document/current target guards at `src/app/api/admin/quotes/[id]/route.ts:33-65`. | `partial` issue/message paths have durable keys, but approval/revoke command itself has no request key. | `verified` `quote.<action>` at `src/app/api/admin/quotes/[id]/route.ts:72`. | `partial` stale context returns structured 409; multi-quote sibling approval uses `Promise.all` without an encompassing transaction at `:54-63`. | `partial` |
| Customer quote question / decline | Customer quote route `src/app/api/customer/quote/[token]/route.ts:174-420`; message and case-command owners. | `verified` opaque token plus IP/token rate limit `:150-169`. | `verified` question submission digest/unique message key `:187-238`; decline returns idempotent status and uses stable feedback/ack keys `:283-399`. | `partial` case-command audit only when the case-state engine flag is on; no dedicated actor-bearing customer audit event in this route. | `partial` drafting/delivery job failure is monitored and can enter durable retry; customer action itself may already be committed. | `partial` |
| Customer sign quote/contract | Signature/document orchestration `src/app/api/customer/quote/[token]/route.ts:481-735`; document invariants `src/lib/contracts/signing-invariants.ts:71-147`. | `verified` token, rate limit, expected document hash and mandatory consent/signature schema at `src/app/api/customer/quote/[token]/route.ts:90-99`, `:481-574`. | `verified` already-signed detection, uniqueness/state handling and stable receipt/case keys at `:502-508`, `:597-708`. | `partial` case-command audit is feature-gated and actorless; no explicit `contract.customer_sign` central audit event was found in this route. Signature evidence remains stored on the contract. | `verified` temporary signature media is deleted when contract update fails at `:592-604`; receipt delivery is a durable job. | `partial` |
| Customer withdrawal / change-or-cancel request | Request owner `src/lib/contracts/customer-contract-request.ts:24-65`, `:204-430`; entered through quote-token POST at `src/app/api/customer/quote/[token]/route.ts:420-477`. | `verified` existing signed quote token plus request schema and rate limit. | `verified` unique request fingerprint and duplicate return `src/lib/contracts/customer-contract-request.ts:204-212`, `:251-262`, `:322`; model uniqueness `src/payload/collections/CustomerContractRequests.ts:106`. | `verified` `customer.contract_request_received` at `src/lib/contracts/customer-contract-request.ts:418-430`. | `partial` receipt/job and case hold are separate writes; job retry exists, but no encompassing transaction was found. | `partial` |
| Admin contract-request decision | API orchestrator `src/app/api/admin/customer-contract-requests/[id]/route.ts:22-40`, `:64-404`; alternative package owner `src/lib/contracts/contract-change-package.ts:23-59`. | `verified` admin-only `src/app/api/admin/customer-contract-requests/[id]/route.ts:71-79`. | `partial` decision communication uses stable domain key, but case command uses correlation ID at `:273-322`; replay guarantee depends on case-engine flag. | `verified` `customer.contract_request_reviewed` at `:366-372`. | `partial` communication exceptions are monitored/queued at `:303-311`; package and request/case updates are not one transaction. | `partial` |
| Company countersign and final delivery | API/document owner `src/app/api/admin/contracts/[id]/sign/route.ts:63-368`; signing invariants `src/lib/contracts/signing-invariants.ts:71-147`. | `verified` admin-only, current-contract and expected-document-hash guards at `src/app/api/admin/contracts/[id]/sign/route.ts:67-106`. | `verified` already-countersigned replay and stable case/message keys at `:128`, `:248-301`. | `verified` `contract.company_sign` at `:326-332`. | `verified` generated signature/final-document media are deleted on failure at `:345-352`; final delivery has durable message/job handling. | `verified` |
| Change-agreement draft create | Domain engine `src/lib/change-agreements/engine.ts:40-140`; API `src/app/api/admin/change-agreements/route.ts:12-21`. | `verified` admin-only. | `missing` no request idempotency key; engine selects latest existing version but does not claim a request. | `verified` `change-agreement.created` at `src/app/api/admin/change-agreements/route.ts:19`. | `partial` domain guards reject unsafe pricing/scope; no explicit compensation/transaction for partial multi-record creation was found. | `partial` |
| Change approve / issue / revoke | API + engine/customer access `src/app/api/admin/change-agreements/[id]/route.ts:12-42`; `src/lib/change-agreements/engine.ts:169-215`. | `verified` admin-only. | `partial` issued customer message has stable `change-agreement:<id>:v<version>` key at `src/lib/change-agreements/engine.ts:198-210`; approve/revoke command has no request key. | `verified` `change-agreement.<action>` at `src/app/api/admin/change-agreements/[id]/route.ts:40`. | `partial` revoke cancels active tokens/messages/jobs at `:30-37`, but multiple writes are not one transaction. | `partial` |
| Customer accept / decline change agreement | Customer route `src/app/api/customer/change/[token]/route.ts:66-222`; document/evidence owner `src/lib/change-agreements/document.ts:31-59`. | `verified` opaque token and rate limit `src/app/api/customer/change/[token]/route.ts:74-83`. | `verified` terminal-state replay returns and stable acceptance communication key `:89-108`, `:151-203`. | `verified` customer accepted/declined events at `:98-103`, `:173-178`. | `partial` work-order update, token revocation, audit and message job are separate writes; retry is state-idempotent. | `partial` |
| Work-order create from signed contract | Owner `src/lib/work-orders/create.ts:19-55`; API `src/app/api/admin/work-orders/route.ts:27-96`. | `verified` admin-only; fully signed contract/accepted quote/customer-hold and worker-readiness guards at `src/lib/work-orders/create.ts:26-38`. | `verified` one work order per contract is found/reused at `src/lib/work-orders/create.ts:37-38`; model contract relationship is unique at `src/payload/collections/WorkOrders.ts:148`. | `verified` created/reused event at `src/app/api/admin/work-orders/route.ts:59-65`. | `partial` schedule/customer/worker notification failures are caught at `src/app/api/admin/work-orders/route.ts:71-85`; the created order remains valid and notifications use durable jobs. | `partial` |
| Admin work planning / cancel / notify | API owner `src/app/api/admin/work-orders/[id]/route.ts:33-166`; communication owner `src/lib/work-orders/communications.ts:143-181`. | `verified` admin-only `src/app/api/admin/work-orders/[id]/route.ts:37-39`. | `partial` communication jobs/messages use derived keys (`src/lib/work-orders/communications.ts:166-181`), but planning/cancel update has no request replay key. | `verified` notification/cancel/planning events at `src/app/api/admin/work-orders/[id]/route.ts:65-70`, `:86-92`, `:137-143`. | `partial` communication jobs are synced and direct-dispatch errors are caught; data and notification writes are not atomic. | `partial` |
| Worker status, precheck and completion documentation | Workflow/API owner `src/app/api/worker/work-orders/[id]/route.ts:25-93`, `:133-396`; transitions `src/lib/work-orders/workflow.ts:2-28`; precheck `src/lib/work-orders/precheck.ts:31-107`. | `verified` authenticated active admin/assigned worker via `src/lib/work-orders/access.ts:10-15`; worker feature gate. | `missing` no request idempotency key. Status guards reject most duplicate transitions, but this is not replay semantics. | `verified` embedded work timeline and central `work-order.<action>` audit at `src/app/api/worker/work-orders/[id]/route.ts:325-343`. | `partial` invalid transitions/change/HMS/cancellation guards fail closed; communication after a successful state write can fail separately at `:347-368`. | `gated` |
| Worker before/after photo attach | API/private-media owner `src/app/api/worker/work-orders/[id]/photos/route.ts:16-62`. | `verified` feature gate, assignment, phase/status, MIME/size and SHA-256 integrity checks at `:18-40`. | `missing` no upload request/digest deduplication claim; a retried upload creates another media row. | `verified` timeline plus central photo audit at `:49-53`. | `verified` new private media is deleted if work-order attachment fails at `:42-56`. | `gated` |
| Admin completion review, invoice draft and completion certificate | Owner `src/lib/work-orders/completion-review.ts:31-117`; API `src/app/api/admin/work-orders/[id]/complete-review/route.ts:17-40`. | `verified` admin-only and explicit documentation/price confirmations; domain validates photos, totals, contract and accepted change at `src/lib/work-orders/completion-review.ts:34-59`. | `partial` existing invoice/document rows are reused at `:94-107`, but no request key; a completed replay is rejected after status becomes `documented`. | `partial` route audit occurs only after the owner also dispatches communication: `src/app/api/admin/work-orders/[id]/complete-review/route.ts:28-35`. A late delivery exception can leave state/documents changed without that route audit. | `partial` existing artifacts aid retry, but there is no encompassing transaction or cleanup for invoice/document side effects before the work-order update. | `partial` |
| Completion communication retry | Communication owner `src/lib/work-orders/communications.ts:996-1076`; API `src/app/api/admin/work-orders/[id]/completion-communication/route.ts:13-59`. | `verified` admin-only. | `verified` derived completion-message key and duplicate return at `src/lib/work-orders/communications.ts:996-1005`. | `verified` `work-order.completion-communication` at route `:46-52`. | `verified` durable delivery job handles retry/attention. | `verified` |
| Invoice-draft status update | API/model guards `src/app/api/admin/invoice-records/[id]/route.ts:9-29`; `src/payload/collections/InvoiceRecords.ts:1-31`. | `verified` admin-only. | `missing` no request key. | `verified` `invoice-record.status-updated` at route `:27`. | `partial` state transition guard rejects invalid changes; no compensation needed for the single row, but no optimistic revision check exists. | `partial` |
| Official-invoice PDF import/extraction | Import owner `src/app/api/admin/invoice-records/[id]/official-invoice/route.ts:19-78`. | `verified` admin-only. | `verified` original document hash deduplicates imports at `:34-44`. | `verified` `official-invoice.imported` at `:67-74`. | `verified` extraction failure becomes reviewable `failed` metadata at `:44-65`; newly created private media is deleted when collection creation fails at `:77-78`. | `verified` |
| Official-invoice confirm/send/bank/payment/reminder | Finance API `src/app/api/admin/official-invoices/[id]/route.ts:21-40`, `:62-472`; message/job owner. | `verified` admin-only; confirmation and status guards are enforced in route/model. | `partial` send and reminder have stable message keys at `:216-245`, `:296-327`; confirm, bank check and payment have no request replay key, though state/payment guards limit repeats. | `verified` separate metadata, bank, payment, reminder and send events at `:112-118`, `:183-189`, `:276-282`, `:356-362`, `:447-455`. | `partial` delivery is durable; multi-row payment/invoice/possible warranty updates are not wrapped in a visible transaction. | `partial` |
| Manual-contact recovery prepare/record and customer email update | Admin owner `src/app/api/admin/messages/[id]/manual-contact/route.ts:40-175`; customer owner `src/app/api/customer/contact/[token]/route.ts:49-216`; token owner `src/lib/manual-contact/recovery.ts:26-145`. | `verified` admin prepares/records; customer must hold a valid single-use token and is rate-limited. | `verified` active recovery tokens are revoked/replaced; resend message key is deduplicated at `src/app/api/customer/contact/[token]/route.ts:127-159`; token consumption is conditional at `src/lib/manual-contact/recovery.ts:127-145`. | `verified` admin prepare/record events `src/app/api/admin/messages/[id]/manual-contact/route.ts:119-125`, `:170-176`; email update `src/app/api/customer/contact/[token]/route.ts:212-216`. | `partial` customer route falls back to a durable job if immediate resend fails at `src/app/api/customer/contact/[token]/route.ts:180-188`. | `partial` |
| Employee create/update/deactivate/delete | Employee API and input owner `src/app/api/admin/employees/route.ts:9-50`, `src/app/api/admin/employees/[id]/route.ts:53-187`; input schemas `src/lib/employees/employee-input.ts:11-29`. | `verified` admin-only; delete checks assigned work and references before deletion `src/app/api/admin/employees/[id]/route.ts:131-169`. | `missing` no request replay key. | `verified` create/update/deactivate/delete events at `src/app/api/admin/employees/route.ts:34-46` and `src/app/api/admin/employees/[id]/route.ts:84-106`, `:171-183`. | `partial` guarded failure prevents unsafe deletion; no optimistic revision or undo path. | `partial` |
| Site settings update | Route/global owner `src/app/api/admin/settings/route.ts:9`; global definition `src/payload/collections/SiteSettings.ts:6-16`. | `verified` admin-only. | `missing` no request key or expected revision. | `verified` `settings.update` is written in the route. | `partial` one global write, but no prior-version restore command is exposed. | `partial` |
| Production contract-terms activation | Route/model owner `src/app/api/admin/contract-terms/production-pilot/route.ts:9-94`; terms hooks `src/payload/collections/ContractTerms.ts:1-43`. | `verified` admin-only; legal review reference and pilot controls checked before activation. | `partial` existing approved version/state prevents some repeats, but no request key. | `verified` `contract-terms.production-pilot-activated` at route `:89-95`. | `partial` multiple terms rows may be updated; no explicit encompassing transaction or rollback command found. | `partial` |
| Blog draft generation | Blog engine `src/lib/blog/payload-blog-engine.ts:249-400`; API `src/app/api/admin/blog/generate/route.ts:14-47`; cron `src/app/api/cron/seo-drafts/route.ts:14-42`. | `verified` admin or cron secret; AI feature/provider readiness required. | `partial` scheduled generation uses deterministic slot key at cron `:25`; manual generation deliberately uses random UUID at admin route `:26`. | `partial` `seo-runs` is a durable operational record, but the manual route itself does not call central `recordAuditEvent`. | `verified` engine/run stores failure state; feature-unavailable/provider failures return without partial publish. | `gated` |
| Blog save/review/schedule/publish/regenerate | API/editorial owner `src/app/api/admin/blog/posts/[id]/route.ts:22-40`, `:47-291`; transitions `src/lib/blog/transitions.ts:18`; policy `src/lib/blog/editorial-policy.ts:123-216`. | `verified` admin-only and editorial quality transitions are asserted. | `partial` regenerate gets a new UUID every request at route `:205-212`; other state actions have no request replay key. | `verified` stock-image/save/regenerate and state action events at route `:78-84`, `:149-155`, `:214-220`, `:264-270`. | `partial` transition guards fail closed; provider failures are monitored, but no versioned editor undo/history was found. | `partial` |
| SEO topic/signal import | Blog engine `src/lib/blog/payload-blog-engine.ts:133-248`; API `src/app/api/admin/blog/topics/route.ts:20-49`. | `verified` admin-only. | `partial` engine may deduplicate topics/signals, but route accepts no request/import fingerprint. | `missing` no central audit event in this route. | `partial` provider configuration and parse errors fail closed; a multi-row partial import rollback was not found. | `partial` |
| SEO performance refresh | API owner `src/app/api/admin/blog/performance/route.ts:15-99`. | `verified` admin-only. | `missing` no run/request key. | `verified` one audit event per updated post at `:93`. | `verified` Search Console failure degrades to lead-only/current data instead of overwriting provider fields: `:22-29`, `:74-89`. | `partial` |
| Invariant scan and safe reconciliation | Scanner `src/lib/cases/payload-invariant-scanner.ts:19-41`; reconciliation `src/lib/cases/case-reconciliation.ts:80-126`; API `src/app/api/admin/invariants/route.ts:10-38`. | `verified` admin-only; cron path uses cron secret. | `verified` invariant jobs use `case.invariant:<lead>:<code>` and reconciliation uses revision-specific keys: `src/lib/cases/payload-invariant-scanner.ts:19-34`, `src/lib/cases/case-reconciliation.ts:80-109`. | `partial` reconciliation records central audit at `src/lib/cases/case-reconciliation.ts:119-126`; GET scan persists operational jobs without a central audit event despite using GET. | `partial` only explicitly safe reconciliations are applied; re-scan follows. No operator UI for preview/apply/results was found. | `partial` |
| Roof Fusion UAT golden snapshot lifecycle | UAT server action `src/app/(admin-shell)/admin-next-preview/roof-fusion/uat/page.tsx:75-105`; repository `src/lib/roof-fusion/payload-repository-v1.ts:170-335`; golden owner `src/lib/roof-fusion/preview-uat-golden-v1.ts:69-173`. | `verified` Vercel preview, rollout, admin and case authorization at UAT page `:65-99`. | `verified` deterministic command keys and repository command ledger. | `verified` immutable embedded command audit and snapshot audit trail, e.g. `src/lib/roof-fusion/repository-contract-v1.ts:566-589`. Not mirrored to central `audit-events`. | `verified` repository uses expected revision/hash and exact replay/conflict behavior `src/lib/roof-fusion/repository-contract-v1.ts:604-625`. | `gated` |
| Roof Fusion workbench draft append | API/repository `src/app/api/admin/roof-fusion/workbench-draft/route.ts:61-107`; `src/lib/roof-fusion/workbench-draft-repository-v1.ts:185-225`. | `verified` preview gate, admin, actor-match and case authorization at route `:63-77`. | `verified` case-scoped CAS plus unique idempotency/revision/hash at route `:79-104` and model `src/payload/collections/RoofFusionWorkbenchDrafts.ts:39-48`. | `partial` draft embeds actor/time/hash but no central AuditEvent is created. | `verified` stale revision/hash and replay are explicit repository outcomes. | `gated` |
| Scheduled operational-job execution and message delivery | Processor `src/lib/jobs/operational-job-processor.ts:208-515`; cron API `src/app/api/cron/operational-jobs/route.ts:24-65`. | `verified` timing-safe cron secret at `src/lib/security/cron-auth.ts:3-14`; production communication pause is checked. | `verified` unique job/message keys and atomic status claims; examples `src/lib/messages/message-engine.ts:110-173`. | `partial` job status/attempt/error is durable, but the processor does not create central audit events for each execution. | `verified` stale-running rescue, exponential retry and terminal attention at `src/lib/jobs/operational-job-processor.ts:128-156`, `:243-515`. | `gated` |
| Resend inbound/outbound webhook application | Signature handler `src/lib/messages/resend-webhook-handler.ts:10-42`; inbound `src/lib/messages/resend-inbound.ts:37-52`; delivery updates `src/lib/messages/resend-webhook.ts:58-172`. | `verified` Svix headers and configured Resend secret are required. | `verified` provider event/email IDs and message/job keys deduplicate processing. | `partial` case-command audit is feature-gated; delivery evidence is stored on message records, but no dedicated central webhook AuditEvent was found. | `partial` errors are monitored and return non-success for provider retry; stage-level changes can precede a later failure. | `partial` |
| Retention purge cron | Lifecycle guards `src/lib/leads/case-lifecycle.ts:181-199`; cron `src/app/api/cron/purge-leads/route.ts:27-58`. | `verified` cron secret. | `partial` candidates disappear after deletion, but no durable per-case purge request claim exists. | `verified` `lead.retention_purge` event at cron `:54-58` (subject to event persistence occurring before/after deletion as implemented). | `missing` permanent deletion is intentionally not recoverable; legal/signed/work/invoice/warranty guards are the safety control. | `gated` |

## 6. Explicitly missing or incomplete capabilities

| Capability | Status | Evidence / search result |
|---|---:|---|
| Separate Customer and Property/Object aggregates, routes and collections | `missing` | Customer/address/property fields remain on `leads` at `src/payload/collections/Leads.ts:114-195`; capability registry maps both to leads at `src/lib/admin-next/capability-registry.ts:36-50`. No registered matching collection exists in `src/payload.config.ts:162-195`. |
| One customer with multiple properties or cross-case customer/property history | `missing` | No separate relation/index was found; current case list/search is lead-centric at `src/lib/admin-v2/case-list.ts:128-179`. |
| Production Roof Fusion approval → price calculation → quote/contract | `missing` | Quotes still relate to legacy `roof-measurements` at `src/payload/collections/Quotes.ts:47-57`; quote snapshot construction reads legacy measurement `inputHash` at `src/lib/quotes/payload-quote-engine.ts:45-125`. Admin Next RF mutation ownership is declared future/legacy-only at `src/lib/admin-next/capability-registry.ts:75-129`. |
| Production Admin Next mutation owner | `missing` | Every Admin Next module uses `mutationPolicy: "legacy_only"`: `src/lib/admin-next/capability-registry.ts:132-188`. |
| Canonical Admin Next production reads | `gated` | Today, case and field-visit pages instantiate canonical adapters only when `VERCEL_ENV === "preview"`: `src/app/(admin-shell)/admin-next-preview/today/page.tsx:19-21`, `src/app/(admin-shell)/admin-next-preview/cases/[caseId]/page.tsx:25-27`, `src/app/(worker-shell)/(protected)/worker-next-preview/visits/[visitId]/page.tsx:32-34`. |
| Real document preflight fed by canonical documents/evidence | `missing` | Capability registry marks Document Preflight fixture-only at `src/lib/admin-next/capability-registry.ts:167-176`. |
| Central communications inbox/conversation search | `missing` | Admin navigation contains no communications destination at `src/components/admin-v2/admin-navigation.tsx:8-20`; messages are surfaced within a case or dashboard queues. |
| Case UI backed by `audit-events` with real actor/action history | `missing` | V2 timeline is synthesized from current entity timestamps at `src/lib/admin-v2/case-read-model.ts:1370-1508`; Admin Next hardcodes actor text at `src/lib/admin-next/case-read-adapter.ts:137-145`. |
| Operator-facing operational job queue, retry/cancel and invariant reconciliation UI in Admin V2 | `missing` | APIs/collections exist, but Settings only renders health/release panels at `src/app/(admin-shell)/admin-v2/settings/page.tsx:17-88`; no Admin V2 component invokes `/api/admin/invariants` or exposes operational-job detail. |
| Unified global search across customers/properties/messages/SEO/employees/requests | `partial` | Dashboard search covers leads, quotes, contracts, work orders, invoices, warranties, measurements and changes only: `src/lib/admin-v2/dashboard.ts:425-453`. |
| Globally prioritized Today queue | `partial` | `attention` concatenates source arrays and slices 30 rather than globally sorting by urgency: `src/lib/admin-v2/dashboard.ts:395-416`. Admin Next maps broad queues to only four semantic action pairs at `src/lib/admin-next/today-read-adapter.ts:12-40`. |
| Dedicated quote and contract detail/workbench routes | `missing` | `/admin-v2/offers` and `/admin-v2/contracts` use the generic list and deep-link to case: `src/lib/admin-v2/operational-lists.ts:22-45`. |
| Server-paginated document register | `missing` | Document aggregation loads up to 500 rows from many collections and filters in memory at `src/lib/admin-v2/documents.ts:37-159`; the page invokes it for all and filtered data at `src/app/(admin-shell)/admin-v2/documents/page.tsx:22-50`. |
| Roof Fusion snapshot/evidence in document register | `missing` | Document aggregation reads legacy measurement `inputHash` and `mapImage` only at `src/lib/admin-v2/documents.ts:94-113`. |
| Unified accessible confirmation/modal system | `missing` | V2 critical actions use browser `window.confirm`, including measurement `src/components/admin-v2/measurement-review-panel.tsx:495-504`, work planning `src/components/admin-v2/work-order-planning-panel.tsx:91`, lifecycle `src/components/admin-v2/case-lifecycle-panel.tsx:42`, and message approval `src/components/admin-v2/message-draft-editor.tsx:330-335`. |
| Worker offline/PWA queue, service worker or background sync | `missing` | No service-worker/workbox/offline implementation was found. Worker client only retains local form draft state in `src/components/worker/worker-order-actions.tsx:32-116`. |
| Admin V2 SEO topic/performance dashboard | `partial` | Topic/performance APIs exist, but their controls are only on Payload dashboard via `src/app/(payload)/admin/components/BlogTopicTools.tsx:17-54`; V2 blog list is a simple 200-item list at `src/app/(admin-shell)/admin-v2/blog/page.tsx:11`. |
| Environment/auth gate for visual fixture routes | `missing` | The fixture layout only sets metadata/theme and renders children: `src/app/(ui-fixtures)/layout.tsx:4-20`. |
| Full critical-path E2E coverage | `missing` | Existing smoke test covers anonymous admin/API boundaries at `e2e/smoke.spec.ts:130-156`; authenticated test covers basic shell/mobile/a11y at `e2e/authenticated.spec.ts:9-85`. No lead→measurement→offer→signature→work→invoice/warranty lifecycle test was found. |

## 7. F0 preservation boundaries

The following verified production behavior should be treated as compatibility boundaries during unification:

1. Preserve administrator-only access and explicit 401/403 separation for every custom admin API; the canonical predicates are `src/payload/access/roles.ts:17-36`.
2. Preserve assigned-worker scoping and contract-document hash verification before exposing customer/work data: `src/lib/work-orders/access.ts:10-15` and `src/app/(worker-shell)/(protected)/user/arbeid/[id]/page.tsx:30-44`.
3. Preserve opaque token expiry/revocation, rate limits, expected document hashes and consent/signature evidence for customer actions.
4. Preserve immutable commercial versions, snapshots and hashes for measurements, quotes, contracts, change agreements, invoices and warranties.
5. Preserve message/job idempotency and the retry→attention behavior in `src/lib/jobs/operational-job-processor.ts:208-515`.
6. Preserve legal/financial guards before work creation, final review, official invoice send/payment and purge.
7. Do not treat Admin Next fixture metrics, fixture schedules or preview adapters as canonical production capability. Today fixture content remains in `src/components/admin-next/admin-next-today.tsx:114-237`.
8. Do not route Roof Fusion snapshots into the legacy quote engine without an explicit approved adapter and version/hash contract; that bridge does not exist in the audited source.
9. Before relying on `updateCaseState` for replay or audit guarantees, make the `FEATURE_CASE_STATE_ENGINE_V2` gate explicit in rollout/production evidence or remove the bypass safely.
10. Keep Payload as a technical recovery surface until missing operations, SEO and audit-history features have an equivalent custom-admin owner.

## 8. Audit limitations

- Runtime values for `FEATURE_CASE_STATE_ENGINE_V2`, `FEATURE_WORKER_PORTAL`, Admin Next rollout flags, `VERCEL_ENV`, provider credentials and cron/webhook secrets were not read or inferred.
- Payload hooks and migrations were inspected only where needed to verify the route/collection behavior in this inventory; this document is not a full schema migration audit.
- “No transaction found” means no transaction boundary was visible in the audited route/domain path. Payload's Postgres adapter can provide transaction support, but that does not make a multi-write path atomic unless it passes a shared transaction request.
- Monitoring/capture calls were treated as diagnostics, not as durable business audit events.
- Test existence was inventoried, but tests were not executed; status does not claim current green CI.
