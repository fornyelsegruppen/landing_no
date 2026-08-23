import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260727_140000_drafts_roles.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

function sqlBlocks(contents: string) {
  return [...contents.matchAll(/await db\.execute\(sql`([\s\S]*?)`\);/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("historical draft migration enum compatibility", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TYPE enum_services_icon AS ENUM ('home');
      CREATE TYPE enum__services_v_version_icon AS ENUM ('home');

      CREATE TABLE services (
        id serial PRIMARY KEY,
        key varchar,
        icon enum_services_icon,
        _status varchar,
        created_at timestamptz,
        updated_at timestamptz
      );
      CREATE TABLE projects (id serial PRIMARY KEY, _status varchar, created_at timestamptz, updated_at timestamptz);
      CREATE TABLE products (id serial PRIMARY KEY, image_id integer, _status varchar, created_at timestamptz, updated_at timestamptz);
      CREATE TABLE faq (id serial PRIMARY KEY, _status varchar, created_at timestamptz, updated_at timestamptz);
      CREATE TABLE site_settings (
        id serial PRIMARY KEY,
        logo_id integer,
        hero_image_id integer,
        about_image_id integer,
        new_roof_image_id integer,
        _status varchar,
        created_at timestamptz,
        updated_at timestamptz
      );

      CREATE TABLE _services_v (
        id serial PRIMARY KEY,
        version_icon enum__services_v_version_icon,
        version__status varchar,
        version_created_at timestamptz,
        version_updated_at timestamptz
      );

      INSERT INTO services (icon, _status, created_at, updated_at)
      VALUES ('home', 'published', now(), now());
    `);
  });

  afterEach(async () => database.close());

  it("copies equal enum labels between distinct live and version enum types", async () => {
    const blocks = sqlBlocks(migration);
    expect(blocks.length).toBeGreaterThan(1);

    await database.exec(blocks[1] as string);

    const result = await database.query<{ icon: string }>(
      `SELECT version_icon::text AS icon FROM _services_v WHERE parent_id = 1`,
    );
    expect(result.rows).toEqual([{ icon: "home" }]);
  }, 30_000);
});
