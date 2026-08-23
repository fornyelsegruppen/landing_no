import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(fileURLToPath(new URL(`../migrations/${name}.ts`, import.meta.url)), "utf8");
}

function migrationSql(contents: string, direction: "up" | "down") {
  const match = contents.match(new RegExp(`export async function ${direction}\\([\\s\\S]*?await db\\.execute\\(sql\\x60([\\s\\S]*?)\\x60\\)`));
  if (!match?.[1]) throw new Error(`Could not extract ${direction} SQL`);
  return match[1];
}

const phase3 = source("20260823_150443_phase3_blog_foundation");
const phase4 = source("20260823_160853_phase4_ai_content_engine");

describe("phase four AI content migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE services (id serial PRIMARY KEY);
      CREATE TABLE posts (id serial PRIMARY KEY, slug varchar NOT NULL, title_no varchar NOT NULL, title_en varchar, content_no varchar NOT NULL, content_en varchar);
      CREATE TABLE _posts_v (id serial PRIMARY KEY);
      CREATE TABLE leads (id serial PRIMARY KEY);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    `);
    await database.exec(migrationSql(phase3, "up"));
  });

  afterEach(async () => database.close());

  it("backfills legacy topic/run rows and enforces idempotency", async () => {
    await database.exec(`
      INSERT INTO seo_topics (topic, primary_keyword, search_intent, source, reason_for_selection, status)
      VALUES ('Eldre tema', 'takvask', 'commercial', 'manual', 'Test', 'candidate');
      INSERT INTO seo_runs (job_type, status, started_at) VALUES ('blog.article.draft', 'completed', now());
    `);
    await database.exec(migrationSql(phase4, "up"));
    const topic = await database.query<{ fingerprint: string }>("SELECT fingerprint FROM seo_topics");
    const run = await database.query<{ idempotency_key: string; trigger_source: string }>("SELECT idempotency_key, trigger_source::text FROM seo_runs");
    expect(topic.rows[0]?.fingerprint).toMatch(/^legacy-topic-/);
    expect(run.rows[0]).toMatchObject({ trigger_source: "manual" });
    await expect(database.exec("INSERT INTO seo_runs (idempotency_key, job_type, trigger_source, status, started_at) VALUES ('legacy-run-1', 'x', 'manual', 'completed', now())")).rejects.toThrow();
  }, 30_000);

  it("rolls back even when rejected drafts exist", async () => {
    await database.exec(migrationSql(phase4, "up"));
    await database.exec("INSERT INTO posts (slug, title_no, content_no, editorial_status) VALUES ('avvist', 'Avvist', 'Innhold', 'rejected')");
    await database.exec(migrationSql(phase4, "down"));
    const post = await database.query<{ editorial_status: string }>("SELECT editorial_status::text FROM posts");
    expect(post.rows[0]?.editorial_status).toBe("draft");
  }, 30_000);
});
