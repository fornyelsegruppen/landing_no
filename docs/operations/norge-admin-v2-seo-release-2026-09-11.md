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
- Complete unit rerun pending final result at document creation.
- `next build` passed with database-independent mode and dummy loopback PostgreSQL URL. This verifies compilation/static fallbacks, not live CMS access. Migration runner deliberately not executed against PostgreSQL.
- First build attempts hit unavailable Google Fonts in sandbox and unsupported Windows ARM SQLite dependency; final build used network access and PostgreSQL adapter.
- `git diff --check` passed.

## Live release gate — not yet deployed

Authenticate Vercel; read current project, aliases and environment before deployment. Preserve existing old-domain redirect behavior and mail routing. Do not upload dummy build environment or local prebuilt output. Build remotely with verified production configuration.

Check AI provider credentials, FEATURE_AI_DRAFTS, public image storage/stock provider and CMS access without disclosing secrets. Keep FEATURE_SEO_AUTO_PUBLISH false; do not enable scheduled generation until a single manual draft is verified. Never reuse prior mail canary commands.

After deployment: authenticated Admin V2 blog list/editor, one draft generation, editorial review gate, new-domain links, public approved article, sitemap/robots and old-domain redirect smoke tests. Keep generated draft unpublished until editorial approval. Confirm both new and old mail recipient routing remains unchanged without sending real client mail.

Historical Phase A new-domain deployment: dpl_8Kzu4KtyAxeKGFvBhrGza8CvR264. Historical Phase B old-domain redirect deployment: dpl_DCHmqvLSz3ndXbfdPLguHfoCLdBv. Re-read actual current alias targets and record them before any change; these historical IDs are not proof of current state.
