import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import pg from 'pg';
import { captureManifest, root } from './capture.mjs';
import { connectionOptions, loadArtifact, runPreflight } from './preflight.mjs';

const environment = { SEO_DB_COMPAT_PREFLIGHT: '1', VERCEL_ENV: 'production',
  DATABASE_URL: 'postgresql://synthetic:never-real@example.invalid/synthetic?sslmode=require&channel_binding=prefer' };
const read = file => readFile(new URL(file, root), 'utf8');
const manifest = JSON.parse(await read('scripts/db-compat/manifest.json'));
const secretError = () => new Error('postgresql://secret:user@private.invalid/db CUSTOMER PRIVATE PLAN');

function fixture(fail = () => false) {
  const calls = [], logs = [];
  const client = new EventEmitter();
  client.connect = async () => { calls.push('connect'); if (fail('connect')) throw secretError(); };
  client.end = async () => { calls.push('end'); if (fail('end')) throw secretError(); };
  client.query = async (text, values) => {
    calls.push(text);
    if (fail(text)) throw secretError();
    if (text.includes('bool_and')) return { rows: [{ ok: true }] };
    if (text.includes('t.typname AS type_name')) return { rows: manifest.columns.map(c => ({
      table_name: c.table, column_name: c.column, type_name: c.type,
      type_schema: c.type.startsWith('enum_') ? 'public' : 'pg_catalog',
    })) };
    if (text.includes('e.enumlabel')) return { rows: manifest.enums.flatMap(e => e.values.map(value => ({ name: e.name, value }))) };
    if (text.includes('AS can_select')) return { rows: values[0].map(table_name => ({ table_name,
      can_select: true, can_insert: true, can_update: true, can_delete: true, can_nextval: true })) };
    if (text.includes('x.indisunique')) return { rows: [
      { table_name: 'seo_runs', column_name: 'idempotency_key' },
      { table_name: 'seo_topics', column_name: 'fingerprint' },
    ] };
    return { rows: [{ 'QUERY PLAN': 'PRIVATE PLAN NEVER LOG' }] };
  };
  const options = { environment, load: async () => manifest,
    createClient: async () => client, log: message => logs.push(message) };
  return { client, calls, logs, options };
}

test('disabled is zero credential/file/driver/connection IO', async () => {
  for (const flag of [undefined, '0', 'false']) {
    const env = new Proxy({}, { get: (_target, key) => {
      assert.equal(key, 'SEO_DB_COMPAT_PREFLIGHT'); return flag;
    } });
    const no = async () => { assert.fail('disabled must not do IO'); };
    const logs = [];
    assert.equal(await runPreflight({ environment: env, load: no, createClient: no, log: s => logs.push(s) }), 0);
    assert.deepEqual(logs, ['DB_COMPAT_DISABLED']);
  }
});

test('requires exact opt-in, Production target, and DATABASE_URL only', async () => {
  for (const env of [{ ...environment, SEO_DB_COMPAT_PREFLIGHT: 'true' },
    { ...environment, VERCEL_ENV: 'preview' },
    { SEO_DB_COMPAT_PREFLIGHT: '1', VERCEL_ENV: 'production', DATABASE_URL_MIGRATE: environment.DATABASE_URL }]) {
    const f = fixture();
    assert.equal(await runPreflight({ ...f.options, environment: env }), 1);
    assert.deepEqual(f.calls, []);
    assert.match(f.logs[0], /^DB_COMPAT_FAIL_(OPT_IN|URL_MISSING)$/);
  }
});

test('strict TLS cannot be overridden by URL ssl parameters or inherited PG defaults', () => {
  const config = connectionOptions(environment.DATABASE_URL);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
  assert.equal(new URL(config.connectionString).searchParams.has('channel_binding'), false);
  assert.equal(config.enableChannelBinding, true);
  assert.equal(new URL(config.connectionString).port, '5432');
  assert.equal(config.connectionTimeoutMillis, 5000);
  assert.equal(config.query_timeout, 6000);
  for (const raw of ['', 'file:./fallback.db', 'postgresql://x@host/db',
    'postgresql://x:y@host/db?sslmode=disable', 'postgresql://x:y@host/db?ssl=false',
    'postgresql://x:y@host/db?sslrootcert=/secret', 'postgresql://x:y@host/db?query_timeout=0',
    'postgresql://x:y@host/db?host=elsewhere', 'postgresql://x:y@host/db?options=-c%20statement_timeout%3D0']) {
    assert.throws(() => connectionOptions(raw));
  }
});

test('inherited PG settings fail before driver creation and cannot select pgpass', async () => {
  for (const key of ['PGOPTIONS', 'PGCLIENT_ENCODING', 'PGREPLICATION', 'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE']) {
    const f = fixture();
    assert.equal(await runPreflight({ ...f.options, environment: { ...environment, [key]: 'never-log-this' } }), 1);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_ENV_OVERRIDE']);
  }
});

test('configuration failures have fixed distinct codes and never construct a driver', async () => {
  for (const [raw, code] of [
    [undefined, 'URL_MISSING'], ['', 'URL_MISSING'], ['not a URL PRIVATE', 'URL_PARSE'],
    ['https://synthetic:private@example.invalid/db', 'URL_SCHEME'],
    ['postgresql://synthetic@example.invalid/db', 'URL_REQUIRED_FIELDS'],
    ['postgresql://synthetic:private@example.invalid/', 'URL_REQUIRED_FIELDS'],
    ['postgresql://synthetic:private@example.invalid/db?host=PRIVATE', 'URL_OPTIONS'],
    ['postgresql://synthetic:private@example.invalid/db?sslrootcert=PRIVATE', 'URL_OPTIONS'],
    ['postgresql://synthetic:private@example.invalid/db?channel_binding=prefer&channel_binding=require', 'URL_OPTIONS'],
    ['postgresql://synthetic:private@example.invalid/db?channel_binding=require&channel_binding=prefer', 'URL_OPTIONS'],
    ['postgresql://synthetic:private@example.invalid/db?sslmode=require&sslmode=verify-full', 'URL_OPTIONS'],
    ['postgresql://synthetic:private@example.invalid/db?sslmode=no-verify', 'TLS_MODE'],
    ['postgresql://synthetic:private@example.invalid/db?channel_binding=PRIVATE', 'CHANNEL_BINDING_OPTION'],
  ]) {
    const f = fixture();
    let created = false;
    assert.equal(await runPreflight({ ...f.options,
      environment: { ...environment, DATABASE_URL: raw },
      createClient: async () => { created = true; throw secretError(); },
    }), 1);
    assert.equal(created, false);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.logs, [`DB_COMPAT_FAIL_${code}`]);
  }
});

test('mandatory binding preserves original URL for native-only enforcement', () => {
  const raw = environment.DATABASE_URL.replace('channel_binding=prefer', 'channel_binding=require');
  const options = connectionOptions(raw);
  assert.equal(options.nativeConnectionString, raw);
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal(connectionOptions(environment.DATABASE_URL).nativeConnectionString, undefined);
});

test('native provisioning has a separate bounded budget and never consumes the DB budget', async () => {
  const nativeEnv = { ...environment, DATABASE_URL: environment.DATABASE_URL.replace('binding=prefer', 'binding=require') };
  const f = fixture();
  f.client.prepare = async () => { await new Promise(resolve => setTimeout(resolve, 25)); };
  assert.equal(await runPreflight({ ...f.options, environment: nativeEnv, deadlineMs: 15, provisionDeadlineMs: 100 }), 0);
  assert.deepEqual(f.calls.slice(0, 5), ['connect',
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    "SET LOCAL statement_timeout = '5s'", "SET LOCAL lock_timeout = '1s'",
    "SET LOCAL idle_in_transaction_session_timeout = '10s'"]);
  const blocked = fixture();
  blocked.client.prepare = async () => new Promise(() => {});
  assert.equal(await runPreflight({ ...blocked.options, environment: nativeEnv, deadlineMs: 100, provisionDeadlineMs: 5 }), 1);
  assert.deepEqual(blocked.logs, ['DB_COMPAT_FAIL_NATIVE_PREPARE_DEADLINE']);
  assert.deepEqual(blocked.calls, ['end']);
});

test('native bootstrap diagnostics use fixed phases without logging external errors', async () => {
  const nativeEnv = { ...environment, DATABASE_URL: environment.DATABASE_URL.replace('binding=prefer', 'binding=require') };
  for (const phase of ['NATIVE_IMPORT', 'NATIVE_ORIGIN', 'NATIVE_VERSION', 'NATIVE_CA', 'PRIVATE']) {
    const f = fixture();
    f.client.prepare = async () => {};
    f.client.connect = async () => {
      f.client.emit('preflightPhase', 'NATIVE_BOOTSTRAP');
      f.client.emit('preflightPhase', phase);
      throw secretError();
    };
    assert.equal(await runPreflight({ ...f.options, environment: nativeEnv }), 1);
    assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_' + (phase === 'PRIVATE' ? 'NATIVE_BOOTSTRAP' : phase)]);
    assert.deepEqual(f.calls, ['end']);
  }
});

test('driver, connect, readonly BEGIN and each session timeout have distinct safe phases', async () => {
  for (const [at, code] of [
    ['connect', 'CONNECT'], ['BEGIN', 'BEGIN_READ_ONLY'],
    ['SET LOCAL statement_timeout', 'SESSION_STATEMENT_TIMEOUT'],
    ['SET LOCAL lock_timeout', 'SESSION_LOCK_TIMEOUT'],
    ['SET LOCAL idle_in_transaction_session_timeout', 'SESSION_IDLE_TIMEOUT'],
  ]) {
    const f = fixture(text => text.includes(at));
    assert.equal(await runPreflight(f.options), 1);
    assert.deepEqual(f.logs, [`DB_COMPAT_FAIL_${code}`]);
    assert.equal(f.calls.at(-1), 'end');
  }
  const f = fixture();
  assert.equal(await runPreflight({ ...f.options, createClient: async () => { throw secretError(); } }), 1);
  assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_DRIVER_CREATE']);
});

test('malicious external error properties cannot select or leak diagnostic codes', async () => {
  for (const error of [Object.assign(secretError(), { code: 'URL_MISSING', safeCode: 'PRIVATE' }),
    { code: 'PRIVATE', message: 'PRIVATE', stack: 'PRIVATE', cause: 'PRIVATE' }, 'PRIVATE', null]) {
    const f = fixture();
    assert.equal(await runPreflight({ ...f.options, createClient: async () => { throw error; } }), 1);
    assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_DRIVER_CREATE']);
  }
  const hostile = new Error();
  for (const key of ['code', 'safeCode', 'message', 'stack', 'cause']) {
    Object.defineProperty(hostile, key, { get() { assert.fail('must not inspect untrusted error properties'); } });
  }
  const f = fixture();
  f.client.connect = async () => { throw hostile; };
  assert.equal(await runPreflight(f.options), 1);
  assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_CONNECT']);
});

test('common PG credential aliases are ignored by actual pg in an offline child process', async () => {
  const aliases = { PGHOST: 'wrong.invalid', PGPORT: '6543', PGUSER: 'wrong',
    PGDATABASE: 'wrong', PGPASSWORD: 'wrong', PGSSLMODE: 'no-verify',
    PGAPPNAME: 'wrong', PGCONNECT_TIMEOUT: '999' };
  const f = fixture();
  assert.equal(await runPreflight({ ...f.options, environment: { ...environment, ...aliases } }), 0);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import pg from 'pg';
    import { connectionOptions } from './scripts/db-compat/preflight.mjs';
    const c = new pg.Client(connectionOptions(${JSON.stringify(environment.DATABASE_URL)}));
    const p = c.connectionParameters;
    assert.equal(p.host, 'example.invalid'); assert.equal(p.port, 5432);
    assert.equal(p.user, 'synthetic'); assert.equal(p.database, 'synthetic');
    assert.equal(p.password, 'never-real');
    assert.deepEqual(p.ssl, { rejectUnauthorized: true });
    assert.equal(p.application_name, 'seo-one-ui-compat-preflight');
    assert.equal(c._connectionTimeoutMillis, 5000);
  `], { cwd: root, env: { ...process.env, ...aliases }, encoding: 'utf8' });
  // Never forward child output, even an unexpected driver error.
  assert.equal(child.status, 0, 'offline driver alias contract failed');
});

test('actual pinned pg construction preserves fixed TLS, credentials and timeouts without connecting', () => {
  const client = new pg.Client(connectionOptions(environment.DATABASE_URL));
  const p = client.connectionParameters;
  assert.equal(p.host, 'example.invalid');
  assert.equal(p.port, 5432);
  assert.equal(p.user, 'synthetic');
  assert.equal(p.password, 'never-real');
  assert.equal(p.database, 'synthetic');
  assert.deepEqual(p.ssl, { rejectUnauthorized: true });
  assert.equal(p.query_timeout, 6000);
  assert.equal(client._connectionTimeoutMillis, 5000);
  assert.equal(client.enableChannelBinding, true);
});

test('sealed artifact exactly matches SQL captured from accepted source, including selected records', async () => {
  assert.deepEqual(await captureManifest(), manifest);
  assert.deepEqual(await loadArtifact(), manifest);
  assert.equal(manifest.queries.length, 18);
  assert.match(manifest.queries.find(q => q.id === 'SELECTED_RECORDS_1').text, /r\.subtotal_ex_vat_ore/);
  assert.match(manifest.queries.find(q => q.id === 'SELECTED_RECORDS_2').text, /r\.terms_version/);
  for (const q of manifest.queries) {
    assert.match(q.text, /^(SELECT|WITH)\s/);
    assert.doesNotMatch(q.text, /\b(INSERT|UPDATE|DELETE|CALL|COPY|ANALYZE)\b/i);
  }
});

test('snapshot covers every current persisted SEO collection field, including draft versions', async () => {
  const snake = value => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replaceAll('-', '_').toLowerCase();
  const has = (table, column) => assert.ok(manifest.columns.some(c => c.table === table && c.column === column),
    `missing source field: ${table}.${column}`);
  function visit(fields, table, prefix = '') {
    for (const field of fields) {
      if (field.type === 'ui') continue;
      const name = prefix + snake(field.name);
      if (field.type === 'group') visit(field.fields, table, name + '_');
      else if (field.type === 'array') visit(field.fields, table + '_' + name);
      else if (field.type === 'relationship' && field.hasMany) {
        has(table + '_rels', 'path'); has(table + '_rels', snake(field.relationTo) + '_id');
      } else {
        const relation = ['relationship', 'upload'].includes(field.type);
        has(table, name + (relation ? '_id' : ''));
        if (field.type === 'select') {
          const column = manifest.columns.find(c => c.table === table && c.column === name);
          const values = manifest.enums.find(e => e.name === column.type)?.values;
          for (const option of field.options) assert.ok(values?.includes(typeof option === 'string' ? option : option.value));
        }
      }
    }
  }
  for (const [file, table] of [['Posts', 'posts'], ['SeoTopics', 'seo_topics'], ['SeoRuns', 'seo_runs']]) {
    const source = stripTypeScriptTypes(await read(`src/payload/collections/${file}.ts`));
    // Evaluate only the literal fields array; no imports, hooks or validators run.
    const fieldsSource = source.match(/\n  fields: (\[[\s\S]*\]),?\s*\};\s*$/)?.[1];
    assert.ok(fieldsSource);
    const fields = runInNewContext('(' + fieldsSource + ')', {}, { timeout: 1000 });
    visit(fields, table);
    if (table === 'posts') visit(fields, '_posts_v', 'version_');
  }
});

test('manifest and source drift fail before a connection exists', async () => {
  for (const target of ['scripts/db-compat/manifest.json', ...Object.keys(manifest.sourceHashes)]) {
    const f = fixture();
    assert.equal(await runPreflight({ ...f.options, load: () => loadArtifact(async file =>
      (await read(file)) + (file === target ? '\n/* changed */' : '')) }), 1);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_SOURCE']);
  }
});

test('success performs catalog reads + EXPLAIN only inside readonly transaction and closes', async () => {
  const f = fixture();
  assert.equal(await runPreflight(f.options), 0);
  assert.deepEqual(f.logs, ['DB_COMPAT_PASS']);
  assert.equal(f.calls[1], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(f.calls.filter(s => s.startsWith('EXPLAIN (FORMAT JSON) ')).length, 18);
  assert.match(f.calls.find(s => s.includes('bool_and')), /bool_and\(COALESCE\(/);
  assert.deepEqual(f.calls.slice(-2), ['ROLLBACK', 'end']);
  assert.equal(f.calls.filter(s => s === 'end').length, 1);
  for (const sql of f.calls.slice(1, -1)) {
    assert.match(sql, /^(BEGIN|SET LOCAL|SELECT|EXPLAIN|ROLLBACK)\b/);
    assert.doesNotMatch(sql, /EXPLAIN[^\n]*ANALYZE/);
  }
});

test('failures are sanitized and attempt rollback/close; never pass after query failure', async () => {
  for (const at of ['connect', 'BEGIN', 'SET LOCAL', 'bool_and', 'pg_catalog.pg_attribute',
    'e.enumlabel', 'AS can_select', 'x.indisunique', 'EXPLAIN', 'ROLLBACK', 'end']) {
    const f = fixture(text => text.includes(at));
    assert.equal(await runPreflight(f.options), 1);
    assert.equal(f.calls.at(-1), 'end');
    if (!['connect', 'BEGIN'].includes(at)) assert.ok(f.calls.includes('ROLLBACK'));
    assert.equal(f.logs.length, 1);
    assert.match(f.logs[0], /^DB_COMPAT_FAIL_[A-Z_0-9]+$/);
    assert.doesNotMatch(JSON.stringify(f.logs), /secret|private|postgres|CUSTOMER|PLAN/);
  }
});

test('missing metadata/permissions/uniqueness fails closed', async () => {
  for (const match of ['bool_and', 'pg_catalog.pg_attribute', 'e.enumlabel', 'AS can_select', 'x.indisunique']) {
    const f = fixture();
    const query = f.client.query;
    f.client.query = async (text, values) => text.includes(match) ? { rows: [] } : query(text, values);
    assert.equal(await runPreflight(f.options), 1);
    assert.ok(f.calls.includes('ROLLBACK'));
    assert.equal(f.calls.at(-1), 'end');
  }
});

test('idle driver errors cannot become successful checks or raw uncaught errors', async () => {
  const f = fixture();
  const query = f.client.query;
  f.client.query = async (text, values) => {
    if (text.startsWith('EXPLAIN')) f.client.emit('error', secretError());
    return query(text, values);
  };
  assert.equal(await runPreflight(f.options), 1);
  assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_CLEANUP']);
});

test('overall deadline closes connection and suppresses delayed work', async () => {
  const f = fixture();
  f.client.query = async () => new Promise(() => {});
  assert.equal(await runPreflight({ ...f.options, deadlineMs: 10 }), 1);
  assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_DEADLINE']);
  assert.equal(f.calls.at(-1), 'end');
  const delayed = fixture();
  assert.equal(await runPreflight({ ...delayed.options, deadlineMs: 5,
    load: async () => { await new Promise(r => setTimeout(r, 15)); return manifest; } }), 1);
  await new Promise(r => setTimeout(r, 25));
  assert.deepEqual(delayed.calls, []);
});

test('cleanup remains bounded when a broken driver never finishes end', async () => {
  const f = fixture();
  f.client.end = async () => { f.calls.push('end'); return new Promise(() => {}); };
  assert.equal(await runPreflight({ ...f.options, deadlineMs: 10, cleanupTimeoutMs: 10 }), 1);
  assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_DEADLINE']);
  assert.deepEqual(f.calls.slice(-2), ['ROLLBACK', 'end']);
});

test('a late catalog response after timeout cannot initiate another query', async () => {
  const f = fixture();
  const query = f.client.query;
  f.client.query = async (text, values) => {
    if (text.includes('bool_and')) await new Promise(resolve => setTimeout(resolve, 25));
    return query(text, values);
  };
  assert.equal(await runPreflight({ ...f.options, deadlineMs: 5 }), 1);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(f.calls.some(sql => sql.includes('pg_catalog.pg_attribute')), false);
  assert.deepEqual(f.logs, ['DB_COMPAT_FAIL_DEADLINE']);
});
