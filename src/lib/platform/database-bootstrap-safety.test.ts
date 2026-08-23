import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const bootstrapScript = readFileSync(
  fileURLToPath(
    new URL("../../../scripts/push-schema-jiti.mjs", import.meta.url),
  ),
  "utf8",
);

describe("empty PostgreSQL bootstrap safety", () => {
  it("requires an explicit baseline flag and a truly empty public schema", () => {
    expect(bootstrapScript).toContain("--baseline-current-migrations");
    expect(bootstrapScript).toContain("table_schema = 'public'");
    expect(bootstrapScript).toContain("tableCount !== 0");
    expect(bootstrapScript).toContain("Refusing empty database bootstrap");
  });

  it("records the current migrations atomically after schema creation", () => {
    expect(bootstrapScript).toContain('query("BEGIN")');
    expect(bootstrapScript).toContain("delete from payload_migrations where batch = -1");
    expect(bootstrapScript).toContain("insert into payload_migrations");
    expect(bootstrapScript).toContain('query("COMMIT")');
    expect(bootstrapScript).toContain('query("ROLLBACK")');
  });
});
