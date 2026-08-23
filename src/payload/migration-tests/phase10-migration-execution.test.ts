import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function source(name: string) { return readFileSync(fileURLToPath(new URL(`../migrations/${name}.ts`, import.meta.url)), "utf8"); }
function sqlOf(contents: string, direction: "up" | "down") { const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`)); if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`); return match[1]; }
const migrations = [
  "20260823_150443_phase3_blog_foundation", "20260823_160853_phase4_ai_content_engine", "20260823_163755_phase5_lead_inbox_messages", "20260823_171411_phase6_measurement_pricing", "20260823_172422_phase6_measurement_license_evidence", "20260823_173944_phase7_quotes_contracts", "20260823_175110_phase7_message_attachments", "20260823_182703_phase8_work_orders", "20260823_194404_phase9_change_agreements_communications", "20260823_200533_phase10_content_measurement_hardening",
].map(source);

describe("phase ten content measurement migration", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY); CREATE TABLE services (id serial PRIMARY KEY); CREATE TABLE private_media (id serial PRIMARY KEY);
      CREATE TABLE posts (id serial PRIMARY KEY, slug varchar NOT NULL, title_no varchar NOT NULL, title_en varchar, content_no varchar NOT NULL, content_en varchar); CREATE TABLE _posts_v (id serial PRIMARY KEY);
      CREATE TYPE enum_leads_status AS ENUM ('new', 'contacted', 'qualified', 'closed'); CREATE TABLE leads (id serial PRIMARY KEY, status enum_leads_status DEFAULT 'new' NOT NULL);
      CREATE TYPE enum_work_orders_status AS ENUM ('unassigned', 'assigned', 'scheduled'); CREATE TABLE work_orders (id serial PRIMARY KEY, reference varchar NOT NULL UNIQUE, lead_id integer, assigned_worker_id integer, scheduled_at timestamptz, status enum_work_orders_status DEFAULT 'unassigned' NOT NULL, work_summary varchar);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
    for (const migration of migrations.slice(0, 9)) await database.exec(sqlOf(migration, "up"));
  });
  afterEach(async () => database.close());

  it("stores lead attribution and a human-reviewed content recommendation", async () => {
    await database.exec("INSERT INTO posts (slug,title_no,content_no) VALUES ('takvask-pris','Takvask pris','Innhold')");
    await database.exec(sqlOf(migrations[9], "up"));
    await database.exec("UPDATE posts SET lead_performance_leads=3,lead_performance_converted_leads=1,content_audit_recommendation='keep',content_audit_reason='Gir leads' WHERE id=1");
    const rows = await database.query<{ leads: number; recommendation: string }>("SELECT lead_performance_leads::int leads,content_audit_recommendation::text recommendation FROM posts");
    expect(rows.rows).toEqual([{ leads: 3, recommendation: "keep" }]);
    await database.exec(sqlOf(migrations[9], "down"));
    const columns = await database.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='posts' AND column_name='lead_performance_leads'");
    expect(columns.rows).toEqual([]);
  }, 30_000);
});
