import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260904_190000_preview_rf_offer_bridge.ts",
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

describe("Preview Roof Fusion offer bridge migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE roof_measurements (id serial PRIMARY KEY);
      CREATE TABLE quotes (id serial PRIMARY KEY);
      CREATE TABLE contracts (id serial PRIMARY KEY);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
      INSERT INTO users DEFAULT VALUES;
      INSERT INTO roof_measurements DEFAULT VALUES;
      INSERT INTO quotes DEFAULT VALUES;
      INSERT INTO contracts DEFAULT VALUES;
    `);
  });

  afterEach(async () => database.close());

  it("round-trips exact RF bindings and the append-only offer ledger", async () => {
    await database.exec(sqlOf("up"));
    const hash = "a".repeat(64);
    await database.query(
      `UPDATE roof_measurements SET
        source_kind = 'roof_fusion', case_revision = 3, address_revision = 2,
        rf_snapshot_id = 'rf-1-r4', rf_snapshot_revision = 4,
        rf_snapshot_hash = $1, rf_input_hash = $1, rf_renderer_hash = $1
       WHERE id = 1`,
      [hash],
    );
    await database.query(
      `INSERT INTO roof_fusion_offer_commands
        (ledger_key, idempotency_scope_key, case_id, idempotency_key, command_hash, case_revision,
         address_revision, snapshot_id, snapshot_revision, snapshot_hash,
         input_hash, renderer_hash, measurement_id, quote_id, contract_id,
         actor_id, correlation_id, occurred_at, result)
       VALUES
        ('lead:1:binding-1', 'lead:1:offer-1', 'lead:1', 'offer-1', $1, 3, 2, 'rf-1-r4', 4,
         $1, $1, $1, 1, 1, 1, 1, 'corr-offer-1', now(), '{}'::jsonb)`,
      [hash],
    );
    const ledger = await database.query<{ ledger_key: string }>(
      "SELECT ledger_key FROM roof_fusion_offer_commands",
    );
    expect(ledger.rows).toEqual([{ ledger_key: "lead:1:binding-1" }]);
    const uniqueIndexes = await database.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'roof_fusion_offer_commands'
        AND indexname IN (
          'rf_offer_commands_ledger_key_idx',
          'rf_offer_commands_idempotency_scope_key_idx'
        )
      ORDER BY indexname
    `);
    expect(uniqueIndexes.rows).toEqual([
      { indexname: "rf_offer_commands_idempotency_scope_key_idx" },
      { indexname: "rf_offer_commands_ledger_key_idx" },
    ]);

    await expect(
      database.exec(`
        INSERT INTO roof_measurements (source_kind, case_revision)
        VALUES ('roof_fusion', 1)
      `),
    ).rejects.toThrow();

    await database.exec(sqlOf("down"));
    const tables = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'roof_fusion_offer_commands'
    `);
    const columns = await database.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'roof_measurements' AND column_name = 'source_kind'
    `);
    expect(tables.rows).toEqual([]);
    expect(columns.rows).toEqual([]);
  }, 30_000);
});
