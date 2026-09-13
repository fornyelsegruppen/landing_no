// Preflight-only libpq transport. Imported only after explicit opt-in/source gate.
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requirements = fileURLToPath(new URL('./native-requirements.txt', import.meta.url));
const bridge = fileURLToPath(new URL('./native-bridge.py', import.meta.url));
const REQUIREMENTS_HASH = '7bbac86fe74b69ed27a5368209ef9eb4145afec62ddf6c91117a7136d50e0d20';
const MAX_FRAME = 1024 * 1024;
const BOOTSTRAP_FAILURES = new Set(['NATIVE_IMPORT', 'NATIVE_ORIGIN', 'NATIVE_VERSION', 'NATIVE_CA']);
const safeError = () => new Error('NATIVE_TRANSPORT');

export function childEnvironment(environment = process.env) {
  const output = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP']) {
    if (environment[key]) output[key] = environment[key];
  }
  output.PSYCOPG_IMPL = 'binary';
  output.PIP_CONFIG_FILE = process.platform === 'win32' ? 'NUL' : '/dev/null';
  output.NETRC = process.platform === 'win32' ? 'NUL' : '/dev/null';
  return output;
}

export class NativeClient extends EventEmitter {
  constructor(options, { python = 'python3.12', dependencies, spawnProcess = spawn,
    environment = process.env, provisionTimeoutMs = 120000 } = {}) {
    super();
    this.options = options;
    this.python = python;
    this.dependencies = dependencies; // Dependency injection for local tests only.
    this.spawnProcess = spawnProcess;
    this.environment = childEnvironment(environment);
    this.provisionTimeoutMs = provisionTimeoutMs;
    this.nextID = 0;
    this.pending = null;
    this.closed = false;
    this.poisoned = false;
  }

  async prepare() {
    const contents = (await readFile(requirements, 'utf8')).replace(/\r\n/g, '\n');
    if (createHash('sha256').update(contents).digest('hex') !== REQUIREMENTS_HASH) throw safeError();
    if (this.closed) throw safeError();
    if (this.dependencies) return;
    this.ownedDirectory = await mkdtemp(join(tmpdir(), 'seo-db-native-'));
    this.dependencies = this.ownedDirectory;
    if (this.closed) { await this.cleanup(); throw safeError(); }
    // Only this opted-in preparation step downloads packages. No credentials or
    // PG/PIP/PYTHON/SSL/OpenSSL settings reach pip; binary/hash pins forbid builds.
    await new Promise((accept, reject) => {
      const child = this.spawnProcess(this.python, ['-I', '-m', 'pip', '--isolated',
        '--disable-pip-version-check', 'install', '--no-input', '--no-cache-dir',
        '--keyring-provider', 'disabled',
        '--only-binary=:all:', '--require-hashes', '--no-deps', '--index-url',
        'https://pypi.org/simple', '--target', this.dependencies, '-r', requirements],
      { env: this.environment, stdio: 'ignore', windowsHide: true });
      this.child = child;
      this.exited = new Promise(accept => child.once('close', accept));
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(safeError()); }, this.provisionTimeoutMs);
      child.once('error', () => { clearTimeout(timer); reject(safeError()); });
      child.once('close', code => {
        clearTimeout(timer);
        if (this.child === child) this.child = null;
        code === 0 && !this.closed ? accept() : reject(safeError());
      });
    });
  }

  async connect() {
    if (this.closed || !this.dependencies) throw safeError();
    this.emit('preflightPhase', 'NATIVE_BOOTSTRAP');
    const child = this.spawnProcess(this.python, ['-I', '-S', bridge, '--dependencies', this.dependencies],
      { env: this.environment, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    this.child = child;
    this.exited = new Promise(accept => child.once('close', accept));
    let buffer = '';
    const fail = () => {
      this.poisoned = true;
      clearTimeout(this.pending?.timer);
      this.pending?.reject(safeError());
      this.pending = null;
      this.closed = true;
      child.kill('SIGKILL');
    };
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.stdout.on('error', fail);
    child.once('close', () => {
      clearTimeout(this.pending?.timer);
      this.pending?.reject(safeError());
      this.pending = null;
      if (this.child === child) this.child = null;
      if (!this.closed) this.emit('error', safeError());
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > MAX_FRAME) return fail();
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const response = JSON.parse(line);
          if (this.pending?.op === 'initialize' && response.id === this.pending.id &&
            response.ok === false && BOOTSTRAP_FAILURES.has(response.phase)) {
            this.emit('preflightPhase', response.phase);
            return fail();
          }
          if (!this.pending || response.id !== this.pending.id ||
            response.ok !== true || !Array.isArray(response.rows)) return fail();
          const pending = this.pending; this.pending = null;
          clearTimeout(pending.timer);
          pending.accept({ rows: response.rows });
        } catch { return fail(); }
      }
    });
    await this.request({ op: 'initialize' });
    this.emit('preflightPhase', 'CONNECT');
    await this.request({ op: 'connect', url: this.options.nativeConnectionString });
  }

  request(message) {
    if (this.closed || this.pending || !this.child) return Promise.reject(safeError());
    return new Promise((accept, reject) => {
      const id = ++this.nextID;
      const timer = setTimeout(() => {
        this.poisoned = true;
        this.closed = true;
        this.pending?.reject(safeError()); this.pending = null;
        this.child?.kill('SIGKILL');
      }, ['initialize', 'connect'].includes(message.op) ? this.options.connectionTimeoutMillis : this.options.query_timeout);
      this.pending = { id, op: message.op, accept, reject, timer };
      const frame = JSON.stringify({ ...message, id }) + '\n';
      if (Buffer.byteLength(frame) > MAX_FRAME) { clearTimeout(timer); this.pending = null; reject(safeError()); return; }
      this.child.stdin.write(frame);
    });
  }

  query(text, values = []) { return this.request({ op: 'query', text, values }); }

  async cleanup() {
    const directory = this.ownedDirectory;
    // Only remove the precise fresh mkdtemp directory this instance created.
    if (directory && resolve(directory).startsWith(resolve(tmpdir()) + '/')) {
      await rm(directory, { recursive: true, force: true });
      this.ownedDirectory = null;
    } else if (directory && process.platform === 'win32' &&
      resolve(directory).startsWith(resolve(tmpdir()) + '\\')) {
      await rm(directory, { recursive: true, force: true });
      this.ownedDirectory = null;
    }
  }

  end() {
    if (this.ending) return this.ending;
    this.ending = (async () => {
      const child = this.child;
      if (child && !this.pending && child.stdin?.writable) {
        // Graceful close lets Python rollback and finish; timeout kills/reaps it.
        let timer;
        await Promise.race([this.request({ op: 'close' }).catch(() => {}),
          new Promise(accept => { timer = setTimeout(accept, 500); })]);
        clearTimeout(timer);
      }
      this.closed = true;
      clearTimeout(this.pending?.timer);
      this.pending?.reject(safeError()); this.pending = null;
      if (child) {
        child.kill('SIGKILL');
        if (this.exited) await this.exited;
      }
      await this.cleanup();
      if (this.poisoned) throw safeError();
    })();
    return this.ending;
  }
}
