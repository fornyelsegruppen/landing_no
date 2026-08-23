import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("./20260823_135227_phase1_platform_foundation.ts", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");

describe("phase one migration safety", () => {
  it("is additive and limited to phase-one platform tables", () => {
    for (const table of [
      "audit_events",
      "operational_jobs",
      "access_tokens",
      "private_media",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS \"${table}\"`);
    }

    for (const historicalObject of [
      'CREATE TABLE "users"',
      'CREATE TABLE "leads"',
      'CREATE TABLE "posts"',
      'CREATE TABLE "pages"',
      'ALTER TABLE "leads" ADD COLUMN',
      'DROP TABLE "users"',
    ]) {
      expect(migration).not.toContain(historicalObject);
    }
  });

  it("keeps rollback limited to phase-one objects", () => {
    expect(migration).toContain('DROP TABLE IF EXISTS "private_media"');
    expect(migration).toContain('DROP TABLE IF EXISTS "audit_events"');
    expect(migration).not.toContain('DROP TABLE IF EXISTS "users"');
    expect(migration).not.toContain('DROP TABLE IF EXISTS "leads"');
  });
});
