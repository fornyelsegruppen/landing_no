import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/20260823_150443_phase3_blog_foundation.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

function migrationSql(direction: "up" | "down") {
  const match = source.match(
    new RegExp(
      `export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`,
    ),
  );
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

describe("phase three blog migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE services (id serial PRIMARY KEY);
      CREATE TABLE posts (
        id serial PRIMARY KEY,
        slug varchar NOT NULL,
        title_no varchar NOT NULL,
        title_en varchar,
        content_no varchar NOT NULL,
        content_en varchar
      );
      CREATE TABLE _posts_v (id serial PRIMARY KEY);
      CREATE TABLE leads (id serial PRIMARY KEY);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
  });

  afterEach(async () => {
    await database.close();
  });

  it("creates the editorial models and keeps English optional", async () => {
    await database.exec(migrationSql("up"));
    await database.exec(`
      INSERT INTO posts (slug, title_no, content_no, editorial_status)
      VALUES ('takvask-pris', 'Takvask pris', 'Norsk faginnhold', 'draft');
      INSERT INTO seo_topics (
        topic, primary_keyword, search_intent, source,
        reason_for_selection, status
      ) VALUES (
        'Takvask pris', 'takvask pris', 'commercial', 'manual',
        'Manuelt godkjent tema', 'candidate'
      );
    `);

    const post = await database.query<{
      content_en: string | null;
      editorial_status: string;
    }>("SELECT content_en, editorial_status::text FROM posts");
    const tables = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('seo_topics', 'seo_runs', 'posts_sources')
      ORDER BY table_name
    `);

    expect(post.rows).toEqual([
      { content_en: null, editorial_status: "draft" },
    ]);
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      "posts_sources",
      "seo_runs",
      "seo_topics",
    ]);
  }, 30_000);

  it("adopts the legacy production posts_v table before extending versions", async () => {
    await database.exec('ALTER TABLE "_posts_v" ADD COLUMN "autosave" boolean');
    await database.exec('ALTER TABLE "_posts_v" RENAME TO "posts_v"');

    await database.exec(migrationSql("up"));

    const tables = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN ('posts_v', '_posts_v')
      ORDER BY table_name
    `);
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      "_posts_v",
    ]);

    const autosave = await database.query<{
      column_name: string;
      data_type: string;
    }>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '_posts_v'
        AND column_name = 'autosave'
    `);
    expect(autosave.rows).toEqual([
      { column_name: "autosave", data_type: "boolean" },
    ]);

    const compatibilityView = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'posts_v'
    `);
    expect(compatibilityView.rows).toEqual([{ table_name: "posts_v" }]);

    await database.exec('INSERT INTO "posts_v" ("autosave") VALUES (true)');
    const compatibilityWrite = await database.query<{ autosave: boolean }>(
      'SELECT "autosave" FROM "_posts_v" ORDER BY "id" DESC LIMIT 1',
    );
    expect(compatibilityWrite.rows).toEqual([{ autosave: true }]);

    await database.exec(migrationSql("down"));

    const restoredTable = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'posts_v'
    `);
    expect(restoredTable.rows).toEqual([{ table_name: "posts_v" }]);
  }, 30_000);

  it("rolls back the phase without dropping the existing CMS tables", async () => {
    await database.exec(migrationSql("up"));
    await database.exec(migrationSql("down"));

    const core = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('services', 'posts', '_posts_v', 'leads')
      ORDER BY table_name
    `);
    expect(core.rows.map(({ table_name }) => table_name)).toEqual([
      "_posts_v",
      "leads",
      "posts",
      "services",
    ]);
  }, 30_000);
});
