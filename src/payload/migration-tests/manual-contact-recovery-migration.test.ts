import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260827_230000_manual_contact_recovery.ts",
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

describe("manual contact recovery migration", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE messages (id serial PRIMARY KEY);
      CREATE TABLE leads (id serial PRIMARY KEY, email varchar);
    `);
  });
  afterEach(async () => database.close());

  it("adds a separate operational email relationship and rolls it back", async () => {
    await database.exec(sqlOf("up"));
    await database.exec(
      "INSERT INTO messages DEFAULT VALUES; INSERT INTO leads (email, communication_email, communication_email_source_message_id) VALUES ('old@example.no', 'new@example.no', 1)",
    );
    const rows = await database.query<{
      communication_email: string;
      email: string;
    }>("SELECT email, communication_email FROM leads");
    expect(rows.rows).toEqual([
      { email: "old@example.no", communication_email: "new@example.no" },
    ]);
    await database.exec(sqlOf("down"));
    const columns = await database.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name LIKE 'communication_email%'",
    );
    expect(columns.rows).toEqual([]);
  }, 30_000);
});
