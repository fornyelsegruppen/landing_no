import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const contents = readFileSync(fileURLToPath(new URL("../migrations/20260825_230000_measurement_evidence.ts", import.meta.url)), "utf8");
function sqlOf(direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("F2 measurement evidence migration", () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await database.exec("CREATE TABLE users (id serial PRIMARY KEY); CREATE TABLE private_media (id serial PRIMARY KEY); CREATE TABLE roof_measurements (id serial PRIMARY KEY, latitude numeric NOT NULL, longitude numeric NOT NULL);");
  });
  afterEach(async () => database.close());

  it("adds immutable evidence and manual no-visual fields and rolls them back", async () => {
    await database.exec(sqlOf("up"));
    const columns = await database.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='roof_measurements' AND column_name IN ('measurement_mode','evidence_hash','evidence_snapshot_id','manual_area_source','manual_area_reason') ORDER BY column_name");
    expect(columns.rows.map((row) => row.column_name)).toEqual(["evidence_hash", "evidence_snapshot_id", "manual_area_reason", "manual_area_source", "measurement_mode"]);
    const nullable = await database.query<{ column_name: string; is_nullable: string }>("SELECT column_name,is_nullable FROM information_schema.columns WHERE table_name='roof_measurements' AND column_name IN ('latitude','longitude') ORDER BY column_name");
    expect(nullable.rows).toEqual([{ column_name: "latitude", is_nullable: "YES" }, { column_name: "longitude", is_nullable: "YES" }]);
    await database.exec("UPDATE roof_measurements SET latitude=1, longitude=1");
    await database.exec(sqlOf("down"));
  }, 30_000);
});
