# SEO: cold-build sitemap correction candidate

Owner SEO. Parent8454e32644a4cfa2bad75dc08c05dbf34688f12f. Isolated candidate
only; no integration, remote deployment, migration, provider or cron action.
CONTROL requested independent source review before the next guarded build.

## Reproduced defect, not a hypothetical

The approved isolated8454 build invoked direct Next16.3.2 webpack with
PAYLOAD_BUILD_WITHOUT_DB=1, production NODE_ENV and an unreachable loopback
Postgres URL (port1). Runtime/provider/cloud credentials were scrubbed. Exit0,
71 static pages. CMS-disabled fallback messages were expected. An earlier
compiler warning banner had no detailed warning text in its output.

The resulting standalone runtime28344 at localhost3218 omitted the guard and
used only the existing fixed local PG synthetic DB, all SEO flags OFF, executor
paused. The original localhost3217/session34771 was not changed.

At 2026-09-12T21:46:48Z normal synthetic login and actual CMS/public readback:

- Published post3 API, article200 with its actual published H1/content heading,
  private draft title excluded, expected Norge canonical: PASS.
- Current blog list contained post3 published title/slug: PASS.
- Unpublished own5 article404, absent from list/sitemap: PASS.
- Sitemap200 `x-nextjs-cache: HIT` omitted both published posts2 and3: FAIL.
  Manifest declared sitemap `compute: static`, `initialRevalidateSeconds:300`;
  `.next/server/app/sitemap.xml.body` existed with the incomplete build output.

Thus build success plus page200 is not cold-release sitemap correctness. Waiting
for eventual ISR does not erase that first-response defect.

Bounded read-only follow-up on the unchanged old8454 runtime: at21:52:03Z the
first GET after expiry returned STALE and still omitted both posts; at21:52:15Z
the next GET returned HIT with both posts present and own5 absent. Natural ISR
recovery is demonstrated separately; no invalidation, DB mutation or restart
was used to obtain it. Cold/first-stale response still fails.

## Minimal fix and explicit tradeoff

Replace `export const revalidate = 300` with
`export const dynamic = "force-dynamic"` in `src/app/sitemap.ts`.
This uses the standard metadata route opt-out. `revalidate=0` is an alternative
dynamic trigger, but the explicit dynamic declaration states the intent directly;
using both is unnecessary. Cache Components is not enabled in this configuration.
[Next sitemap documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
and [route configuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic).

The intentional change is removal of this sitemap's five-minute full-route
cache. Each sitemap request now performs the existing settings read plus two
parallel shallow published-content queries (pages/posts depth0, limit1000,
draftfalse). Query bounds/filters/locales/error fallback are unchanged; this does
not preserve the former request frequency and the increased DB load needs
CONTROL acceptance. No new persistent helper cache is introduced: it could cache
the helpers' empty-array fallback and require broader invalidation changes.

Reviewed actual getPublishedPages/getPublishedPosts helpers: they have no
cross-request cache and catch CMS failures to empty arrays. This patch does NOT
change that runtime outage policy: an actual DB outage can still produce a
partial200 sitemap. It only prevents baking the deliberate build-time outage
into a healthy runtime's first answer. Staged live-CMS readback remains required.
Existing publication invalidation is left intact; its sitemap invalidation does
not conflict with generating a fresh runtime response.

## Verification gates

- Real sitemap function + real CMS helpers with mocked Payload boundary: five
  new tests cover explicit dynamic setting, first healthy call after guarded
  fallback, preserved published/bounded reads, outage recovery without persisting
  fallback, and draft exclusion. No mocked getPublishedPages/getPublishedPosts.
- Together with existing sitemap language/publication and invalidation tests:
  3 files /10 tests PASS. Full TypeScript exit0.
- `scripts/seo-sitemap-build-artifact.test.mjs` explicitly inspects generated
  manifests/files AFTER a build. Against old8454 output it correctly fails the
  cached-sitemap check and passes handler-presence check (expected red baseline).
  It has NOT passed on a rebuilt fix yet; source tests are not that proof.
- Existing six no-migration build configuration tests PASS. Touched-file ESLint
  and diff whitespace checks PASS. Independent source review remains pending.

After independent review and explicit final-build GO: stop only owned3218 server,
build this exact candidate with the same scrubbed guarded direct command, run
both artifact assertions (no sitemap prerender entry/body, runtime handler exists),
then start3218 without the guard. Inspect the FIRST sitemap request, not a warmed
retry: it must contain real published posts2/3 and exclude own5. Confirm original
post3/public-blog/auth/OFF assertions again. No reseed, publishing, cache-purge
workaround or remote-origin request. Keep3217 frozen throughout.
