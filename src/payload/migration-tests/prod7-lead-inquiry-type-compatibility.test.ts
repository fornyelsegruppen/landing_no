import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260827_090000_lead_inquiry_type_combined_service.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

function upSql() {
  const match = contents.match(
    /export async function up\([\s\S]*?await db\.execute\(sql`([\s\S]*?)`\)/,
  );
  if (!match?.[1]) throw new Error("Could not extract migration SQL");
  return match[1];
}

describe("PROD-7 lead inquiry type compatibility migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TYPE enum_leads_type AS ENUM(
        'vedlikehold',
        'nytt_tak',
        'kledning',
        'takvask',
        'impregnering',
        'takmaling',
        'usikker'
      );
      CREATE TABLE leads (
        id serial PRIMARY KEY,
        inquiry_type enum_leads_type NOT NULL
      );
    `);
  });

  afterEach(async () => database.close());

  it("adds the public combined-service value without changing existing leads", async () => {
    await database.exec("INSERT INTO leads (inquiry_type) VALUES ('takvask')");

    await database.exec(upSql());
    await database.exec(
      "INSERT INTO leads (inquiry_type) VALUES ('takvask_impregnering')",
    );

    const result = await database.query<{ inquiry_type: string }>(
      "SELECT inquiry_type::text AS inquiry_type FROM leads ORDER BY id",
    );
    expect(result.rows).toEqual([
      { inquiry_type: "takvask" },
      { inquiry_type: "takvask_impregnering" },
    ]);
  }, 30_000);

  it("is safe when the enum label already exists", async () => {
    await database.exec(upSql());
    await database.exec(upSql());

    const labels = await database.query<{ enumlabel: string }>(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'enum_leads_type'
        AND enumlabel = 'takvask_impregnering'
    `);
    expect(labels.rows).toEqual([{ enumlabel: "takvask_impregnering" }]);
  }, 30_000);

  it("uses the enum actually attached to the inquiry column", async () => {
    await database.exec(`
      DROP TABLE leads;
      DROP TYPE enum_leads_type;
      CREATE TYPE enum_leads_inquiry_type AS ENUM('takvask', 'usikker');
      CREATE TABLE leads (
        id serial PRIMARY KEY,
        inquiry_type enum_leads_inquiry_type NOT NULL
      );
    `);

    await database.exec(upSql());
    await database.exec(
      "INSERT INTO leads (inquiry_type) VALUES ('takvask_impregnering')",
    );

    const result = await database.query<{ inquiry_type: string }>(
      "SELECT inquiry_type::text AS inquiry_type FROM leads",
    );
    expect(result.rows).toEqual([
      { inquiry_type: "takvask_impregnering" },
    ]);
  }, 30_000);

  it("is a safe no-op before the leads schema exists", async () => {
    await database.exec("DROP TABLE leads; DROP TYPE enum_leads_type");
    await expect(database.exec(upSql())).resolves.toBeDefined();
  }, 30_000);
});
