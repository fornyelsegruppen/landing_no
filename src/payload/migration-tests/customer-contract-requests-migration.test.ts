import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(fileURLToPath(new URL("../migrations/20260826_150000_customer_contract_requests.ts", import.meta.url)), "utf8");
function sqlOf(direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("customer contract request migration", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE leads (id serial PRIMARY KEY);
      CREATE TABLE quotes (id serial PRIMARY KEY);
      CREATE TABLE contracts (id serial PRIMARY KEY);
      CREATE TABLE work_orders (id serial PRIMARY KEY);
      CREATE TABLE messages (id serial PRIMARY KEY);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
  });
  afterEach(async () => database.close());

  it("stores immutable customer evidence separately from administrator decisions and rolls back", async () => {
    await database.exec(sqlOf("up"));
    await database.exec(`
      INSERT INTO leads DEFAULT VALUES; INSERT INTO quotes DEFAULT VALUES; INSERT INTO contracts DEFAULT VALUES; INSERT INTO messages DEFAULT VALUES;
      INSERT INTO customer_contract_requests (reference,lead_id,quote_id,contract_id,kind,reason_code,follow_up_consent,status,recovery_potential,received_at,source_message_id,request_fingerprint)
      VALUES ('ANG-1-TEST',1,1,1,'withdrawal','prefer_not_to_say',false,'admin_review','yellow',now(),1,'fingerprint');
    `);
    const rows = await database.query<{ kind: string; reason: string; status: string }>("SELECT kind::text kind, reason_code::text reason, status::text status FROM customer_contract_requests");
    expect(rows.rows).toEqual([{ kind: "withdrawal", reason: "prefer_not_to_say", status: "admin_review" }]);
    await database.exec(sqlOf("down"));
    const tables = await database.query<{ name: string }>("SELECT tablename name FROM pg_tables WHERE schemaname='public' AND tablename='customer_contract_requests'");
    expect(tables.rows).toEqual([]);
  }, 30_000);
});
