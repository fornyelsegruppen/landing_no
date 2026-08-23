import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function source(name: string) { return readFileSync(fileURLToPath(new URL(`../migrations/${name}.ts`, import.meta.url)), "utf8"); }
function sqlOf(contents: string, direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`); return match[1];
}
const migrations = [
  "20260823_150443_phase3_blog_foundation", "20260823_160853_phase4_ai_content_engine", "20260823_163755_phase5_lead_inbox_messages",
  "20260823_171411_phase6_measurement_pricing", "20260823_172422_phase6_measurement_license_evidence", "20260823_173944_phase7_quotes_contracts",
  "20260823_175110_phase7_message_attachments", "20260823_182703_phase8_work_orders",
].map(source);

describe("phase eight work-order migration", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY); CREATE TABLE services (id serial PRIMARY KEY); CREATE TABLE private_media (id serial PRIMARY KEY);
      CREATE TABLE posts (id serial PRIMARY KEY, slug varchar NOT NULL, title_no varchar NOT NULL, title_en varchar, content_no varchar NOT NULL, content_en varchar); CREATE TABLE _posts_v (id serial PRIMARY KEY);
      CREATE TYPE enum_leads_status AS ENUM ('new', 'contacted', 'qualified', 'closed'); CREATE TABLE leads (id serial PRIMARY KEY, status enum_leads_status DEFAULT 'new' NOT NULL);
      CREATE TYPE enum_work_orders_status AS ENUM ('unassigned', 'assigned', 'scheduled');
      CREATE TABLE work_orders (id serial PRIMARY KEY, reference varchar NOT NULL UNIQUE, lead_id integer, assigned_worker_id integer, scheduled_at timestamptz, status enum_work_orders_status DEFAULT 'unassigned' NOT NULL, work_summary varchar);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
    for (const migration of migrations.slice(0, 5)) await database.exec(sqlOf(migration, "up"));
    await database.exec(sqlOf(migrations[5], "up")); await database.exec(sqlOf(migrations[6], "up"));
  });
  afterEach(async () => database.close());

  it("preserves a legacy shell row and stores a signed-contract work order", async () => {
    await database.exec("INSERT INTO work_orders (reference) VALUES ('LEGACY-1')");
    await database.exec(sqlOf(migrations[7], "up"));
    await database.exec(`
      INSERT INTO users DEFAULT VALUES; INSERT INTO leads (status) VALUES ('quoted');
      INSERT INTO price_rules (reference,version,service_key,unit_price_ex_vat_ore,vat_basis_points,minimum_ex_vat_ore,tolerance_basis_points,valid_from,terms_version,status) VALUES ('R1',1,'takvask',13800,2500,0,1000,now(),'v1','approved');
      INSERT INTO roof_measurements (reference,lead_id,version,normalized_address,latitude,longitude,source,license,credits,imagery_licensed,captured_at,roof_planes,horizontal_area_tenths,actual_area_min_tenths,actual_area_max_tenths,calculation_snapshot,input_hash,confidence,confidence_reasoning,status) VALUES ('M1',1,1,'Test',60,10,'test','test','test',true,now(),'[]',1000,1000,1100,'{}','hash','high','verified','approved');
      INSERT INTO price_calculations (reference,lead_id,measurement_id,price_rule_id,input_snapshot,output_snapshot,input_hash,subtotal_ex_vat_ore,vat_ore,total_inc_vat_ore,status) VALUES ('P1',1,1,1,'{}','{}','hash',10000,2500,12500,'ready');
      INSERT INTO quotes (reference,lead_id,measurement_id,price_calculation_id,version,snapshot,snapshot_hash,service_description,total_inc_vat_ore,terms_version,valid_until,status) VALUES ('T1',1,1,1,1,'{}','hash','Takvask',12500,'v1',now()+interval '1 day','accepted');
      INSERT INTO contracts (reference,quote_id,version,snapshot,document_hash,terms_version,status) VALUES ('K1',1,1,'{}','hash','v1','signed');
      INSERT INTO work_orders (reference,lead_id,status,work_summary,quote_id,contract_id,contract_document_hash,precheck_decision,price_outcome) VALUES ('A-K1',1,'ready','Takvask',1,1,'hash','ready','within_contract');
    `);
    const rows = await database.query<{ reference: string; status: string }>("SELECT reference,status::text status FROM work_orders ORDER BY id");
    expect(rows.rows).toEqual([{ reference: "LEGACY-1", status: "unassigned" }, { reference: "A-K1", status: "ready" }]);
  }, 30_000);

  it("rolls back new statuses and fields without losing legacy rows", async () => {
    await database.exec("INSERT INTO work_orders (reference,status) VALUES ('LEGACY-1','scheduled')");
    await database.exec(sqlOf(migrations[7], "up"));
    await database.exec("UPDATE work_orders SET status='documented'");
    await database.exec(sqlOf(migrations[7], "down"));
    const rows = await database.query<{ status: string }>("SELECT status::text status FROM work_orders");
    expect(rows.rows).toEqual([{ status: "scheduled" }]);
  }, 30_000);
});
