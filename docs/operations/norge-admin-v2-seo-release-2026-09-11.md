# New-domain Admin V2 SEO integration

Branch: `codex/norge-admin-v2-seo-20260911`.
Base: cutover `cb6ace2988b8a2c1df61def17f58628cfe082d13`.

## Scope

Reuse the cutover's existing Admin V2 customer and blog management. Cherry-picked only SEO/editor remediation commits b4c11f7, 9963278, b466cb9, 9e945e2, f8982df, beede24, 21b9ac1, bc6fe18, 1a0fe3b, fa6973f, b8f9e1f and e49484b. Did not merge the unrelated ONE UI/RF branches.

Includes editorial approval gates, draft quality checks, editor actions, safe public media handling and Preview scheduler isolation. Article canonical URLs and Search Console inspection URLs now use https://takfornyelsenorge.no, including when the editor runs in Preview.

No changes against the cutover base in public-host migration, proxy, contact form route, lead admin recipients, site identity or database migrations. No live customer messages or records created. Auto-publication has not been enabled.

## Local verification

- Typecheck and ESLint passed.
- Initial complete unit run: 1069 passed, one failed because an August quote fixture had expired against the real clock. Fixed only the test clock, not quote business logic. Targeted rerun of quote fixture, canonical and blog publishing flow: 3/3 passed.
- Complete unit rerun passed: 232 files, 1070 tests.
- `next build` passed with database-independent mode and dummy loopback PostgreSQL URL. This verifies compilation/static fallbacks, not live CMS access. Migration runner deliberately not executed against PostgreSQL.
- First build attempts hit unavailable Google Fonts in sandbox and unsupported Windows ARM SQLite dependency; final build used network access and PostgreSQL adapter.
- `git diff --check` passed.

## Live release gate

Candidate deployed READY: `dpl_DyQ6DykyNp4nQTtCkjaoTsiW52tG`, https://landing-3icdk2w80-darbasnorvegija4-8212s-projects.vercel.app, source `8415a28`. Remote build passed using existing CMS configuration; migrations explicitly skipped via build-only DATABASE_URL_MIGRATE=file:./seo-no-migrations.db. No local dummy database/build environment uploaded. Created with --prod --skip-domain; candidate creation updated the generic project alias only, not custom domains.

Fresh preflight confirmed the new custom domains still point to historical Phase A. Both old apex and www return 308 to new /no. Candidate authenticated GET checks: /no, /no/blogg, /sitemap.xml, /robots.txt return 200 with new-domain URLs. Admin authentication check and custom-domain assignment pending at this checkpoint.

Read safe production config: FEATURE_AI_DRAFTS=true; FEATURE_SEO_SCHEDULER=false; FEATURE_SEO_AUTO_PUBLISH=false. Project-wide LEAD_TO_EMAIL remains old address, so this deployment explicitly sets LEAD_TO_EMAIL=post@takfornyelsenorge.no and LEAD_ADMIN_COPY_EMAIL=post@takfornyelse.as. Existing sender retained. New-domain URL explicitly set for build/runtime, PUBLIC_HOST_REDIRECTS_ENABLED=false for this new-domain-only deployment. Old-domain deployment is untouched.

Gemini and Pexels credentials are present, but not live generation PASS. Search Console credentials and dedicated public-media token are absent from project listing. Pexels remote-asset attribution fallback is supported; manually uploaded public images need dedicated public storage configuration. Search Console metrics are not yet connected.

Final live status: both takfornyelsenorge.no and www.takfornyelsenorge.no assigned successfully to candidate dpl_DyQ6DykyNp4nQTtCkjaoTsiW52tG. Post-assignment public GETs /no, /no/blogg, /sitemap.xml and /robots.txt return 200. Admin V2 blog returns 307 to same-domain /admin/login (expected without CMS session). New www /no and both old-domain /no return 308 directly to new apex /no. Robots allows public crawling and advertises the new-domain sitemap. No customer form submitted during these checks.

Pending user-authenticated acceptance: open /admin-v2/blog, generate one unpublished draft, review quality/source/image/editor actions. Vercel authentication completed, but no authenticated CMS session was available to perform this final test. Do not call generation PASS or claim Search Console connected. Rollback for the two new aliases remains the freshly verified historical Phase A URL above.

For subsequent deployments: preserve existing old-domain redirect behavior and mail routing. Do not upload dummy build environment or local prebuilt output. Build remotely with verified production configuration. Deployment-scoped overrides are recorded above; project defaults alone do not preserve recipient migration.

Check AI provider credentials, FEATURE_AI_DRAFTS, public image storage/stock provider and CMS access without disclosing secrets. Keep FEATURE_SEO_AUTO_PUBLISH false; do not enable scheduled generation until a single manual draft is verified. Never reuse prior mail canary commands.

After deployment: authenticated Admin V2 blog list/editor, one draft generation, editorial review gate, new-domain links, public approved article, sitemap/robots and old-domain redirect smoke tests. Keep generated draft unpublished until editorial approval. Confirm both new and old mail recipient routing remains unchanged without sending real client mail.

Historical Phase A new-domain deployment: dpl_8Kzu4KtyAxeKGFvBhrGza8CvR264. Historical Phase B old-domain redirect deployment: dpl_DCHmqvLSz3ndXbfdPLguHfoCLdBv. Re-read actual current alias targets and record them before any change; these historical IDs are not proof of current state.
