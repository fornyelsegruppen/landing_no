import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(fileURLToPath(new URL("../migrations/20260825_235000_admin_operations.ts", import.meta.url)), "utf8");
const backfillContents = readFileSync(fileURLToPath(new URL("../migrations/20260825_235100_admin_review_backfill.ts", import.meta.url)), "utf8");

function sqlOf(direction: "up" | "down", source = contents) {
  const match = source.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("F7 administrator review migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec("CREATE TABLE users (id serial PRIMARY KEY); CREATE TABLE leads (id serial PRIMARY KEY, created_at timestamp with time zone, updated_at timestamp with time zone);");
  });

  afterEach(async () => database.close());

  it("adds first-review evidence and rolls it back cleanly", async () => {
    await database.exec(sqlOf("up"));
    const columns = await database.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name IN ('admin_reviewed_at','admin_reviewed_by_id') ORDER BY column_name");
    expect(columns.rows.map((row) => row.column_name)).toEqual(["admin_reviewed_at", "admin_reviewed_by_id"]);
    await database.exec(sqlOf("down"));
    const remaining = await database.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name LIKE 'admin_reviewed%'");
    expect(remaining.rows).toEqual([]);
  }, 30_000);

  it("marks only pre-existing leads as reviewed during rollout", async () => {
    await database.exec("INSERT INTO leads (created_at, updated_at) VALUES ('2026-08-24T08:00:00Z', '2026-08-25T08:00:00Z')");
    await database.exec(sqlOf("up"));
    await database.exec(sqlOf("up", backfillContents));
    await database.exec("INSERT INTO leads (created_at, updated_at) VALUES ('2026-08-25T20:00:00Z', '2026-08-25T20:00:00Z')");
    const rows = await database.query<{ admin_reviewed_at: string | null }>("SELECT admin_reviewed_at FROM leads ORDER BY id");
    expect(rows.rows[0]?.admin_reviewed_at).not.toBeNull();
    expect(rows.rows[1]?.admin_reviewed_at).toBeNull();
    await database.exec(sqlOf("down", backfillContents));
    await database.exec(sqlOf("down"));
  }, 30_000);
});
