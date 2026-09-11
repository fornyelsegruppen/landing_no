import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPayloadDatabaseStartupSafe } from "./payload-database-safety";

describe("Payload database startup safety", () => {
  it.each([undefined, "true"])(
    "rejects production drops even with PAYLOAD_MIGRATING=%s",
    (migrating) => {
      expect(() =>
        assertPayloadDatabaseStartupSafe({
          NODE_ENV: "production",
          PAYLOAD_DROP_DATABASE: "true",
          PAYLOAD_MIGRATING: migrating,
        }),
      ).toThrow("PAYLOAD_DROP_DATABASE must not be enabled in production");
    },
  );

  it("allows ordinary production startup and explicit migrations", () => {
    expect(() =>
      assertPayloadDatabaseStartupSafe({
        NODE_ENV: "production",
        PAYLOAD_MIGRATING: "true",
      }),
    ).not.toThrow();
  });

  it("preserves the local development reset option", () => {
    expect(() =>
      assertPayloadDatabaseStartupSafe({
        NODE_ENV: "development",
        PAYLOAD_DROP_DATABASE: "true",
      }),
    ).not.toThrow();
  });

  it("keeps runtime schema changes disabled and explicit migration execution available", () => {
    const config = readFileSync(
      new URL("../payload.config.ts", import.meta.url),
      "utf8",
    );
    const migrate = readFileSync(
      new URL("../../scripts/run-migrate.mjs", import.meta.url),
      "utf8",
    );
    expect(config).toContain("assertPayloadDatabaseStartupSafe();");
    expect(config).toContain("disableCreateDatabase: true");
    expect(config).toContain('push: process.env.NODE_ENV !== "production"');
    expect(config).not.toContain("prodMigrations:");
    expect(migrate).toContain("await payload.db.migrate({ migrations });");
  });
});
