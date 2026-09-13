// Explicit local-only proof. Never use an inherited URL or mutate the source DB.
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig, createLocalReq, getPayload, type Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Posts } from "./Posts";
import { Users } from "./Users";
import { Media } from "./Media";
import { Services } from "./Services";
import { SeoRuns } from "./SeoRuns";
import { SeoTopics } from "./SeoTopics";
import { restorePostVersionAsDraft } from "../../lib/blog/restore-post-version";
import { runPreflight } from "../../../scripts/db-compat/preflight.mjs";

vi.mock("../../lib/blog/invalidate-public-blog", () => ({ invalidatePublicBlog: () => {} }));

const enabled = process.env.SEO_LEGACY_STATUS_LOCAL === "1";
const source = "seo_automation_browser_20260912";
const owned = `seo_enum_alias_owned_${randomUUID().replaceAll("-", "")}`;
const binaries = "C:/Users/Fornyelsegruppen/AppData/Local/Temp/takfornyelse-pg16-phase2b-332e7f4cfeb144689f2f52888906267b/extract/pgsql/bin";
const options = { host: "127.0.0.1", port: 55432, user: "phase2b_qa",
  password: "unused-local-trust-only", ssl: false as const,
  connectionTimeoutMillis: 5000, query_timeout: 15000 };

describe.skipIf(!enabled)("exact legacy Posts status enum (owned synthetic clone)", () => {
  let temporary: string;
  let created = false;
  let admin: pg.Client;
  let db: pg.Client;
  let payload: Payload;
  let user: Awaited<ReturnType<Payload["create"]>>;

  async function identity(client: pg.Client, database: string) {
    const result = await client.query(`SELECT current_database() AS db, current_user AS role,
      host(inet_server_addr()) AS host, inet_server_port() AS port`);
    expect(result.rows[0]).toEqual({ db: database, role: "phase2b_qa", host: "127.0.0.1", port: 55432 });
  }

  beforeAll(async () => {
    temporary = await mkdtemp(path.join(tmpdir(), "seo-enum-alias-"));
    const sourceClient = new pg.Client({ ...options, database: source });
    await sourceClient.connect();
    try {
      await sourceClient.query("BEGIN READ ONLY");
      await identity(sourceClient, source);
      await sourceClient.query("ROLLBACK");
    } finally { await sourceClient.end(); }

    // Read-only schema clone: no source rows/credentials copied or logged.
    const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP"]) {
      if (process.env[key]) environment[key] = process.env[key];
    }
    Object.assign(environment, { PGPASSFILE: "NUL", PGSERVICEFILE: "NUL", PGSSLMODE: "disable" });
    const schema = path.join(temporary, "synthetic-schema.sql");
    const dumped = spawnSync(path.join(binaries, "pg_dump.exe"), ["-w", "--schema-only",
      "--no-owner", "--no-privileges", "-h", "127.0.0.1", "-p", "55432", "-U", "phase2b_qa",
      "-d", source, "-f", schema], { env: { ...environment, PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=1000" },
      stdio: "ignore", windowsHide: true, timeout: 30000 });
    expect(dumped.status, "fixed synthetic schema dump").toBe(0);
    admin = new pg.Client({ ...options, database: "postgres" });
    await admin.connect();
    await identity(admin, "postgres");
    expect(owned).toMatch(/^seo_enum_alias_owned_[a-f0-9]{32}$/);
    await admin.query(`CREATE DATABASE "${owned}"`);
    created = true;
    const restored = spawnSync(path.join(binaries, "psql.exe"), ["-X", "-w", "-v", "ON_ERROR_STOP=1",
      "-h", "127.0.0.1", "-p", "55432", "-U", "phase2b_qa", "-d", owned, "-f", schema],
      { env: environment, stdio: "ignore", windowsHide: true, timeout: 30000 });
    expect(restored.status, "owned synthetic schema restore").toBe(0);
    db = new pg.Client({ ...options, database: owned });
    await db.connect();
    await identity(db, owned);
    const config = await buildConfig({
      secret: "owned-enum-alias-synthetic-only", telemetry: false,
      serverURL: "https://example.invalid", admin: { user: Users.slug },
      collections: [Users, Media, Services, SeoTopics, SeoRuns, Posts],
      db: postgresAdapter({ pool: { ...options, database: owned, max: 5 },
        push: false, disableCreateDatabase: true, transactionOptions: false }),
    });
    payload = await getPayload({ config, key: owned });
    user = await payload.create({ collection: "users", overrideAccess: true,
      data: { email: "enum-alias@example.invalid", password: "Synthetic-only-123456",
        role: "admin", active: true, interfaceLanguage: "nb", displayName: "Synthetic Enum Admin" } });
  }, 90000);

  afterAll(async () => {
    // Installed adapter retains a checkout; its destroy() does not close pool.
    // Only the expected exact-clone FORCE teardown error is accepted here.
    const teardownCodes: string[] = [];
    payload?.db.pool?.on("error", (error: Error & { code?: string }) => {
      teardownCodes.push(error.code ?? "UNKNOWN");
    });
    await payload?.destroy();
    await db?.end();
    if (created) {
      expect(owned).toMatch(/^seo_enum_alias_owned_[a-f0-9]{32}$/);
      await identity(admin, "postgres");
      // Terminate only residual connections to this generated owned clone.
      await admin.query(`DROP DATABASE "${owned}" WITH (FORCE)`);
      expect(teardownCodes.every((code) => code === "57P01")).toBe(true);
    }
    await admin?.end();
    if (temporary) {
      expect(path.dirname(path.resolve(temporary))).toBe(path.resolve(tmpdir()));
      expect(path.basename(temporary)).toMatch(/^seo-enum-alias-/);
      await rm(temporary, { recursive: true, force: true });
    }
  }, 30000);

  async function gate() {
    const logs: string[] = [];
    let explains = 0;
    const result = await runPreflight({
      environment: { NODE_ENV: "test", SEO_DB_COMPAT_PREFLIGHT: "1", VERCEL_ENV: "production",
        DATABASE_URL: "postgresql://synthetic:unused@example.invalid/synthetic" },
      log: (value: string) => logs.push(value),
      createClient: async () => {
        const client = new pg.Client({ ...options, database: owned });
        const query = client.query.bind(client);
        client.query = (async (text: string, values?: unknown[]) => {
          if (text.startsWith("EXPLAIN")) explains++;
          return query(text, values);
        }) as typeof client.query;
        return client;
      },
    });
    return { result, logs, explains };
  }

  async function versionOperations(slug: string) {
    const post = await payload.create({ collection: "posts", draft: true, overrideAccess: true,
      data: { slug, titleNo: "Synthetic enum compatibility", contentNo: "Synthetic original body",
        authorName: "Synthetic", editorialStatus: "human_review", _status: "draft" } });
    const versions = await payload.findVersions({ collection: "posts", overrideAccess: true,
      where: { and: [{ parent: { equals: post.id } }, { "version._status": { equals: "draft" } }] } });
    expect(versions.docs.length).toBeGreaterThan(0);
    const selected = versions.docs[0];
    await payload.update({ collection: "posts", id: post.id, draft: true, overrideAccess: true,
      data: { contentNo: "Synthetic edited body" } });
    expect((await payload.findByID({ collection: "posts", id: post.id, draft: true })).contentNo).toBe("Synthetic edited body");
    const req = await createLocalReq({ user: user as never }, payload);
    const restored = await restorePostVersionAsDraft({ payload, req, versionID: String(selected.id) });
    expect(restored).toMatchObject({ _status: "draft", contentNo: "Synthetic original body" });
    const after = await payload.findVersions({ collection: "posts", overrideAccess: true,
      where: { and: [{ parent: { equals: post.id } }, { "version._status": { equals: "draft" } }] } });
    expect(after.docs.length).toBeGreaterThan(versions.docs.length);
    // draft:true intentionally normalizes caller status before persistence.
    expect((await payload.update({ collection: "posts", id: post.id, draft: true,
      overrideAccess: true, data: { _status: "invalid" as "draft" } }))._status).toBe("draft");
    await db.query("BEGIN");
    try {
      await expect(db.query('UPDATE "_posts_v" SET "version__status"=$1 WHERE "parent_id"=$2',
        ["invalid", post.id])).rejects.toMatchObject({ code: "22P02" });
    } finally { await db.query("ROLLBACK"); }
  }

  it("canonical schema supports actual Payload versions and all 18 plans", async () => {
    expect(await gate()).toEqual({ result: 0, logs: ["DB_COMPAT_PASS"], explains: 18 });
    await versionOperations("synthetic-canonical-status");
  }, 30000);

  it("legacy enum without shadow supports versions/restore and rejects invalid labels", async () => {
    // These changes affect only the freshly owned clone, never the source DB.
    await db.query('ALTER TABLE "_posts_v" ALTER COLUMN "version__status" DROP DEFAULT');
    await db.query('ALTER TABLE "_posts_v" ALTER COLUMN "version__status" TYPE "public"."enum_posts_status" USING "version__status"::text::"public"."enum_posts_status"');
    await db.query('ALTER TABLE "_posts_v" ALTER COLUMN "version__status" SET DEFAULT \'draft\'');
    await db.query('DROP TYPE "public"."enum__posts_v_version_status"');
    expect(await gate()).toEqual({ result: 0, logs: ["DB_COMPAT_PASS"], explains: 18 });
    await versionOperations("synthetic-legacy-status");
    await db.query('ALTER TYPE "public"."enum_posts_status" ADD VALUE \'invalid\'');
    expect(await gate()).toEqual({ result: 1, logs: ["DB_COMPAT_FAIL_SEO_ENUMS"], explains: 0 });
  }, 30000);
});
