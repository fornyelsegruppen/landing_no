import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260905_110000_active_question_reply_draft_unique.ts",
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

describe("active customer-question reply draft uniqueness migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE messages (
        id serial PRIMARY KEY,
        reply_to_message_id integer,
        direction text NOT NULL,
        status text NOT NULL
      );
    `);
  });
  afterEach(async () => database.close());

  it("allows only one active outbound draft per customer question", async () => {
    await database.exec(sqlOf("up"));
    await database.exec(`
      INSERT INTO messages (reply_to_message_id, direction, status)
      VALUES (33, 'outbound', 'draft');
    `);
    await expect(
      database.exec(`
        INSERT INTO messages (reply_to_message_id, direction, status)
        VALUES (33, 'outbound', 'draft');
      `),
    ).rejects.toThrow();

    await database.exec(`
      INSERT INTO messages (reply_to_message_id, direction, status)
      VALUES
        (33, 'outbound', 'cancelled'),
        (33, 'outbound', 'failed'),
        (34, 'outbound', 'draft'),
        (NULL, 'outbound', 'draft');
    `);

    await database.exec(sqlOf("down"));
    await database.exec(`
      INSERT INTO messages (reply_to_message_id, direction, status)
      VALUES (33, 'outbound', 'draft');
    `);
  }, 30_000);
});
