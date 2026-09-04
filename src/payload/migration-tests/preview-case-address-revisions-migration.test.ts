import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260904_180000_preview_case_address_revisions.ts",
      import.meta.url,
    ),
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

describe("Preview case address revision migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE leads (id serial PRIMARY KEY, case_revision numeric DEFAULT 1 NOT NULL);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
      INSERT INTO users DEFAULT VALUES;
      INSERT INTO leads DEFAULT VALUES;
    `);
  });
  afterEach(async () => database.close());

  it("round-trips the address revision and append-only ledger schema", async () => {
    await database.exec(sqlOf("up"));
    const lead = await database.query<{ address_revision: string }>(
      "SELECT address_revision FROM leads WHERE id = 1",
    );
    expect(lead.rows[0]).toEqual({ address_revision: "1" });

    const before = JSON.stringify({
      street: "Old gate",
      houseNumber: "1",
      postalCode: "0001",
      city: "Oslo",
    });
    const after = JSON.stringify({
      street: "New gate",
      houseNumber: "2",
      postalCode: "0001",
      city: "Oslo",
    });
    const result = JSON.stringify({
      schemaVersion: "preview-case-address-command-result.v1",
      status: "applied",
    });
    await database.query(
      `INSERT INTO case_address_revisions
        (ledger_key, revision_key, lead_id, case_id, address_revision,
         previous_address_revision, expected_case_revision,
         resulting_case_revision, idempotency_key, command_hash,
         correlation_id, actor_id, reason_code, before, after, before_hash,
         after_hash, rf_invalidation_status, invalidated_rf_snapshot_id,
         invalidated_rf_snapshot_revision, invalidated_rf_snapshot_hash,
         occurred_at, result)
       VALUES
        ('ledger-1', 'lead:1:2', 1, 'lead:1', 2, 1, 1, 2,
         'address-correction-1', $1, 'corr-1', 1, 'operator_correction',
         $2::jsonb, $3::jsonb, $4, $5, 'invalidated', 'rf-1', 3, $6,
         now(), $7::jsonb)`,
      [
        "a".repeat(64),
        before,
        after,
        "b".repeat(64),
        "c".repeat(64),
        "d".repeat(64),
        result,
      ],
    );
    await expect(
      database.query(
        `INSERT INTO case_address_revisions
          (ledger_key, revision_key, case_id, address_revision,
           previous_address_revision, expected_case_revision,
           resulting_case_revision, idempotency_key, command_hash,
           correlation_id, reason_code, before, after, before_hash,
           after_hash, rf_invalidation_status, occurred_at, result)
         VALUES ('ledger-2', 'lead:1:2', 'lead:1', 2, 1, 1, 2,
           'address-correction-2', $1, 'corr-2', 'operator_correction',
           $2::jsonb, $3::jsonb, $4, $5, 'not_applicable', now(), $6::jsonb)`,
        ["e".repeat(64), before, after, "f".repeat(64), "0".repeat(64), result],
      ),
    ).rejects.toThrow();

    await database.exec(sqlOf("down"));
    const tables = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'case_address_revisions'
    `);
    const columns = await database.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name = 'address_revision'
    `);
    expect(tables.rows).toEqual([]);
    expect(columns.rows).toEqual([]);
  }, 30_000);

  it("rejects partial RF invalidation and non-consecutive revisions", async () => {
    await database.exec(sqlOf("up"));
    const common = `
      (ledger_key, revision_key, case_id, address_revision,
       previous_address_revision, expected_case_revision,
       resulting_case_revision, idempotency_key, command_hash,
       correlation_id, reason_code, before, after, before_hash,
       after_hash, rf_invalidation_status, invalidated_rf_snapshot_id,
       occurred_at, result)`;
    await expect(
      database.query(
        `INSERT INTO case_address_revisions ${common}
         VALUES ('ledger-bad-rf', 'lead:1:2', 'lead:1', 2, 1, 1, 2,
          'address-correction-1', $1, 'corr-1', 'operator_correction',
          '{}'::jsonb, '{}'::jsonb, $2, $3, 'invalidated', 'rf-1', now(), '{}'::jsonb)`,
        ["a".repeat(64), "b".repeat(64), "c".repeat(64)],
      ),
    ).rejects.toThrow();
    await expect(
      database.query(
        `INSERT INTO case_address_revisions ${common}
         VALUES ('ledger-bad-rev', 'lead:1:3', 'lead:1', 3, 1, 1, 2,
          'address-correction-2', $1, 'corr-2', 'operator_correction',
          '{}'::jsonb, '{}'::jsonb, $2, $3, 'not_applicable', NULL, now(), '{}'::jsonb)`,
        ["d".repeat(64), "e".repeat(64), "f".repeat(64)],
      ),
    ).rejects.toThrow();
  }, 30_000);
});
