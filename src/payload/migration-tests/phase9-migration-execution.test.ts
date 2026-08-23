import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function source(name: string) { return readFileSync(fileURLToPath(new URL(`../migrations/${name}.ts`, import.meta.url)), "utf8"); }
function sqlOf(contents: string, direction: "up" | "down") { const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`)); if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`); return match[1]; }
const migrations = [
  "20260823_150443_phase3_blog_foundation", "20260823_160853_phase4_ai_content_engine", "20260823_163755_phase5_lead_inbox_messages", "20260823_171411_phase6_measurement_pricing", "20260823_172422_phase6_measurement_license_evidence", "20260823_173944_phase7_quotes_contracts", "20260823_175110_phase7_message_attachments", "20260823_182703_phase8_work_orders", "20260823_194404_phase9_change_agreements_communications",
].map(source);

describe("phase nine change agreements and communications migration", () => {
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
    for (const migration of migrations.slice(0, 8)) await database.exec(sqlOf(migration, "up"));
  });
  afterEach(async () => database.close());

  it("stores a versioned agreement and the new communication categories", async () => {
    await database.exec(sqlOf(migrations[8], "up"));
    await database.exec(`
      INSERT INTO users DEFAULT VALUES; INSERT INTO leads (status,preferred_channel) VALUES ('quoted','email');
      INSERT INTO price_rules (reference,version,service_key,unit_price_ex_vat_ore,vat_basis_points,minimum_ex_vat_ore,tolerance_basis_points,valid_from,terms_version,status) VALUES ('R1',1,'takvask',13800,2500,0,1000,now(),'v1','approved');
      INSERT INTO roof_measurements (reference,lead_id,version,normalized_address,latitude,longitude,source,license,credits,imagery_licensed,captured_at,roof_planes,horizontal_area_tenths,actual_area_min_tenths,actual_area_max_tenths,calculation_snapshot,input_hash,confidence,confidence_reasoning,status) VALUES ('M1',1,1,'Test',60,10,'test','test','test',true,now(),'[]',1000,1000,1100,'{}','hash','high','verified','approved');
      INSERT INTO price_calculations (reference,lead_id,measurement_id,price_rule_id,input_snapshot,output_snapshot,input_hash,subtotal_ex_vat_ore,vat_ore,total_inc_vat_ore,status) VALUES ('P1',1,1,1,'{}','{}','hash',10000,2500,12500,'ready');
      INSERT INTO quotes (reference,lead_id,measurement_id,price_calculation_id,version,snapshot,snapshot_hash,service_description,total_inc_vat_ore,terms_version,valid_until,status) VALUES ('T1',1,1,1,1,'{}','hash','Takvask',12500,'v1',now()+interval '1 day','accepted');
      INSERT INTO contracts (reference,quote_id,version,snapshot,document_hash,terms_version,status) VALUES ('K1',1,1,'{}','hash','v1','signed');
      INSERT INTO work_orders (reference,lead_id,status,work_summary,quote_id,contract_id,contract_document_hash) VALUES ('A-K1',1,'blocked','Takvask',1,1,'hash');
      INSERT INTO change_agreements (reference,work_order_id,contract_id,version,snapshot,document_hash,reason_code,reason_description,before_total_inc_vat_ore,after_total_inc_vat_ore,valid_until,status) VALUES ('E-1-V1',1,1,1,'{}','hash','over_maximum','Større areal',12500,15000,now()+interval '1 day','approved');
      INSERT INTO messages (lead_id,direction,category,channel,subject,body_text,status,idempotency_key,ai_assisted) VALUES (1,'outbound','schedule_confirmation','email','Tid','Tekst','queued','phase9-message',false);
    `);
    const rows = await database.query<{ reference: string; preferred_channel: string; category: string }>(`SELECT c.reference,l.preferred_channel::text,m.category::text FROM change_agreements c JOIN leads l ON l.id=1 JOIN messages m ON m.id=1`);
    expect(rows.rows).toEqual([{ reference: "E-1-V1", preferred_channel: "email", category: "schedule_confirmation" }]);
  }, 30_000);

  it("rolls back after mapping new message categories to legacy values", async () => {
    await database.exec("INSERT INTO leads (status) VALUES ('new')");
    await database.exec(sqlOf(migrations[8], "up"));
    await database.exec("INSERT INTO messages (lead_id,direction,category,channel,subject,body_text,status,idempotency_key,ai_assisted) VALUES (1,'outbound','completion','email','Ferdig','Tekst','queued','phase9-rollback',false)");
    await database.exec(sqlOf(migrations[8], "down"));
    const rows = await database.query<{ category: string }>("SELECT category::text category FROM messages");
    expect(rows.rows).toEqual([{ category: "reminder" }]);
  }, 30_000);
});
