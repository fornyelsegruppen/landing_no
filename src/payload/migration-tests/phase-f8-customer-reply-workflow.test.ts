import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(fileURLToPath(new URL("../migrations/20260825_235200_customer_reply_workflow.ts", import.meta.url)), "utf8");

function sqlOf(direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("F8 customer reply workflow migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TYPE enum_leads_status AS ENUM('new', 'draft_ready', 'waiting_customer', 'qualified', 'measuring', 'quoted', 'converted', 'closed', 'contacted');
      CREATE TABLE leads (id serial PRIMARY KEY, status enum_leads_status NOT NULL DEFAULT 'new');
      CREATE TABLE messages (id serial PRIMARY KEY);
      CREATE TABLE quotes (id serial PRIMARY KEY);
      CREATE TABLE work_orders (id serial PRIMARY KEY);
    `);
  });

  afterEach(async () => database.close());

  it("adds reply linkage, decline evidence, cancellation freeze fields and rolls them back", async () => {
    await database.exec(sqlOf("up"));
    const leadStatuses = await database.query<{ enumlabel: string }>("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=pg_enum.enumtypid WHERE pg_type.typname='enum_leads_status' ORDER BY enumsortorder");
    expect(leadStatuses.rows.map((row) => row.enumlabel)).toContain("customer_waiting");
    const columns = await database.query<{ table_name: string; column_name: string }>("SELECT table_name,column_name FROM information_schema.columns WHERE (table_name='messages' AND column_name='reply_to_message_id') OR (table_name='quotes' AND column_name IN ('decline_reason','decline_comment')) OR (table_name='work_orders' AND column_name IN ('customer_cancellation_requested_at','cancellation_request_message_id','status_before_customer_cancellation','customer_cancellation_resolved_at','customer_cancellation_resolution')) ORDER BY table_name,column_name");
    expect(columns.rows).toHaveLength(8);
    await database.exec("INSERT INTO leads (status) VALUES ('customer_waiting')");
    await database.exec(sqlOf("down"));
    const restored = await database.query<{ status: string }>("SELECT status::text AS status FROM leads");
    expect(restored.rows).toEqual([{ status: "draft_ready" }]);
  }, 30_000);
});
