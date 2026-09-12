# SEO local browser candidate

Owner: SEO. Only for a clean dedicated local worktree. This is not a deployment
script and must not be used with shared/production data.

Prerequisites: available x64 Node >=20.9, project node_modules, the already
running isolated PostgreSQL server on 127.0.0.1:55432 with local role phase2b_qa.
No Docker or production/provider secrets are needed.

```powershell
node scripts/seo-local-browser.mjs seed
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

Fixtures:

- `/no/blogg/seo-local-draft`: draft only; normal public request should not show
  it. Enter draft preview from the admin article link while authenticated.
- `/no/blogg/seo-local-published-with-draft`: old public content plus a newer
  unreviewed draft. Only draft preview includes the heading “Bare i utkastet”.
- Both fixtures have English fields for preview locale checks. Admin account
  language starts Lithuanian. ONE UI provides LT/NB/EN status copy.

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
