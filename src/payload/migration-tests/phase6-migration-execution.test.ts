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
const phase6 = source("20260823_171411_phase6_measurement_pricing");
const phase6License = source("20260823_172422_phase6_measurement_license_evidence");

describe("phase six measurement and pricing migration", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE services (id serial PRIMARY KEY);
      CREATE TABLE private_media (id serial PRIMARY KEY);
      CREATE TABLE posts (id serial PRIMARY KEY, slug varchar NOT NULL, title_no varchar NOT NULL, title_en varchar, content_no varchar NOT NULL, content_en varchar);
      CREATE TABLE _posts_v (id serial PRIMARY KEY);
      CREATE TYPE enum_leads_status AS ENUM ('new', 'contacted', 'qualified', 'closed');
      CREATE TABLE leads (id serial PRIMARY KEY, status enum_leads_status DEFAULT 'new' NOT NULL);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
    await database.exec(sqlOf(phase3, "up"));
    await database.exec(sqlOf(phase4, "up"));
    await database.exec(sqlOf(phase5, "up"));
  });
  afterEach(async () => database.close());

  it("creates versioned measurement, rule and immutable calculation tables", async () => {
    await database.exec(sqlOf(phase6, "up"));
    await database.exec(sqlOf(phase6License, "up"));
    await database.exec(`
      INSERT INTO users DEFAULT VALUES;
      INSERT INTO leads (status) VALUES ('measuring');
      INSERT INTO price_rules (reference, version, service_key, unit_price_ex_vat_ore, vat_basis_points, minimum_ex_vat_ore, tolerance_basis_points, valid_from, terms_version, status)
      VALUES ('TV-1', 1, 'takvask', 13800, 2500, 100000, 1000, now(), '2026-08', 'approved');
      INSERT INTO roof_measurements (reference, lead_id, version, normalized_address, latitude, longitude, source, license, credits, captured_at, roof_planes, horizontal_area_tenths, actual_area_min_tenths, actual_area_max_tenths, calculation_snapshot, input_hash, confidence, confidence_reasoning, status)
      VALUES ('TM-1-V1', 1, 1, 'Testveien 1', 60, 10, 'manual', 'licensed', '© test', now(), '[]', 1000, 1079, 1179, '{}', 'hash', 'medium', 'Manually verified roof', 'approved');
      INSERT INTO price_calculations (reference, lead_id, measurement_id, price_rule_id, input_snapshot, output_snapshot, input_hash, subtotal_ex_vat_ore, vat_ore, total_inc_vat_ore, status)
      VALUES ('PB-1', 1, 1, 1, '{}', '{}', 'hash', 1380000, 345000, 1725000, 'ready');
    `);
    const result = await database.query<{ total: string }>("SELECT total_inc_vat_ore::text AS total FROM price_calculations");
    expect(result.rows).toEqual([{ total: "1725000" }]);
  }, 30_000);

  it("rolls back cleanly after deleting dependent phase-six data", async () => {
    await database.exec(sqlOf(phase6, "up"));
    await database.exec(sqlOf(phase6License, "up"));
    await database.exec(sqlOf(phase6License, "down"));
    await database.exec(sqlOf(phase6, "down"));
    const tables = await database.query<{ name: string }>("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename IN ('roof_measurements','price_rules','price_calculations')");
    expect(tables.rows).toEqual([]);
  }, 30_000);
});
