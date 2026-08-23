import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL("../migrations/20260823_135227_phase1_platform_foundation.ts", import.meta.url),
  ),
  "utf8",
);

function migrationSql(direction: "up" | "down") {
  const match = source.match(
    new RegExp(
      `export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\);`,
    ),
  );
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("phase one migration execution", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
  });

  afterEach(async () => {
    await database.close();
  });

  it("creates its own tables on a completely empty database", async () => {
    await database.exec(
      "DROP TABLE payload_locked_documents_rels; DROP TABLE users;",
    );
    await database.exec(migrationSql("up"));

    const result = await database.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'audit_events', 'operational_jobs', 'access_tokens', 'private_media'
        )
    `);

    expect(result.rows[0]?.count).toBe(4);
  }, 30_000);

  it("applies twice without damaging a production-like core schema", async () => {
    await database.exec(migrationSql("up"));
    await database.exec(migrationSql("up"));

    const result = await database.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'audit_events', 'operational_jobs', 'access_tokens', 'private_media'
        )
      ORDER BY table_name
    `);

    expect(result.rows.map(({ table_name }) => table_name)).toEqual([
      "access_tokens",
      "audit_events",
      "operational_jobs",
      "private_media",
    ]);

    await database.exec(`
      INSERT INTO operational_jobs (
        type, idempotency_key, correlation_id, available_at
      ) VALUES ('test.operation', 'unique-test-key', 'corr-test', now());
    `);
    await expect(
      database.exec(`
        INSERT INTO operational_jobs (
          type, idempotency_key, correlation_id, available_at
        ) VALUES ('test.operation', 'unique-test-key', 'corr-test-2', now());
      `),
    ).rejects.toThrow();
  }, 30_000);

  it("rolls back only phase-one objects", async () => {
    await database.exec(migrationSql("up"));
    await database.exec(migrationSql("down"));

    const core = await database.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'payload_locked_documents_rels')
      ORDER BY table_name
    `);
    const platform = await database.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'audit_events', 'operational_jobs', 'access_tokens', 'private_media'
        )
    `);

    expect(core.rows.map(({ table_name }) => table_name)).toEqual([
      "payload_locked_documents_rels",
      "users",
    ]);
    expect(platform.rows).toEqual([]);
  }, 30_000);
});
