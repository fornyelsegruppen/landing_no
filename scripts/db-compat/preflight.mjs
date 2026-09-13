// Opt-in STRUCTURE/PERMISSIONS check only. Never bootstrap Payload or migrate.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url);
export const MANIFEST_SHA256 = 'b5a12d160007afb102d19e9c90315c8fc5fc4c7483610a00a1fe315d7bc73de2';
const hash = text => createHash('sha256').update(text).digest('hex');
const normalize = text => text.replace(/\r\n/g, '\n');
// Only internally created configuration failures can select a diagnostic code.
// Driver/parser error properties, messages and causes are never inspected/logged.
const configurationFailures = new WeakMap();
const configurationFailure = code => {
  const error = new Error('CONFIGURATION');
  configurationFailures.set(error, code);
  return error;
};
const columnsSql = `SELECT c.relname AS table_name, a.attname AS column_name,
  t.typname AS type_name, tn.nspname AS type_schema
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace
WHERE n.nspname='public' AND c.relname=ANY($1::text[])
AND a.attnum>0 AND NOT a.attisdropped`;
const permissionsSql = `SELECT c.relname AS table_name,
  pg_catalog.has_table_privilege(c.oid,'SELECT') AS can_select,
  pg_catalog.has_table_privilege(c.oid,'INSERT') AS can_insert,
  pg_catalog.has_table_privilege(c.oid,'UPDATE') AS can_update,
  pg_catalog.has_table_privilege(c.oid,'DELETE') AS can_delete,
  CASE WHEN pg_catalog.pg_get_serial_sequence(format('%I.%I',n.nspname,c.relname),'id') IS NULL
    THEN true ELSE pg_catalog.has_sequence_privilege(
      pg_catalog.pg_get_serial_sequence(format('%I.%I',n.nspname,c.relname),'id'),'USAGE,UPDATE') END AS can_nextval
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname=ANY($1::text[])`;
const uniqueSql = `SELECT t.relname AS table_name, a.attname AS column_name
FROM pg_catalog.pg_index x
JOIN pg_catalog.pg_class t ON t.oid=x.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=x.indkey[0]
WHERE n.nspname='public' AND t.relname IN ('seo_runs','seo_topics')
AND x.indisunique AND x.indisvalid AND x.indisready
AND x.indnkeyatts=1 AND x.indpred IS NULL AND x.indexprs IS NULL`;

export async function loadArtifact(read = file => readFile(new URL(file, root), 'utf8')) {
  const text = normalize(await read('scripts/db-compat/manifest.json'));
  if (hash(text) !== MANIFEST_SHA256) throw new Error('MANIFEST');
  const manifest = JSON.parse(text);
  for (const [file, expected] of Object.entries(manifest.sourceHashes)) {
    if (hash(normalize(await read(file))) !== expected) throw new Error('SOURCE');
  }
  // A sealed manifest is the allowlist, not SQL supplied through environment/CLI.
  for (const query of manifest.queries) {
    if (!/^(SELECT|WITH)\s/i.test(query.text) || query.text.includes(';') ||
      !/^[A-Z_]+[0-9]*$/.test(query.id)) throw new Error('QUERY');
  }
  return manifest;
}

export function connectionOptions(raw) {
  if (!raw) throw configurationFailure('URL_MISSING');
  let url;
  try { url = new URL(raw); }
  catch { throw configurationFailure('URL_PARSE'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw configurationFailure('URL_SCHEME');
  if (!url.hostname || !url.username || !url.password || url.pathname.length < 2) {
    throw configurationFailure('URL_REQUIRED_FIELDS');
  }
  for (const key of ['sslmode', 'channel_binding']) {
    if (url.searchParams.getAll(key).length > 1) throw configurationFailure('URL_OPTIONS');
  }
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode && !['require', 'verify-ca', 'verify-full'].includes(sslmode)) throw configurationFailure('TLS_MODE');
  for (const key of url.searchParams.keys()) {
    // pg lets URL query options override explicit client options. Do not allow
    // alternate hosts, SSL files, timeouts, session options or credential sources.
    if (!['sslmode', 'channel_binding'].includes(key)) throw configurationFailure('URL_OPTIONS');
  }
  // Mandatory binding is handled only by the supported native libpq transport.
  // pg remains unchanged for URLs that do not require channel binding.
  const binding = url.searchParams.get('channel_binding');
  if (binding && !['prefer', 'disable', 'require'].includes(binding)) {
    throw configurationFailure('CHANNEL_BINDING_OPTION');
  }
  // Translate supported transport options explicitly; URL parser options must
  // not override certificate/hostname verification or fixed timeouts.
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');
  if (!url.port) url.port = '5432';
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true },
    ...(binding === 'require' ? { nativeConnectionString: raw } : {}),
    connectionTimeoutMillis: 5000, query_timeout: 6000,
    enableChannelBinding: binding === 'prefer',
    application_name: 'seo-one-ui-compat-preflight' };
}

export async function runPreflight({
  environment = process.env,
  log = line => console.log(line),
  load = loadArtifact,
  createClient = async options => {
    if (options.nativeConnectionString) {
      const { NativeClient } = await import('./native-client.mjs');
      return new NativeClient(options);
    }
    const { default: pg } = await import('pg'); return new pg.Client(options);
  },
  deadlineMs = 45000,
  provisionDeadlineMs = 120000,
  cleanupTimeoutMs = 2000,
} = {}) {
  // No file/credential/driver/database access on the normal build path.
  if ([undefined, '0', 'false'].includes(environment.SEO_DB_COMPAT_PREFLIGHT)) {
    log('DB_COMPAT_DISABLED');
    return 0;
  }
  let check = 'OPT_IN', client, timer, rejectDeadline, began = false, ending, cancelled = false;
  const close = () => {
    if (client && !ending) ending = Promise.resolve().then(() => client.end());
    return ending || Promise.resolve();
  };
  const startDeadline = (duration, phase = 'DEADLINE') => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      cancelled = true; check = phase;
      void close().catch(() => {}); rejectDeadline(new Error('DEADLINE'));
    }, duration);
  };
  const query = (...args) => {
    if (cancelled) throw new Error('DEADLINE');
    return client.query(...args);
  };
  const boundedCleanup = async work => {
    let cleanupTimer;
    try {
      await Promise.race([Promise.resolve().then(work), new Promise(resolve => {
        cleanupTimer = setTimeout(resolve, cleanupTimeoutMs);
      })]);
    } catch { /* Never expose driver errors during cleanup. */ }
    finally { clearTimeout(cleanupTimer); }
  };
  const work = async () => {
    if (environment.SEO_DB_COMPAT_PREFLIGHT !== '1' || environment.VERCEL_ENV !== 'production') throw new Error('OPT_IN');
    check = 'SOURCE';
    const manifest = await load();
    if (cancelled) throw new Error('DEADLINE');
    check = 'ENV_OVERRIDE';
    // These common integration aliases cannot override the complete URL and
    // explicit client options. Other PG* settings can change session semantics.
    // Never read or mutate their values; the URL password prevents pgpass lookup.
    const ignoredAliases = ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGPASSWORD',
      'PGSSLMODE', 'PGAPPNAME', 'PGCONNECT_TIMEOUT'];
    if (Object.keys(environment).some(key => /^PG/i.test(key) &&
      !ignoredAliases.includes(key.toUpperCase()))) throw new Error('DATABASE_CONFIG');
    check = 'URL_CONFIG';
    const options = connectionOptions(environment.DATABASE_URL);
    check = 'DRIVER_CREATE';
    client = await createClient(options);
    if (cancelled) { await close(); throw new Error('DEADLINE'); }
    // Suppress EventEmitter's raw idle-connection error output; query/cleanup
    // failures still fail the gate. Any async connection error poisons success.
    let connectionError = false;
    client.on('error', () => { connectionError = true; });
    if (options.nativeConnectionString) {
      // Provisioning has its own hard budget, outside the 45s database budget.
      check = 'NATIVE_PREPARE';
      startDeadline(provisionDeadlineMs, 'NATIVE_PREPARE_DEADLINE');
      await client.prepare();
      if (cancelled) throw new Error('DEADLINE');
      startDeadline(deadlineMs);
    }
    check = 'CONNECT';
    await client.connect();
    if (cancelled) throw new Error('DEADLINE');
    check = 'BEGIN_READ_ONLY';
    await query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    began = true;
    check = 'SESSION_STATEMENT_TIMEOUT';
    await query("SET LOCAL statement_timeout = '5s'");
    check = 'SESSION_LOCK_TIMEOUT';
    await query("SET LOCAL lock_timeout = '1s'");
    check = 'SESSION_IDLE_TIMEOUT';
    await query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    check = 'SEARCH_PATH';
    // Raw ONE UI queries are unqualified: validate their actual resolution,
    // without changing search_path to hide a deployment configuration mismatch.
    const tables = [...new Set(manifest.columns.map(c => c.table))];
    const names = [...new Set([...tables, 'leads', 'users', 'roof_measurements', 'price_calculations',
      'quotes', 'contracts', 'messages', 'work_orders', 'private_media', 'change_agreements',
      'invoice_records', 'official_invoices', 'warranties'])];
    const resolution = await query(`SELECT bool_and(COALESCE(
      to_regclass(format('%I',name)) IS NOT NULL AND
      to_regclass(format('%I',name)) = to_regclass(format('public.%I',name)), false)) AS ok
      FROM unnest($1::text[]) AS name`, [names]);
    if (resolution.rows[0]?.ok !== true) throw new Error('SEARCH_PATH');
    check = 'SEO_COLUMNS';
    const columns = await query(columnsSql, [tables]);
    for (const expected of manifest.columns) {
      const actual = columns.rows.find(c => c.table_name === expected.table && c.column_name === expected.column);
      if (!actual || actual.type_name !== expected.type ||
        actual.type_schema !== (expected.type.startsWith('enum_') ? 'public' : 'pg_catalog')) throw new Error('SEO_COLUMNS');
    }
    check = 'SEO_ENUMS';
    const enums = await query(`SELECT t.typname AS name, e.enumlabel AS value
      FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
      WHERE n.nspname='public' AND t.typname=ANY($1::text[])`, [manifest.enums.map(e => e.name)]);
    for (const expected of manifest.enums) {
      if (expected.values.some(value => !enums.rows.some(e => e.name === expected.name && e.value === value))) throw new Error('SEO_ENUMS');
    }
    check = 'SEO_PERMISSIONS';
    const permissions = await query(permissionsSql, [tables]);
    if (permissions.rows.length !== tables.length || permissions.rows.some(r =>
      !r.can_select || !r.can_insert || !r.can_update || !r.can_delete || !r.can_nextval)) throw new Error('SEO_PERMISSIONS');
    check = 'SEO_UNIQUENESS';
    const indexes = await query(uniqueSql);
    for (const [table, column] of [['seo_runs', 'idempotency_key'], ['seo_topics', 'fingerprint']]) {
      if (!indexes.rows.some(i => i.table_name === table && i.column_name === column)) throw new Error('SEO_UNIQUENESS');
    }
    for (const statement of manifest.queries) {
      if (cancelled) throw new Error('DEADLINE');
      check = statement.id;
      // Deliberately no ANALYZE: rows, private documents and volatile operations
      // are never evaluated. Plans stay in memory and are not logged.
      await query(`EXPLAIN (FORMAT JSON) ${statement.text}`, statement.values);
    }
    check = 'CLEANUP';
    await query('ROLLBACK');
    began = false;
    await close();
    if (connectionError) throw new Error('CONNECTION');
  };
  try {
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    startDeadline(deadlineMs);
    await Promise.race([work(), deadline]);
    log('DB_COMPAT_PASS');
    return 0;
  } catch (error) {
    check = configurationFailures.get(error) || check;
    log(`DB_COMPAT_FAIL_${check}`);
    return 1;
  } finally {
    clearTimeout(timer);
    if (began && !ending) await boundedCleanup(() => client.query('ROLLBACK'));
    await boundedCleanup(close);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // A broken driver's end() must not keep an opted-in build alive indefinitely.
  // runPreflight has already attempted rollback/end; process exit drops sockets.
  const result = await runPreflight();
  if (result !== 0) process.exit(result);
  process.exitCode = result;
}
