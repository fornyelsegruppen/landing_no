# SEO local browser candidate

Owner: SEO. Only for a clean dedicated local worktree. This is not a deployment
script and must not be used with shared/production data.

Prerequisites: available x64 Node >=20.9, project node_modules, the already
running isolated PostgreSQL server on 127.0.0.1:55432 with local role phase2b_qa.
No Docker or production/provider secrets are needed.

```powershell
node scripts/seo-local-browser.mjs seed
node scripts/seo-local-browser.mjs repair-fixtures
node scripts/seo-local-browser.mjs add-unique-fixture
node scripts/seo-local-browser.mjs build
node scripts/seo-local-browser.mjs start
```

Development alternative after seed: `node scripts/seo-local-browser.mjs dev`.
The server listens on loopback only, port 3217. Open
http://localhost:3217/admin-v2/blog; sign in using the disposable fixture account
defined at the top of `scripts/seo-local-browser.mjs`. Do not copy credentials
to callback logs. This account is synthetic, not a production account.

The script refuses checkouts containing .env files, clears inherited application
environment values, fixes the database target to
`seo_automation_browser_20260912`, and disables AI drafts and both SEO scheduler
flags. Build invokes Next directly, not the deployment migration script. Schema
push is limited to the dedicated local database. Seed is repeatable and does not
overwrite existing fixture articles or delete database content.
`start` uses the generated `.next/standalone/server.js`, copies static/public
assets only into that generated output, and explicitly binds it to loopback.
It does not use the incompatible `next start` command for a standalone build.

Release constraint: this package has no intended schema/migration delta. The
repository's `npm run build` invokes `build:migrate` first; even
`PAYLOAD_BUILD_WITHOUT_DB=1` does not skip that script. Never use that entrypoint
as this package's supposedly read-only build. This local runner invokes Next
directly. Any later CONTROL-approved deployment requires an independently
verified direct-Next build override, fresh rollback metadata, and confirmation of
the actual production schema/migration ledger; no production DB mutation is
authorized by these local test results.

The repetition-guard follow-up blocks a normalized long prose paragraph repeated
at least three times. Existing fixture3 is retained as the historical negative
case. `add-unique-fixture` only creates `seo-local-unique-approval` if absent in the
fixed existing database/account, verifies its synthetic author if present, and
never updates existing post text/history. Its first execution created post4;
read-only QA preflight passed with score93 and a visible moderate title/keyword
overlap warning. This does not persist QA or human approval. Its content uses
distinct meaningful paragraphs, not a repeated word-count filler.

After the unpublish changes, a standalone fixture/CLI process may log a cache
invalidation warning because it has no Next request store. Browser-path cache
acceptance remains a separate gate. The corrected invalidation patterns include
the `(site)` route group and are tested against the installed Next implicit tags.

Rescheduling uses the existing schedule action for approved or scheduled posts,
requires current QA/human review/source readiness and a future date, retains
revision guards, and does not create a new version for an identical saved time.
The LT/NB/EN editor shows Change time only for a scheduled article and disables
it until a different future time is selected with no unsaved content edits.

Final combined pre-build checks after these changes: 49 files / 317 Vitest tests,
3 local fixture helper tests, full TypeScript, touched ESLint and diff-check PASS.

## Current-quality policy and bounded API acceptance follow-up

Current deterministic results carry `qualityChecks.policyVersion` in the existing
JSON field. Missing/old/unknown versions require an explicit unchanged-content
Recheck, which saves current QA and invalidates approval without auto-approving.
The shared predicate covers API approval/schedule/publish, native approval/publish,
and the due publisher. `aiAssisted:false` cannot bypass current quality for a new
publication. Already public content is not automatically withdrawn: visibility
does not depend on a newly installed quality policy. Never manually stamp a new
version on historical QA100 or bulk-migrate old evidence to manufacture freshness.

`node scripts/seo-local-browser.mjs api-e2e` uses only fixed localhost3217 and the
existing synthetic login, not browser cookies. It creates its own new random-slug
fixture; it never touches fixture3 (whose browser confirmation was uncertain) or
fixture4. It performs real current SaveQA/approval/reschedule/manual publication,
warms public article/list/sitemap, explicitly unpublishes and checks immediate
removal, then restores native history as an unpublished/review-required draft.
Cleanup verifies only its own fixture identity and withdraws it without deleting
versions. No provider calls, cron trigger, browser bypass, or production mutation.
Its result is API acceptance only; it cannot confer browser acceptance.

Fixtures:

- `/no/blogg/seo-local-draft`: draft only; normal public request should not show
  it. Enter draft preview from the admin article link while authenticated.
- `/no/blogg/seo-local-published-with-draft`: old public content plus a newer
  unreviewed draft. Only draft preview includes the heading “Bare i utkastet”.
- Both fixtures have English fields for preview locale checks. Admin account
  language starts Lithuanian. ONE UI provides LT/NB/EN status copy.
- `repair-fixtures` fills only missing structural metadata on these two named
  synthetic fixtures, checks their author marker, and verifies that saved text
  remains unchanged. Existing nonempty metadata is preserved. Normal draft
  invalidation still applies; no approval or QA result is manufactured.
- The explicit repair also creates `seo-local-approval` only if absent: a
  complete, separately titled synthetic AI-assisted draft for recheck, approval
  and scheduling tests. It remains human_review with no manufactured QA pass.
  Use its editor's recheck action before approval. This avoids overwriting the
  operator's existing fixture titles just to remove their artificial overlap.

## Optional local review-canary

Default `start` stays OFF. After the OFF browser batch, stop that local server
and run `node scripts/seo-local-browser.mjs start-review-canary`. This is an
explicit local-only UI mode against the same fixed synthetic database and
loopback port. It sets the scheduler/approved-publisher runtime flags ON, while
AI generation remains OFF and no provider/cron credentials or executor exist.
No rebuild is needed solely for these server-runtime flags. The status must
remain executor-unverified; do not describe manual local publication as proof
of automated delivery. Never call production cron or weaken canonical/auth
guards to complete this QA. Return to ordinary `start` after the review batch.

Check preview banner, ordinary non-prefetch entry/exit links, restored public
view, paused automation/no verified sources, pending review count, edit/reload
and approval-reset states. Paid generation and image replacement are disabled;
do not expect real provider success. Synthetic fixture publication is only local.
Do not submit customer lead forms or grant marketing consent during browser QA.
No new external network policy is claimed; third-party images/analytics remain
normal app code, so use a fresh local browser session and deny consent.

Execution outcomes, server process identity and final source SHA belong in the
CONTROL handoff. The mere presence of this runbook does not claim browser PASS.

Initial integrated verification (2026-09-12): 36 files / 223 tests passed;
TypeScript and touched-file ESLint passed. Seed completed with one synthetic
user, two posts and five versions. The first webpack build failed on the
pre-existing non-SEO client import chain `case-lifecycle-panel.tsx` →
`case-lifecycle.ts` → `case-command.ts` → `node:crypto`. CONTROL owns coordination
of that boundary fix; until it is integrated and the build passes, `start` is
not ready. A separately identified development server can support scoped blog
QA, but is not a passing production-build gate.

Follow-up: boundary fix `d207fb2` was integrated as `eec75ae`; its focused ten
tests passed. The subsequent local production build completed with exit 0,
including TypeScript and all 73 static pages, using only the isolated full app
database. Runtime source is `eec75ae` plus documentation-only follow-up. Native
dev import-map regeneration changed only three binding aliases/order; this
non-functional generated churn was restored to the committed mapping.

Persisted native browser login remains a CONTROL QA gate, not a PASS inferred
from HTTP. The installed Payload cookie strategy requires a configured Origin
or normal browser Sec-Fetch-Site context (`same-origin`, `same-site`, `none`).
The manually scripted local cookie test passed with the proper origin and
reported paused automation and two pending articles; no production auth policy
was weakened to make this check pass.

## Browser batch fixes (local, 2026-09-12)

CONTROL's real Chrome batch confirmed persisted auth. It found a covered preview
exit link, raw/uninformative source status, rejected short draft saves, and raw
quality errors. Accepted preview/status commits `62d95ff` and `04c4aa6` are now
integrated. The next browser batch, not source tests, must confirm pointer exit
and visible localized access/freshness/last-success values.

Save validation now accepts a nonempty working title and 1–30000 characters of
draft text, with localized inline field errors and stable API error codes.
Empty, oversized and wrong-type fields remain rejected; malformed JSON is a
safe 400. Saving re-runs the existing deterministic QA, keeps failed results,
resets review/scheduling and never publishes. Revision and authorization checks
are unchanged. Approval/publish gate errors have stable localized feedback.

Presentation maps stored schema field prefixes to operator guidance instead
of raw Zod messages. The publication schema still requires 700–15000 characters
of body text; fewer than 700 words remains a separate completeness warning.
Prompt targets and regeneration feedback are unchanged.

Explicit fixture repair was run: existing fixture 1/2 text was preserved and
missing structural metadata filled. Fixture 3 (`seo-local-approval`) passed a
read-only deterministic preflight at 100 with no issues; QA/approval was NOT
persisted by the repair. Use the UI recheck to begin its approval test.

The PostgreSQL concurrency test now creates two test-owned eligible topics per
run and retires only those candidates afterwards, retaining run evidence. This
avoids exhausting the ten intentionally single-use manual seeds across repeated
test executions; no production reservation rules were loosened.
# Unpublish / restore follow-up after the frozen da512da browser batch

- The explicit Admin V2 **Unpublish** action requires confirmation and an expected
  timestamp, checks the server revision hash under the post-write lock, updates
  the base document (`draft:false`), and clears QA, reviewer, and schedule. The
  button uses the actual base publication state, not the latest draft status.
- Reject remains a draft workflow decision. It must not be interpreted as removal
  of a previously public revision. Native CMS base unpublish also clears retained
  approval/schedule before Payload merges the latest draft fields.
- Version history opens the existing native CMS history in a separate tab, with
  LT/NB/EN guidance and a return-to-Admin-V2 link in the native article workflow.
  Restoration reuses the existing authenticated draft-only handler. It never
  copies historical approval to the restored draft or republishes an unpublished
  article. Existing Payload retention remains 20 versions per document.
- Public article/list/home and sitemap cache paths are invalidated only after the
  owning PostgreSQL transaction actually commits. Nested writes defer to that
  owner; rollback and deferred COMMIT failure cause no invalidation. A cache error
  is logged after commit and cannot pretend that a successful DB write rolled
  back; the existing ISR intervals remain its fallback.
- The isolated PostgreSQL tests use `seo_automation_core_20260912`, not the running
  browser fixture database. No source edit here changes the frozen standalone
  da512da runtime or its current operator-created revisions.
- The new source still needs its own build and real-browser verification of
  immediate anonymous 404, sitemap removal, version-history navigation, and safe
  restore. Earlier da512da browser acceptance is not acceptance of this follow-up.
