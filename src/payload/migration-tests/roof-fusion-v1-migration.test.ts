import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(
  fileURLToPath(
    new URL("../migrations/20260901_120000_roof_fusion_v1.ts", import.meta.url),
  ),
  "utf8",
);

function sqlOf(direction: "up" | "down") {
  const match = contents.match(
    new RegExp(
      `export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`,
    ),
  );
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

const snapshotJson = JSON.stringify({
  schemaVersion: "roof-snapshot.v1",
  snapshotId: "roof-case-12-r1",
});
const commandJson = JSON.stringify({
  schemaVersion: "roof-repository-command-result.v1",
  snapshot: { snapshotId: "roof-case-12-r1" },
});

describe("Roof Fusion v1 persistence migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
  });
  afterEach(async () => database.close());

  it("creates authoritative append tables, indexes and lock relationships", async () => {
    await database.exec(sqlOf("up"));

    const tables = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('roof_fusion_snapshots', 'roof_fusion_commands')
      ORDER BY table_name
    `);
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      "roof_fusion_commands",
      "roof_fusion_snapshots",
    ]);
    const lockColumns = await database.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payload_locked_documents_rels'
        AND column_name LIKE 'roof_fusion_%'
      ORDER BY column_name
    `);
    expect(lockColumns.rows.map(({ column_name }) => column_name)).toEqual([
      "roof_fusion_commands_id",
      "roof_fusion_snapshots_id",
    ]);
    const indexes = await database.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('roof_fusion_snapshots', 'roof_fusion_commands')
    `);
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        "roof_fusion_snapshots_snapshot_id_idx",
        "roof_fusion_snapshots_case_revision_idx",
        "roof_fusion_commands_ledger_key_idx",
        "roof_fusion_commands_case_id_idempotency_key_idx",
      ]),
    );
  }, 30_000);

  it("enforces immutable identity, case revision and case-scoped idempotency uniqueness", async () => {
    await database.exec(sqlOf("up"));
    await database.query(
      `INSERT INTO roof_fusion_snapshots
        (snapshot_id, case_id, case_revision_key, revision, snapshot_hash, state, measurement_class, snapshot)
       VALUES ($1, 'case-12', 'case-12:1', 1, $2, 'review_required', 'fused_estimate', $3::jsonb)`,
      ["roof-case-12-r1", "a".repeat(64), snapshotJson],
    );
    await expect(
      database.query(
        `INSERT INTO roof_fusion_snapshots
          (snapshot_id, case_id, case_revision_key, revision, snapshot_hash, state, measurement_class, snapshot)
         VALUES ($1, 'case-99', 'case-99:1', 1, $2, 'review_required', 'fused_estimate', $3::jsonb)`,
        ["roof-case-12-r1", "b".repeat(64), snapshotJson],
      ),
    ).rejects.toThrow();
    await expect(
      database.query(
        `INSERT INTO roof_fusion_snapshots
          (snapshot_id, case_id, case_revision_key, revision, snapshot_hash, state, measurement_class, snapshot)
         VALUES ('different-snapshot', 'case-12', 'different-key', 1, $1, 'review_required', 'fused_estimate', $2::jsonb)`,
        ["b".repeat(64), snapshotJson],
      ),
    ).rejects.toThrow();

    await database.query(
      `INSERT INTO roof_fusion_commands
        (ledger_key, case_id, idempotency_key, command_hash, command_type, snapshot_id, result)
       VALUES ('case-12:command-1', 'case-12', 'command-1', $1, 'calculate', 'roof-case-12-r1', $2::jsonb)`,
      ["c".repeat(64), commandJson],
    );
    await expect(
      database.query(
        `INSERT INTO roof_fusion_commands
          (ledger_key, case_id, idempotency_key, command_hash, command_type, snapshot_id, result)
         VALUES ('different-ledger-key', 'case-12', 'command-1', $1, 'calculate', 'roof-case-12-r1', $2::jsonb)`,
        ["d".repeat(64), commandJson],
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("supports transaction rollback and a complete down migration", async () => {
    await database.exec(sqlOf("up"));
    await database.exec("BEGIN");
    await database.query(
      `INSERT INTO roof_fusion_snapshots
        (snapshot_id, case_id, case_revision_key, revision, snapshot_hash, state, measurement_class, snapshot)
       VALUES ('rolled-back-snapshot', 'case-12', 'case-12:1', 1, $1, 'review_required', 'fused_estimate', $2::jsonb)`,
      ["e".repeat(64), snapshotJson],
    );
    await database.query(
      `INSERT INTO roof_fusion_commands
        (ledger_key, case_id, idempotency_key, command_hash, command_type, snapshot_id, result)
       VALUES ('case-12:rollback', 'case-12', 'rollback', $1, 'calculate', 'rolled-back-snapshot', $2::jsonb)`,
      ["f".repeat(64), commandJson],
    );
    await database.exec("ROLLBACK");
    const counts = await database.query<{
      commands: number;
      snapshots: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM roof_fusion_snapshots) AS snapshots,
        (SELECT count(*)::integer FROM roof_fusion_commands) AS commands
    `);
    expect(counts.rows[0]).toEqual({ commands: 0, snapshots: 0 });

    await database.exec(sqlOf("down"));
    const remaining = await database.query<{ count: number }>(`
      SELECT count(*)::integer AS count FROM information_schema.tables
      WHERE table_name IN ('roof_fusion_snapshots', 'roof_fusion_commands')
    `);
    expect(remaining.rows[0].count).toBe(0);
  }, 30_000);
});
