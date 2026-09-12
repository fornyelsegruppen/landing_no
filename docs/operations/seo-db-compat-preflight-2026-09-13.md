# Optional production database compatibility preflight

Status: source candidate only. No database access, deployment, environment change,
migration, or build-command integration was performed to create this package.
This is a structure/permissions gate, not a production readiness certificate.
The existing Vercel build command is unchanged. A normal build does not require
this preflight or a database connection.

## Invocation and release boundary

`node scripts/db-compat/preflight.mjs` is OFF when
`SEO_DB_COMPAT_PREFLIGHT` is absent, `0`, or `false`. It returns success with
`DB_COMPAT_DISABLED` before reading credentials, source files, the manifest, or
loading `pg`. Other values fail unless the flag is exactly `1` and the inherited
`VERCEL_ENV` is exactly `production`.

An actual check needs separate release-owner approval. It uses only the existing,
inherited `DATABASE_URL`; there is no dotenv loading, URL export, migration URL,
fallback database, new credential, or new privilege. Do not put credentials in
arguments, files, command output, or documentation. Never run it through
`npm run build`, Payload bootstrap, or a migration/status wrapper.

After independent source acceptance, the owner may explicitly opt it in for one
protected Production-target build without assigning the public domain, and use
this command ordering (not configured by this patch):

```sh
node scripts/db-compat/preflight.mjs && PAYLOAD_BUILD_WITHOUT_DB=1 next build --webpack
```

The opt-in flag must be provided deliberately for that check. If absent, the
first command is only a no-op: `DB_COMPAT_DISABLED` is not database evidence.
Require `DB_COMPAT_PASS` from the exact candidate build before treating this gate
as passed. A nonzero exit prevents Next when chained with `&&`.
Keep `PAYLOAD_BUILD_WITHOUT_DB` build-scoped, not a runtime environment setting.
Remove the one-shot opt-in after the check; no permanent build database dependency
or runtime preflight is introduced. Do not bypass a failure by weakening TLS or
running migrations. Production traffic remains a separate release decision.

## Fixed checks and source binding

The sealed manifest targets accepted source
`b02955a03461878ed95f927db45f388079e0827f`.
Production execution reads that JSON and checks its SHA-256 plus the SHA-256 of
19 relevant source/snapshot files (line endings normalized). It never imports
Payload, application configuration, application modules, or migration code.
Environment/CLI input cannot supply SQL, IDs, schemas, tables, or target URLs.

The offline capture helper uses Node built-ins and a fake query connection to
capture actual committed ONE UI query text with fixed synthetic parameters. It
does not evaluate application imports or contact a database. The regression test
regenerates the artifact and compares every query/parameter and metadata item,
including selected invoice/warranty records. Source or manifest drift fails
before connecting; an intentional source change needs reviewed regeneration and
resealing, not disabling the hash check. Node 24 is used for these offline tests
because the helper uses the built-in TypeScript stripper; the production script
uses no type stripper or VM.

The check executes one repeatable-read, read-only transaction:

- Resolve the fixed application table names through the inherited search path,
  and require them to resolve to `public` (no hidden search-path substitution).
- Check 251 SEO base/version/child/relation columns and their PostgreSQL types,
  plus the required labels in 15 SEO enums, against the existing migration
  snapshot. Extra columns and enum labels are allowed.
- Check SELECT/INSERT/UPDATE/DELETE rights for the covered SEO tables and
  next-value permission where an `id` sequence exists. This is the full SEO
  Payload lifecycle privilege policy, including version/relation cleanup;
  a role with deliberately narrower privileges may fail even when one read-only
  page works. This does not attempt any write or sequence increment.
- Require valid, ready, non-partial, single-key unique indexes for
  `seo_runs.idempotency_key` and `seo_topics.fingerprint`. Equivalent index names
  are accepted; optional performance indexes are not a gate.
- Plan 18 captured ONE UI SELECT statements with `EXPLAIN (FORMAT JSON)`:
  case count/facets/page variants, current selection, document history, selected
  invoice/warranty records, and document register forward/backward/default/facets.
  These validate referenced columns, joins, operators and read privileges. There
  is no `ANALYZE`, application-row result query, dynamic SQL, or provider request.
- Explicitly ROLLBACK and close the client. No COMMIT is issued.

The existing snapshot supplies SEO requirements; this is not a declaration that
every historical migration must run. No new schema migration is part of the
accepted source delta. The migration ledger is not an execution dependency of
this application path, so matching ledger timestamps is not a mandatory gate.
No ledger access or migration import occurs here.

## Safety and failure handling

TLS always verifies certificates and hostname. Only URL query parameters
`sslmode` and `channel_binding` are accepted; `sslmode` must be absent or
`require`/`verify-ca`/`verify-full`, and is removed before passing the URL to `pg`
so it cannot override strict TLS. All other URL options fail closed, including
alternate-host, SSL-file and timeout overrides. A private-CA deployment may need
a separately approved CA strategy; do not add `rejectUnauthorized: false`.

Connection timeout is 5 seconds; client query timeout 6 seconds; transaction
statement/lock/idle timeouts are 5/1/10 seconds. A 45-second overall deadline
requests connection shutdown and stops initiating further queries. Failure cleanup
attempts rollback when a transaction started, then client shutdown, allowing at
most 2 seconds per cleanup wait. The CLI exits nonzero after cleanup on failure,
including a broken driver's stalled shutdown. Dropping a connection rolls back
its remaining read-only transaction. There are no retries.

Output is only `DB_COMPAT_DISABLED`, `DB_COMPAT_PASS`, or
`DB_COMPAT_FAIL_<CHECK_ID>`. Raw errors, connection strings, credentials, database
rows, metadata rows and query plans are never logged. Failed stages identify a
bounded source/configuration/schema/permission/query/cleanup check, not private
data. Do not enable driver debug logging or print caught errors to investigate;
use a separately authorized, redacted diagnostic workflow.

## Evidence and limitations

Offline verification:

```sh
node --test scripts/db-compat/preflight.test.mjs
```

12 tests pass using fake clients only: disabled zero IO, exact opt-in/no fallback,
strict TLS, actual-query/source recapture and drift, read-only sequence, safe
success/failure output, missing metadata/privileges/indexes, asynchronous driver
errors, deadline cancellation and bounded cleanup. No live check or build was run.

PASS proves only that the inherited build database/role accepted this fixed
structural/permission check at that time. It does not prove runtime credentials
refer to the same database, application authentication, customer/provider access
policy, row availability, RLS outcomes, valid stored content, all foreign-key or
write-trigger behavior, default expressions, every possible query/filter,
performance, cron delivery, publication success, static-cache freshness, or
end-to-end ONE UI behavior. EXPLAIN is not query execution and may still take
planning locks; a timeout is an inconclusive failure, not proof of missing schema.

Staged public CMS/article/list/sitemap checks and authenticated application
acceptance remain necessary for their respective claims. Public CMS success by
itself does not exercise the ONE UI joins or SEO scheduling permissions. Conversely,
optional performance-index names and migration-ledger parity must not be turned
into blanket release blockers when these fixed structural checks pass.
