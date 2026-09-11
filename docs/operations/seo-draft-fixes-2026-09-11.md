# SEO draft completion fixes

Observed live post 1: generated Norwegian Ålesund article, Pexels attribution saved, quality score/checks missing, human_review status and publication locked. No article published during diagnosis.

Fixes:
- Initial generation now carries the same server-only trusted quality revalidation context as regeneration and manual save. This prevents the collection hook invalidating a freshly evaluated create when Payload supplies an empty original document. Direct untrusted edits still invalidate review.
- Admin editor renders the existing remote Pexels image when public-media hero storage is unavailable.
- Owner limited coverage to Oslo and nearby cities. Conservative initial list: Oslo, Bærum, Asker, Lillestrøm, Lørenskog, Ski. Replaced Ålesund seed; queued topic selection filters locations before ranking/limit; out-of-area regeneration refuses before creating a run. No old topics/posts deleted.
- Generated /takvask and /takmaling links already render under /no via safeContentHref; added regression tests rather than changing working behavior.

Initial focused checks: 26 tests passed. Full regression and live acceptance results to be recorded after execution. Auto-publication and scheduled generation remain disabled. Existing out-of-area post 1 stays unpublished. No changes to customer mail routing, redirects, database migrations or DNS.

Full regression: 233 files / 1073 tests PASS; TypeScript and lint PASS. First fix deployed to both new-domain aliases as dpl_2DknWgF1fp96HExjXL3f6txY3cpd (5758b6f). Live editor now exposes the Pexels image. Both service links return 200; both old domains retain direct 308 to new apex.

Live manual attempt selected Oslo topic 11 correctly, run 2; rejected by deterministic QA before post creation: score63, unsafe_roof_advice blocker and content_too_short warning (634 words). This is not a timeout/provider outage. Raw output is not retained, so do not infer the exact offending sentence or weaken the guard. Added a precise safe-ground-inspection prompt instruction and structured localized rejection feedback. No automatic retry loop. One additional explicitly observed acceptance attempt planned after deployment.

Feedback candidate 2f6939a failed build due missing nb locale entry; never assigned custom domains. Fixed in 412a6e9, TypeScript and targeted lint PASS. Existing working first-fix deployment remained live throughout.

Final deployment READY: dpl_GETi3v8dvpSxk8JgRbjtkFPoHga6, https://landing-lizkuhfql-darbasnorvegija4-8212s-projects.vercel.app (412a6e9), assigned to both new-domain aliases. Old-domain /no still 308 to new apex. Second observed manual generation succeeded: post 2, "Takfornying i Oslo: Hva bør boligeiere vurdere?", quality93, deterministic QA passed and image present. Publish/schedule disabled awaiting human review; no approval or publication performed. Original Ålesund post1 unchanged/unpublished.

Post2 manual save returned success; browser reload retains score93 and QA passed. Authenticated preview renders article headings, image attribution and same-domain service links. Editorial issue still requires review before approval: AI imageAlt claims moss and Oslo but selected Pexels image visibly shows clean red tiles against blue sky. Deterministic QA is not a substitute for factual/image review. No publication performed.

Anonymous post2 URL returns404; sitemap excludes its slug. Browser returned to Admin V2 post2 for owner review. Final deployment uses unchanged production mail routing overrides and old-domain deployment remains untouched.
