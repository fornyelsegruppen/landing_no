# Optional production database compatibility preflight

## Exact native artifact-version contract correction

The subsequent `8e6a8f7` attempt failed `NATIVE_VERSION`, before the URL was sent.
Public artifact inspection identified a deterministic source-contract error:
the Linux wheel already pinned by the requirements bundles libpq **18.6**
(`180006`), while the original check required Windows-observed **18.4** (`180004`)
on every platform. Thus that exact Linux artifact necessarily failed the check.
This does not establish any database connection, schema or TLS result.

Artifact: `psycopg_binary-3.3.5-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.whl`,
SHA-256 `682a17a57415c3ca1731eec018ed031f012ffcb81ba74806eb219cb396065672`,
verified against [official PyPI release metadata](https://pypi.org/pypi/psycopg-binary/3.3.5/json).
Static ZIP/ELF inspection, without executing the wheel, found:

- WHEEL tags identify CPython 3.12 / Linux x86_64; METADATA version is 3.3.5.
- `psycopg_binary.libs/libpq-e9b5c9ac.so.5.18` exports `PQlibVersion` at file
  offset 120800, six bytes `B8 26 BF 02 00 C3`: `mov eax,180006; ret`.
- The Python extension's `DT_NEEDED` names that exact bundled libpq; its
  `DT_RPATH` is `$ORIGIN/../psycopg_binary.libs`.

Only two observed interpreter-ABI tuples now pass; every other tuple or version
fails with the same fixed `NATIVE_VERSION`, without printing runtime details:

| Python platform / `sysconfig.get_platform()` | Implementation / Python | Exact libpq |
| --- | --- | --- |
| `linux` / `linux-x86_64` | CPython 3.12 | `180006` |
| `win32` / `win-amd64` | CPython 3.12 | `180004` |

Interpreter ABI is intentional: x64 CPython under ARM64 Windows reports
`win-amd64` even when `platform.machine()` describes ARM64 host hardware.
Inherited `_PYTHON_HOST_PLATFORM` is not forwarded to the child. No broad minimum
version, architecture guess, other Python version or unverified tuple is accepted.
Package, implementation and private-origin checks remain in place.

Requirements/hashes, SQL/manifest, original URL, strict TLS, mandatory binding,
fixed CA and all deadlines are unchanged. Focused checks: 37 Node tests and 8
offline Python contract tests PASS, covering both exact tuples, wrong versions,
unknown tuples and Windows emulation. The four synthetic authentication/TLS tests
passed in the preceding transport revision and were not rerun for this pure
version-contract correction. The artifact proof was independently reproduced;
no native Linux code, production DB, deployment or remote API was invoked by this
audit. Actual Linux bootstrap/connection success remains a separate release gate.

## Pooler compatibility and credential-free bootstrap refinement

The actual native candidate reached `DB_COMPAT_FAIL_CONNECT`, after installation
but before Next. That code does not establish whether import, version, CA or a
real connection failed, and does not prove the production failure's root cause.

This refinement removes only the newly injected libpq startup `options` string.
Neon documents rejection of unsupported startup options by its transaction pooler;
our added timeout settings are not among its documented tracked startup fields.
This is a documented pooler-compatibility correction, not a proven diagnosis of
the previous run. The unchanged first SQL remains explicit repeatable-read READ
ONLY BEGIN, immediately followed by all three SET LOCAL timeouts, before any
catalog or EXPLAIN query. Binding, certificate/hostname verification, fixed CA,
URL, PG policy, client/outer deadlines, rollback and sealed SQL remain unchanged.
No unpooled URL substitution or authentication/transport fallback is introduced.

Node now sends a credential-free `initialize` request and waits for success before
writing the original URL to the child. Bootstrap reports only internally assigned
fixed failure codes: `NATIVE_IMPORT`, `NATIVE_ORIGIN`, `NATIVE_VERSION`, `NATIVE_CA`.
Each is prefixed `DB_COMPAT_FAIL_` in logs. They reveal no numeric versions,
paths, credentials, native error text/properties or metadata. Unclassified bridge
startup/protocol/timeout failures are `NATIVE_BOOTSTRAP`; after ready, connection
failures remain `CONNECT`. Unknown/malformed phase frames cannot alter diagnostics
or allow connection, and a failed bootstrap receives no URL or SQL.

Focused verification: 37 Node tests and 10 Python tests PASS. Tests cover no URL
before ready or after bootstrap failure, fixed phase sanitization, no startup
options, unchanged first-SQL read-only/timeouts sequence, and the synthetic real
libpq PLUS/downgrade/TLS tests with the new handshake. These are not production or
Linux runtime proof. No retry is authorized without new exact-SHA source review
and a separate release-owner decision.

Source: [Neon startup-parameter errors](https://neon.com/docs/connect/connection-errors)
and [transaction pooling](https://neon.com/docs/connect/connection-pooling).

## Native mandatory-binding transport candidate

Source-only change from `50005b0`: explicit `channel_binding=require` now selects
the supported libpq transport below, instead of rejecting that requirement.
The original URL is passed privately on stdin; it is not rewritten, exported,
printed, stored, or put in process arguments. Duplicate allowed URL parameters
fail with `URL_OPTIONS`. Other URL/PG policies, app driver/dependencies, tracked
build command, sealed manifest and its 18 EXPLAIN statements remain unchanged.
No remote build, production DB check or traffic change is authorized by this patch.

Default OFF still returns before any credential, manifest, native-module,
Python, installation or connection I/O. Explicit opt-in plus mandatory binding
provisions hash-pinned official PyPI binary wheels into a fresh private temporary
directory: psycopg/psycopg-binary 3.3.5, typing-extensions 4.16.0, tzdata 2026.4.
No app package or global Python installation changes. There is no source-build,
system-driver or weaker-authentication fallback. The requirements file itself is
hash sealed; imported modules must resolve inside that private installation and
match the two exact interpreter/libpq tuples above and the binary implementation.

Provisioning requires an existing `python3.12` with pip and public PyPI access;
it has a separate 120-second hard deadline, outside the subsequent 45-second DB
budget. Retained binary hashes cover Linux x64/arm64 CPython 3.12–3.14 and Windows
x64 CPython 3.12, but the runtime accepts only the two verified tuples above.
Python/pip availability and matching wheels on the actual builder
are still release-platform gates, not assumptions proved by these local tests.
`NATIVE_PREPARE` and `NATIVE_PREPARE_DEADLINE` are fixed sanitized failure suffixes;
connection/authentication/trust failures remain `CONNECT` with no native details.

The child receives only OS executable/temp-location keys, fixed binary selection,
and null pip/netrc configuration. It does not inherit PG, PIP, Python, TLS trust,
OpenSSL or credential settings. pip is isolated, hash/binary-only, fixed to PyPI,
with all configuration files disabled and keyring disabled. Runtime Python uses
`-I -S`; raw installer/native stderr is discarded. No secrets reach pip.

Public `PGconn.connect`/`exec_params` enforce `channel_binding=require`,
`sslmode=verify-full`, the fixed system trust store below, `require_auth=scram-sha-256`, disabled
client certificates and disabled GSS transport. This is low-level libpq: no
implicit psycopg transaction or context-manager COMMIT. The unchanged explicit
repeatable-read READ ONLY transaction is the first SQL; startup session options
were removed by the pooler-compatibility refinement above. Exact SQL and bound `$n` parameters cross bounded private IPC;
EXPLAIN plans never cross back. Connect/query limits remain 5/6 seconds and server
statement/lock/idle-transaction limits remain 5/1/10 seconds. Errors, EOF, malformed
or late frames permanently poison success. Cleanup rolls back/finishes or kills
and reaps the child; only its owned temporary dependency directory is removed.

Linux uses only AWS's documented AL2023 system bundle
`/etc/pki/tls/certs/ca-bundle.crt`, requiring an existing regular file and passing
that exact path to libpq. No CA contents are copied, exported or discovered, and
inherited trust overrides are not forwarded. This avoids bundled OpenSSL's
potentially different compiled default path. Windows synthetic tests alone use
`sslrootcert=system`. Vercel documents AL2023 and Python versions, but actual
builder interpreter/pip availability and CA-file presence remain unproven.
Missing trust fails closed; never copy/export credentials, scrape a host CA store, remove
binding, substitute an unverified CA or disable verification to force PASS.

Local evidence: 35 focused Node tests (21 preflight, 6 native IPC, 8 build contracts)
and 8 Python tests pass. The latter use an ephemeral synthetic TLS PostgreSQL wire
peer, not an existing DB: real pinned libpq completes SCRAM-SHA-256-PLUS and proves
certificate binding; cleartext/MD5/plain-SCRAM/trust challenges are reached and
rejected without password frames; bad server proof fails after two SASL frames;
wrong hostname and untrusted certificate fail before credentials. A synthetic
test-only CA is passed only to the wire-test child; production drops that override.
Linux path selection/missing-file rejection are unit tested, not a Linux deployment
PASS. All 18 parameterized SQL texts are checked without execution. These tests do not
prove production schema, Linux trust portability, actual application behavior or
real-server execution through the new native bridge. Independent source review
and a separate exact-SHA one-shot build approval remain required.

References: [Psycopg binary installation](https://www.psycopg.org/psycopg3/docs/basic/install.html),
[public libpq wrapper](https://www.psycopg.org/psycopg3/docs/api/pq.html),
[libpq connection policy](https://www.postgresql.org/docs/current/libpq-connect.html),
[AWS AL2023 system trust store](https://aws.amazon.com/blogs/security/how-to-configure-and-verify-acm-certificates-with-trust-stores/),
[Vercel build image](https://vercel.com/docs/builds/build-image).

## Historical diagnostic-only refinement after the tracked-gate attempt

The actual 523fe868 build invoked the gate but reported only
`DB_COMPAT_FAIL_CONNECTION`; that earlier code does not identify its cause.
This isolated source refinement changes diagnostics only. URL/environment
acceptance, strict TLS, SQL/manifest, timeouts, cleanup, default-OFF behavior and
tracked build command are unchanged. It authorizes no remote retry or bypass.

New failure suffixes (each is prefixed `DB_COMPAT_FAIL_`):

| Fixed suffix | Meaning, without identifying any secret/key/value |
| --- | --- |
| `ENV_OVERRIDE` | A non-allowlisted inherited PG setting was rejected. |
| `URL_MISSING` | The sole permitted database URL was absent or empty. |
| `URL_PARSE` | URL parsing failed. |
| `URL_SCHEME` | URL scheme was not PostgreSQL. |
| `URL_REQUIRED_FIELDS` | A required URL component was absent. |
| `URL_OPTIONS` | A URL option was not allowlisted. |
| `TLS_MODE` | The explicit URL TLS mode was not accepted. |
| `CHANNEL_BINDING_REQUIRED_UNSUPPORTED` | Historical pre-native rejection; superseded by the native candidate above. |
| `CHANNEL_BINDING_OPTION` | Another channel-binding option was not accepted. |
| `URL_CONFIG` | An unexpected failure occurred while obtaining/validating URL configuration. |
| `DRIVER_CREATE` | Driver import, client construction or initial listener setup failed. |
| `CONNECT` | Establishing the connection failed; this does not disclose whether DNS, network, TLS or authentication caused it. |
| `BEGIN_READ_ONLY` | Starting the read-only transaction failed. |
| `SESSION_STATEMENT_TIMEOUT` / `SESSION_LOCK_TIMEOUT` / `SESSION_IDLE_TIMEOUT` | Setting that transaction-local timeout failed. |

Configuration codes are attached only to internally created failures in a private
WeakMap. External error messages, codes, causes and stacks are never read or
logged, including hostile properties. Other existing check IDs are unchanged.
Configuration rejection is not proof of missing schema; do not remove URL
requirements, relax TLS/PG policy or inspect secrets to force PASS.

Focused verification: 19 helper tests plus 8 build-contract tests PASS (27 total),
all offline. Added negative fixtures assert exact fixed codes and malicious-error
suppression; existing connection, SQL capture, default-OFF and cleanup tests remain.
No database, build, application, browser or remote operation was run for this
refinement. Independent review and a separate exact-SHA GO remain required before
any subsequent production-target check.

Status: helper source accepted; actual Production compatibility remains unproven.
The current narrow wiring correction invokes the unchanged default-OFF helper
from tracked vercel.json before guarded Next, chained with `&&`. A normal build
only reports DB_COMPAT_DISABLED and does not load credentials, manifest/source,
driver or connect to a database. This is a structure/permissions gate, not a
production readiness certificate. No migration or runtime guard is introduced.

The earlier91dd5be staged attempt is BUILD-only: deployment metadata reflected
the alternate preflight command, but actual logs executed the original uploaded
tracked command without preflight. The tracked-wiring correction needs independent
review and a separate new-SHA remote GO. No Production helper PASS is claimed.

## Invocation and release boundary

`node scripts/db-compat/preflight.mjs` is OFF when
`SEO_DB_COMPAT_PREFLIGHT` is absent, `0`, or `false`. It returns success with
`DB_COMPAT_DISABLED` before reading credentials, source files, the manifest, or
loading `pg`. Other values fail unless the flag is exactly `1` and the inherited
`VERCEL_ENV` is exactly `production`.

An actual check needs separate release-owner approval. It uses only the existing,
inherited `DATABASE_URL`, including a required nonempty URL password; there is no
dotenv loading, URL export, migration URL,
fallback database, new credential, or new privilege. Do not put credentials in
arguments, files, command output, or documentation. Never run it through
`npm run build`, Payload bootstrap, or a migration/status wrapper.

After independent source acceptance, the owner may explicitly opt it in for one
protected Production-target build without assigning the public domain, and use
this command ordering now present in the tracked build configuration:

```sh
node scripts/db-compat/preflight.mjs && PAYLOAD_BUILD_WITHOUT_DB=1 next build --webpack
```

Supply the opt-in only through `--build-env SEO_DB_COMPAT_PREFLIGHT=1` for the
separately authorized one-shot build, never runtime `--env` or permanent inline1.
Do not use the obsolete alternate config from the first failed-gate attempt.
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
including selected invoice/warranty records. A separate field-coverage test checks
every current persisted Posts/SeoTopics/SeoRuns field, including post draft-version
fields, nested arrays/groups, relationship columns and select labels, against the
snapshot-derived manifest. Source or manifest drift fails
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
so it cannot override strict TLS. `channel_binding` may be absent, `prefer`, or
`disable`; those values map explicitly to the pinned pg driver's
`enableChannelBinding` option. `channel_binding=require` selects only the native
mandatory-binding transport described above. No fallback to pg occurs if it fails.
Transport failure is inconclusive, not missing DB schema; do not remove or rewrite
the requirement from the original production URL to force PASS.
All other URL options fail closed, including
alternate-host, SSL-file and timeout overrides. A private-CA deployment may need
a separately approved CA strategy; do not add `rejectUnauthorized: false`.

The URL must contain username, password, host and database; an omitted port is
explicitly fixed to 5432. This prevents pgpass and credential/port fallback.
Common inherited `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`,
`PGSSLMODE`, `PGAPPNAME` and `PGCONNECT_TIMEOUT` aliases are ignored by the complete
URL/explicit options (verified with actual offline `pg.Client` construction).
Other `PG*` settings, including session options, service files and pgpass files,
fail closed without reading their values or modifying the environment. This too
is unsupported configuration/inconclusive evidence, not a schema failure.

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

16 offline tests pass using fake clients and unconnected real driver construction:
disabled zero IO, exact opt-in/no fallback,
strict TLS, actual-query/source recapture and drift, read-only sequence, safe
success/failure output, missing metadata/privileges/indexes, asynchronous driver
errors, deadline cancellation and bounded cleanup. The tests also cover inherited
alias behavior, source-field/snapshot coverage and missing-public-schema NULL
handling. No production check or build was run.

The separate `local-check.mjs` harness defaults OFF. Only its exact
`--run-approved-local` argument enables the hardcoded synthetic loopback target
`127.0.0.1:55432`, database `seo_automation_browser_20260912`, role `phase2b_qa`.
It accepts no URL or target override, verifies database/server/role/read-only
identity inside the transaction, and injects that local test client without
changing production TLS. It performs the same catalogs and all 18 EXPLAINs, then
rolls back/closes; it creates or changes no fixtures. Under the release owner's
explicit local-only authorization, this harness returned `DB_COMPAT_PASS` on
2026-09-13. It also verified the NULL-safe boolean aggregate on real PostgreSQL.
That local PASS establishes query/catalog validity against this fixture only,
not actual production compatibility.

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
