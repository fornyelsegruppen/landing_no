import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { captureManifest, root } from './capture.mjs';
import { connectionOptions, loadArtifact, runPreflight } from './preflight.mjs';

const environment = { SEO_DB_COMPAT_PREFLIGHT: '1', VERCEL_ENV: 'production',
  DATABASE_URL: 'postgresql://synthetic:never-real@example.invalid/synthetic?sslmode=require&channel_binding=require' };
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
    if (text.includes('a.attname AS column_name')) return { rows: manifest.columns.map(c => ({
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
    assert.match(f.logs[0], /^DB_COMPAT_FAIL_(OPT_IN|CONNECTION)$/);
  }
});

test('strict TLS cannot be overridden by URL ssl parameters or inherited PG defaults', () => {
  const config = connectionOptions(environment.DATABASE_URL);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
  assert.equal(new URL(config.connectionString).searchParams.get('channel_binding'), 'require');
  assert.equal(config.connectionTimeoutMillis, 5000);
  assert.equal(config.query_timeout, 6000);
  for (const raw of ['', 'file:./fallback.db', 'postgresql://x@host/db?sslmode=disable',
    'postgresql://x@host/db?ssl=false', 'postgresql://x@host/db?sslrootcert=/secret',
    'postgresql://x@host/db?query_timeout=0', 'postgresql://x@host/db?host=elsewhere',
    'postgresql://x@host/db?options=-c%20statement_timeout%3D0']) {
    assert.throws(() => connectionOptions(raw));
  }
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
