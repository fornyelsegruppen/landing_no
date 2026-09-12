# SEO automation core — local source handoff, 2026-09-12

Owner: SEO. Scope: local source and synthetic tests only. This is not permission
to deploy, switch aliases, enable cron, change environment flags, or publish an
article. Native CMS remains supported. No production schema migration is added.

## Baseline and release boundary

This branch starts at `414f65f555895552c5905553330b0d2b1dc72828`.
Read-only deployment checks made during this work found both new-domain aliases
on READY `dpl_9EAEDibiADiXWLUfULgYMN7BEiV5`. Rollback deployment
`dpl_6cTTnBEoB6ioTudU7ARdVGtVhj4W` was READY. These are observations, not
permanent attestations and not evidence of a new scheduler canary.

The project cron is paused and its three definitions still reference an older
deployment, including unrelated purge-leads work. Do not globally unpause it.
The observed Hobby plan cannot provide the requested frequent approved-publisher
execution. Source flags and successful manual HTTP requests do not prove an
active periodic executor. No executor, provider credentials, or shared flags
were changed by this package.

## Source behavior

- Draft slots: Monday and Thursday, 09:00 Europe/Oslo, DST-aware. Repeated calls
  on the same slot use one durable idempotency key. `nextConfiguredRunAt` is a
  theoretical next slot, not a verified next execution or retry time.
- Claim before signals/provider work. Queue transactions serialize claims and
  topic reservations. Concurrent different slot keys cannot reserve the same
  topic. Post, drafted topic and completed run are committed together.
- Known pre-provider failure can retry the same run after 15 minutes, at most
  three attempts. Provider/unknown outcomes require attention; no blind paid
  regeneration. A stale running claim becomes attention after five minutes.
  A durable post linked to the run can be recovered without provider execution.
- GSC refresh requests finalized current/baseline 28-day windows with a three-day
  lag. Only current-window signals feed ranking. **Baseline comparison/growth
  scoring is NOT implemented or claimed.** At most 50 signal snapshots are
  refreshed, replacing metrics rather than adding repeated imports. Protected
  and reserved topics are not rewritten. Missing access does not fabricate
  demand and fails before AI generation.
- Manual seeds use `getManualTopicSeeds(now)`. Selection reads a bounded pool of
  up to 100 eligible topics, recalculates seasonal factors for the current Oslo
  month, ranks in memory, and skips reservations. Persisted historical scores
  are only the pool ordering, not final seasonal selection. Ranking is not an
  exhaustive scan beyond that pool. Editorial city priority does not claim
  measured query geography. Non-roof, indoor/footwear and selected non-served
  city queries are filtered; this is a bounded vocabulary, not a geocoder.
- Cron has a 55-second working budget in a 60-second handler. GSC has a shared
  12-second signal, signal persistence an 8-second bounded loop, Gemini gets at
  most 35 seconds and leaves persistence headroom. Optional Pexels enrichment
  occurs after durable completion, uses remaining abort budget and skips Blob
  persistence on cron. Image failure cannot discard a valid draft. DB lock/
  statement limits bound individual operations, not a hard whole-job SLA.
- Approved publisher reads latest draft under the same PostgreSQL lock as native
  Posts writes. Human approval and quality/source validation remain required.
  Invalid scheduled review returns to human_review and clears approval. Multiple
  publishers cannot publish the same revision twice. No AI dependency is needed
  for the approved publisher itself. Queue batch size is ten.
- Posts-scoped Drizzle transactions preserve global `transactionOptions: false`.
  Native writes, autosave, bulk writes and version restore participate. Saved
  transaction ownership prevents accidental autocommit after a caught failure.
  Lock timeout is 5s, statement timeout 15s, idle transaction timeout 20s.
  Swallowed SQL and actual COMMIT failures are surfaced and rolled back.
- Optimistic checks combine updatedAt with a stable server revision hash of
  public content and review/quality state. This detects same-millisecond changes
  for approve/reject/schedule/publish/save, regeneration and image replacement.
  Public old content remains visible until a new approved revision is published.
- Production executor calls must target the canonical new origin
  `https://takfornyelsenorge.no`. Preview requires an explicit canary identifier.
  This rejects a frozen deployment URL; it does not attest executor deployment.

## ONE UI contract

Admin-only, no-store `GET /api/admin/blog/automation` returns:

```ts
{
  features: { draftsEnabled: boolean, approvedPublisherEnabled: boolean },
  executor: { state: "paused" | "unknown", verifiedAt: null, targetMatches: null },
  timeZone: "Europe/Oslo",
  lastRun: null | { id: number, status: "running" | "completed" | "failed" | "attention",
    startedAt: string, finishedAt: string | null, errorCode: string | null },
  nextConfiguredRunAt: string,
  pendingApprovalCount: number,
  sources: {
    searchConsole: { access: "configuration_required" | "unverified" | "verified" | "failed",
      freshness: "unknown" | "stale" | "fresh" | "no-data", lastSuccessAt: string | null },
    trends: { access: "unverified", freshness: "unknown", lastSuccessAt: null }
  }
}
```

Neither feature flags nor an old run are labelled executor-verified. GSC status
is derived from latest matching-property refresh evidence and a four-day
staleness window on the last matching success. The source log stores only the
non-secret configured property identifier, not credentials. Old-domain and
legacy property-less snapshots cannot verify the new property. A failed refresh
keeps the previous matching lastSuccessAt and honest observation freshness;
access is still failed. Two evidence queries are bounded to 50 recent refreshes
and 50 recent successes, so older unobserved history is not claimed. No
credential values are returned. Trends remains explicitly unverified.

## Verification and outstanding gates

Local synthetic PostgreSQL tests use only
`127.0.0.1:55432/seo_automation_core_20260912`, existing local role `phase2b_qa`.
They do not import production config, call paid providers or require Docker.
The database has a restricted test schema, **not the full browser app schema**.

Coverage includes native edit/publish/restore races in both orders, two
publishers, same-key claims, different-key topic reservation, provider-barrier
regeneration conflicts, bulk failure, caught inner SQL failures, lost request ID
or session registry, lock timeout, real deferred-constraint COMMIT failure,
public-old-revision preservation and transaction session cleanup. Admin API
tests separately cover same-timestamp conflicts for all four review actions.

Run from repository root with the available x64 Node runtime:

```powershell
node node_modules/vitest/vitest.mjs run src/lib/blog src/lib/providers/gemini-ai-provider.test.ts src/lib/providers/google-search-console-provider.test.ts src/lib/providers/pexels-stock-image-provider.test.ts src/payload/collections/Posts.test.ts src/payload/collections/Posts.postgres-automation.qa.test.ts src/app/api/admin/blog src/app/api/cron/seo-drafts src/app/api/cron/publish-posts --maxWorkers=2
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

Results and immutable source SHAs are recorded in the CONTROL handoff after the
final integrated run; a source PASS does not turn the following into live PASS:

| Gate | Local/source vs live |
| --- | --- |
| Atomic CMS writes and orchestration | Local synthetic verification; deployment required separately |
| ONE UI integration and real browser check | CONTROL integration/review required |
| Frequent active executor and correct target | **FAIL external**: no suitable active executor verified |
| GSC real access/freshness | **FAIL external**: credential/property env names absent in all three Vercel environments at audit |
| Trends real adapter/access | **FAIL**: not implemented/verified by this package |
| Current deployment scheduler canary | **NOT RUN**; historical run7/post4 is not current proof |
| Full automatic live service | **NOT READY** until external gates and controlled activation pass |

Rollback sequencing: stop only the SEO executor first, preserve the native CMS
and durable run/topic records, then use the separately approved deployment
rollback. Never use database rollback or global cron unpause as a shortcut.
