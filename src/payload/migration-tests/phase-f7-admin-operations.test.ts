import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(fileURLToPath(new URL("../migrations/20260825_235000_admin_operations.ts", import.meta.url)), "utf8");

function sqlOf(direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("F7 administrator review migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec("CREATE TABLE users (id serial PRIMARY KEY); CREATE TABLE leads (id serial PRIMARY KEY);");
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
});
