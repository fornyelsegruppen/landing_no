import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function source(name: string) { return readFileSync(fileURLToPath(new URL(`../migrations/${name}.ts`, import.meta.url)), "utf8"); }
function sqlOf(contents: string, direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`); return match[1];
}
const migrations = {
  p3: source("20260823_150443_phase3_blog_foundation"), p4: source("20260823_160853_phase4_ai_content_engine"),
  p5: source("20260823_163755_phase5_lead_inbox_messages"), p6: source("20260823_171411_phase6_measurement_pricing"),
  p6l: source("20260823_172422_phase6_measurement_license_evidence"), p7: source("20260823_173944_phase7_quotes_contracts"),
  p7a: source("20260823_175110_phase7_message_attachments"),
};

describe("phase seven quote and contract migrations", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY); CREATE TABLE services (id serial PRIMARY KEY); CREATE TABLE private_media (id serial PRIMARY KEY);
      CREATE TABLE posts (id serial PRIMARY KEY, slug varchar NOT NULL, title_no varchar NOT NULL, title_en varchar, content_no varchar NOT NULL, content_en varchar); CREATE TABLE _posts_v (id serial PRIMARY KEY);
      CREATE TYPE enum_leads_status AS ENUM ('new', 'contacted', 'qualified', 'closed'); CREATE TABLE leads (id serial PRIMARY KEY, status enum_leads_status DEFAULT 'new' NOT NULL);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
    for (const phase of [migrations.p3, migrations.p4, migrations.p5, migrations.p6, migrations.p6l]) await database.exec(sqlOf(phase, "up"));
  });
  afterEach(async () => database.close());

  it("persists locked quote, contract and approved term versions", async () => {
    await database.exec(sqlOf(migrations.p7, "up")); await database.exec(sqlOf(migrations.p7a, "up"));
    await database.exec(`
      INSERT INTO users DEFAULT VALUES; INSERT INTO leads (status) VALUES ('quoted');
      INSERT INTO price_rules (reference, version, service_key, unit_price_ex_vat_ore, vat_basis_points, minimum_ex_vat_ore, tolerance_basis_points, valid_from, terms_version, status) VALUES ('R1',1,'takvask',13800,2500,0,1000,now(),'v1','approved');
      INSERT INTO roof_measurements (reference,lead_id,version,normalized_address,latitude,longitude,source,license,credits,imagery_licensed,captured_at,roof_planes,horizontal_area_tenths,actual_area_min_tenths,actual_area_max_tenths,calculation_snapshot,input_hash,confidence,confidence_reasoning,status) VALUES ('M1',1,1,'Test',60,10,'test','test','test',true,now(),'[]',1000,1000,1100,'{}','hash','high','verified roof','approved');
      INSERT INTO price_calculations (reference,lead_id,measurement_id,price_rule_id,input_snapshot,output_snapshot,input_hash,subtotal_ex_vat_ore,vat_ore,total_inc_vat_ore,status) VALUES ('P1',1,1,1,'{}','{}','hash',10000,2500,12500,'ready');
      INSERT INTO contract_terms (version,title,contract_text,withdrawal_instructions,withdrawal_form_url,status,legal_review_reference) VALUES ('v1','Vilkår','Long approved text','Long withdrawal information','https://example.test/form','approved','LEGAL-1');
      INSERT INTO quotes (reference,lead_id,measurement_id,price_calculation_id,version,snapshot,snapshot_hash,service_description,total_inc_vat_ore,terms_version,valid_until,status) VALUES ('T-1-V1',1,1,1,1,'{}','hash','Takvask',12500,'v1',now()+interval '14 days','approved');
      INSERT INTO contracts (reference,quote_id,version,snapshot,document_hash,terms_version,status) VALUES ('K-1-V1',1,1,'{}','hash','v1','issued');
      INSERT INTO messages (lead_id,direction,category,channel,subject,body_text,status,idempotency_key) VALUES (1,'inbound','customer_question','email','Spørsmål','Test','delivered','q1');
      INSERT INTO messages_rels (parent_id,path,private_media_id) VALUES (1,'attachments',NULL);
    `);
    const rows = await database.query<{ quote: string; contract: string }>("SELECT q.status::text quote, c.status::text contract FROM quotes q JOIN contracts c ON c.quote_id=q.id");
    expect(rows.rows).toEqual([{ quote: "approved", contract: "issued" }]);
  }, 30_000);

  it("rolls back cleanly and maps customer questions to legacy follow-up", async () => {
    await database.exec(sqlOf(migrations.p7, "up")); await database.exec(sqlOf(migrations.p7a, "up"));
    await database.exec("INSERT INTO leads (status) VALUES ('new'); INSERT INTO messages (lead_id,direction,category,channel,subject,body_text,status,idempotency_key) VALUES (1,'inbound','customer_question','email','Q','B','delivered','q1')");
    await database.exec(sqlOf(migrations.p7a, "down"));
    const category = await database.query<{ category: string }>("SELECT category::text FROM messages");
    expect(category.rows).toEqual([{ category: "follow_up" }]);
    await database.exec(sqlOf(migrations.p7, "down"));
    const tables = await database.query<{ name: string }>("SELECT tablename name FROM pg_tables WHERE schemaname='public' AND tablename IN ('quotes','contracts','contract_terms')");
    expect(tables.rows).toEqual([]);
  }, 30_000);
});
