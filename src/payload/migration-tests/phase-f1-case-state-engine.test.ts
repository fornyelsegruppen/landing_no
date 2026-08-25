import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

const contents = readFileSync(fileURLToPath(new URL("../migrations/20260825_220000_case_state_engine.ts", import.meta.url)), "utf8");

function sqlOf(direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

const databases: PGlite[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map((database) => database.close())); });

describe("F1 case state migration", () => {
  it("adds a monotonic revision and explicit next-action ownership to existing leads", async () => {
    const database = new PGlite();
    databases.push(database);
    await database.exec(`CREATE TABLE leads (id serial PRIMARY KEY, status varchar); INSERT INTO leads(status) VALUES ('new');`);
    await database.exec(sqlOf("up"));
    const result = await database.query<{ case_revision: string; next_action_owner: string }>("SELECT case_revision, next_action_owner FROM leads WHERE id = 1");
    expect(result.rows[0]).toEqual({ case_revision: "1", next_action_owner: "administrator" });
    await database.exec(sqlOf("down"));
    const remaining = await database.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name IN ('next_action_owner', 'next_action_blocker', 'case_revision')");
    expect(remaining.rows).toEqual([]);
  });
});
