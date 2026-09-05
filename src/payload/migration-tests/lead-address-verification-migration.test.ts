import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260905_100000_lead_address_verification.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

function sqlOf(direction: "up" | "down") {
  const match = contents.match(
    new RegExp(
      `export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`,
    ),
  );
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("Lead address verification migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec("CREATE TABLE leads (id serial PRIMARY KEY);");
  });
  afterEach(async () => database.close());

  it("round-trips nullable address provenance", async () => {
    await database.exec(sqlOf("up"));
    await database.exec(`
      INSERT INTO leads (
        address_verification_status,
        address_verification_provider,
        address_verification_provider_id,
        address_latitude,
        address_longitude,
        address_verified_at
      ) VALUES (
        'verified',
        'kartverket-address-rest-v1',
        '0301-1-2-0-0-Testveien 1',
        59.8901,
        10.7901,
        '2026-09-05T08:00:00.000Z'
      );
      INSERT INTO leads (address_verification_status) VALUES ('manual');
    `);
    const rows = await database.query<{
      status: string;
      provider: string | null;
    }>(`
      SELECT address_verification_status AS status,
             address_verification_provider AS provider
      FROM leads ORDER BY id
    `);
    expect(rows.rows).toEqual([
      {
        status: "verified",
        provider: "kartverket-address-rest-v1",
      },
      { status: "manual", provider: null },
    ]);

    await database.exec(sqlOf("down"));
    const columns = await database.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'leads'
        AND column_name LIKE 'address_verification%'
    `);
    expect(columns.rows).toEqual([]);
  }, 30_000);

  it("rejects partial or out-of-Norway verified provenance", async () => {
    await database.exec(sqlOf("up"));
    await expect(
      database.exec(`
        INSERT INTO leads (
          address_verification_status,
          address_verification_provider,
          address_verification_provider_id,
          address_latitude,
          address_longitude,
          address_verified_at
        ) VALUES ('verified', 'kartverket-address-rest-v1', 'id', 1, 2, now());
      `),
    ).rejects.toThrow();
    await expect(
      database.exec(`
        INSERT INTO leads (
          address_verification_status,
          address_verification_provider,
          address_verification_provider_id,
          address_latitude,
          address_longitude,
          address_verified_at
        ) VALUES ('verified', 'client-claim', 'id', 59.9, 10.8, now());
      `),
    ).rejects.toThrow();
    await expect(
      database.exec(`
        INSERT INTO leads (
          address_verification_status,
          address_verification_provider,
          address_verification_provider_id,
          address_latitude,
          address_longitude,
          address_verified_at
        ) VALUES ('verified', 'kartverket-address-rest-v1', '  ', 59.9, 10.8, now());
      `),
    ).rejects.toThrow();
    await expect(
      database.exec(`
        INSERT INTO leads (
          address_verification_status,
          address_verification_provider
        ) VALUES ('manual', 'client-claim');
      `),
    ).rejects.toThrow();
  }, 30_000);
});
