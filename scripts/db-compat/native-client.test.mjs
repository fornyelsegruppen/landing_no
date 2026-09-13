import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { NativeClient, childEnvironment } from './native-client.mjs';

const options = { nativeConnectionString: 'postgresql://synthetic:PRIVATE@example.invalid/db?channel_binding=require',
  connectionTimeoutMillis: 100, query_timeout: 100 };
function fixture(respond = request => ({ id: request.id, ok: true, rows: [] })) {
  const calls = [], requests = [];
  const spawnProcess = (command, args, config) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new Writable({ write(data, _encoding, done) {
      const request = JSON.parse(data.toString()); requests.push(request);
      const response = respond(request, child);
      if (response) queueMicrotask(() => child.stdout.write(JSON.stringify(response) + '\n'));
      done();
    } });
    child.kill = () => { child.killed = true; setImmediate(() => child.emit('close', 1)); };
    if (config.stdio === 'ignore') { child.stdin = null; child.stdout = null; }
    calls.push({ command, args, config, child });
    return child;
  };
  const client = new NativeClient(options, { dependencies: 'synthetic-dependencies', spawnProcess });
  client.on('error', () => {});
  return { client, calls, requests, spawnProcess };
}

test('child allowlist drops all credential, PG, PIP, SSL, OpenSSL and Python overrides', () => {
  const clean = childEnvironment({ PATH: 'system-path', DATABASE_URL: 'PRIVATE', PGPASSWORD: 'PRIVATE',
    PGOPTIONS: 'PRIVATE', PIP_INDEX_URL: 'PRIVATE', PIP_CONFIG_FILE: 'PRIVATE', NETRC: 'PRIVATE',
    SSL_CERT_FILE: 'PRIVATE', SSL_CERT_DIR: 'PRIVATE', OPENSSL_CONF: 'PRIVATE',
    PYTHONPATH: 'PRIVATE', PYTHONHOME: 'PRIVATE', PSYCOPG_IMPL: 'python' });
  assert.equal(clean.PATH, 'system-path');
  assert.equal(clean.PSYCOPG_IMPL, 'binary');
  assert.equal(clean.PIP_CONFIG_FILE, process.platform === 'win32' ? 'NUL' : '/dev/null');
  assert.doesNotMatch(JSON.stringify(clean), /PRIVATE/);
});

test('credentials are stdin-only; exact SQL and repeated/out-of-order parameters cross IPC unchanged', async () => {
  const f = fixture(); await f.client.prepare(); await f.client.connect();
  const text = "EXPLAIN (FORMAT JSON) SELECT $2, $1, $2, '50%'::text";
  const values = [['quoted"', 'back\\slash', null], 'synthetic'];
  await f.client.query(text, values); await f.client.end();
  assert.equal(f.requests[0].url, options.nativeConnectionString);
  assert.deepEqual(f.requests[1], { op: 'query', text, values, id: 2 });
  assert.doesNotMatch(JSON.stringify(f.calls.map(c => [c.command, c.args, c.config])), /PRIVATE/);
  assert.deepEqual(f.calls[0].config.stdio, ['pipe', 'pipe', 'ignore']);
  assert.ok(f.calls[0].args.includes('-S'));
});

test('native error payload, malformed output and EOF fail without exposing content', async () => {
  for (const scenario of ['error', 'malformed', 'eof', 'wrong-id', 'oversize']) {
    const f = fixture((request, child) => {
      if (scenario === 'error') return { id: request.id, ok: false, error: 'PRIVATE' };
      if (scenario === 'wrong-id') return { id: 999, ok: true, rows: [] };
      queueMicrotask(() => {
        if (scenario === 'eof') child.emit('close', 1);
        else child.stdout.write(scenario === 'oversize' ? 'x'.repeat(1024 * 1024 + 1) : 'PRIVATE\n');
      });
    });
    await f.client.prepare();
    await assert.rejects(f.client.connect(), error => error.message === 'NATIVE_TRANSPORT');
    await f.client.end().catch(() => {});
  }
});

test('connect/query deadline kills child and late responses cannot permit another query', async () => {
  for (const at of ['connect', 'query']) {
    const f = fixture(request => request.op === at ? undefined : { id: request.id, ok: true, rows: [] });
    f.client.options = { ...options, connectionTimeoutMillis: 5, query_timeout: 5 };
    await f.client.prepare();
    if (at === 'query') await f.client.connect();
    await assert.rejects(at === 'connect' ? f.client.connect() : f.client.query('SELECT $1', ['synthetic']));
    assert.equal(f.calls[0].child.killed, true);
    f.calls[0].child.stdout.write(JSON.stringify({ id: at === 'connect' ? 1 : 2, ok: true, rows: [] }) + '\n');
    await assert.rejects(f.client.query('SELECT 1'));
    await assert.rejects(f.client.end());
  }
});

test('an unsolicited malformed frame after a successful query permanently poisons close', async () => {
  const f = fixture(); await f.client.prepare(); await f.client.connect();
  await f.client.query('ROLLBACK');
  f.calls[0].child.stdout.write('PRIVATE MALFORMED\n');
  await assert.rejects(f.client.end(), error => error.message === 'NATIVE_TRANSPORT');
  assert.equal(f.client.poisoned, true);
});

test('provisioning is binary/hash-only, credential-free, bounded and reaped before temp cleanup', async () => {
  const f = fixture();
  f.client.dependencies = undefined;
  f.client.provisionTimeoutMs = 5;
  await assert.rejects(f.client.prepare());
  const child = f.calls[0].child;
  const args = f.calls[0].args;
  for (const flag of ['--isolated', '--only-binary=:all:', '--require-hashes', '--no-deps', '--no-cache-dir']) {
    assert.ok(args.includes(flag));
  }
  assert.equal(args[args.indexOf('--index-url') + 1], 'https://pypi.org/simple');
  assert.equal(args[args.indexOf('--keyring-provider') + 1], 'disabled');
  await f.client.end();
  assert.equal(child.killed, true);
  assert.equal(f.client.ownedDirectory, null);
});
