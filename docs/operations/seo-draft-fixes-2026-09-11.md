# SEO draft completion fixes

Observed live post 1: generated Norwegian Ålesund article, Pexels attribution saved, quality score/checks missing, human_review status and publication locked. No article published during diagnosis.

Fixes:
- Initial generation now carries the same server-only trusted quality revalidation context as regeneration and manual save. This prevents the collection hook invalidating a freshly evaluated create when Payload supplies an empty original document. Direct untrusted edits still invalidate review.
- Admin editor renders the existing remote Pexels image when public-media hero storage is unavailable.
- Owner limited coverage to Oslo and nearby cities. Conservative initial list: Oslo, Bærum, Asker, Lillestrøm, Lørenskog, Ski. Replaced Ålesund seed; queued topic selection filters locations before ranking/limit; out-of-area regeneration refuses before creating a run. No old topics/posts deleted.
- Generated /takvask and /takmaling links already render under /no via safeContentHref; added regression tests rather than changing working behavior.

Initial focused checks: 26 tests passed. Full regression and live acceptance results to be recorded after execution. Auto-publication and scheduled generation remain disabled. Existing out-of-area post 1 stays unpublished. No changes to customer mail routing, redirects, database migrations or DNS.
