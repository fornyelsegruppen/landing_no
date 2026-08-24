import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(fileURLToPath(new URL("../migrations/20260825_120000_contract_counter_signatures.ts", import.meta.url)), "utf8");
function sqlOf(direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("R6 contract counter-signature migration", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE private_media (id serial PRIMARY KEY);
      CREATE TABLE contracts (id serial PRIMARY KEY);
    `);
  });
  afterEach(async () => database.close());

  it("adds and rolls back durable customer and supplier signature fields", async () => {
    await database.exec(sqlOf("up"));
    const added = await database.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name LIKE '%sign%' ORDER BY column_name");
    expect(added.rows.map((row) => row.column_name)).toEqual([
      "company_signature_evidence",
      "company_signature_image_id",
      "company_signed_at",
      "company_signed_by_id",
      "company_signed_document_id",
      "customer_signature_image_id",
    ]);
    await database.exec(sqlOf("down"));
    const remaining = await database.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name LIKE '%sign%'");
    expect(remaining.rows).toEqual([]);
  }, 30_000);
});
