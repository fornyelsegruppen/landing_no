import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(fileURLToPath(new URL(`../migrations/${name}.ts`, import.meta.url)), "utf8");
}

function sqlOf(contents: string, direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

const phase3 = source("20260823_150443_phase3_blog_foundation");
const phase4 = source("20260823_160853_phase4_ai_content_engine");
const phase5 = source("20260823_163755_phase5_lead_inbox_messages");

describe("phase five lead inbox migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE services (id serial PRIMARY KEY);
      CREATE TABLE posts (id serial PRIMARY KEY, slug varchar NOT NULL, title_no varchar NOT NULL, title_en varchar, content_no varchar NOT NULL, content_en varchar);
      CREATE TABLE _posts_v (id serial PRIMARY KEY);
      CREATE TYPE enum_leads_status AS ENUM ('new', 'contacted', 'qualified', 'closed');
      CREATE TABLE leads (id serial PRIMARY KEY, status enum_leads_status DEFAULT 'new' NOT NULL);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
    await database.exec(sqlOf(phase3, "up"));
    await database.exec(sqlOf(phase4, "up"));
  });

  afterEach(async () => database.close());

  it("creates idempotent messages and keeps the database relation safe on deletion", async () => {
    await database.exec(sqlOf(phase5, "up"));
    await database.exec(`
      INSERT INTO leads (status) VALUES ('new');
      INSERT INTO messages (lead_id, category, channel, subject, body_text, status, idempotency_key)
      VALUES (1, 'receipt', 'email', 'Mottatt', 'Takk', 'queued', 'receipt-1');
    `);
    await expect(database.exec("INSERT INTO messages (lead_id, category, channel, subject, body_text, idempotency_key) VALUES (1, 'receipt', 'email', 'Duplikat', 'Takk', 'receipt-1')")).rejects.toThrow();
    await database.exec("DELETE FROM leads WHERE id = 1");
    const messages = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM messages");
    expect(messages.rows[0]?.count).toBe(1);
    const relation = await database.query<{ lead_id: number | null }>("SELECT lead_id FROM messages");
    expect(relation.rows[0]?.lead_id).toBeNull();
  }, 30_000);

  it("maps new workflow statuses safely during rollback", async () => {
    await database.exec(sqlOf(phase5, "up"));
    await database.exec("INSERT INTO leads (status) VALUES ('draft_ready'), ('quoted')");
    await database.exec(sqlOf(phase5, "down"));
    const statuses = await database.query<{ status: string }>("SELECT status::text FROM leads ORDER BY id");
    expect(statuses.rows).toEqual([{ status: "contacted" }, { status: "qualified" }]);
  }, 30_000);
});
