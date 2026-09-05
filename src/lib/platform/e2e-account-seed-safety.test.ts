import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertE2EAccountSeedEnvironment,
  PREVIEW_E2E_ISOLATED_DB_FINGERPRINT,
} from "../../../scripts/seed-e2e-accounts-safety.mjs";

const approvedHost =
  `ep-${PREVIEW_E2E_ISOLATED_DB_FINGERPRINT}-pooler.eu-central-1.aws.neon.tech`;
const approvedEnvironment = {
  DATABASE_URL: `postgresql://redacted@${approvedHost}/redacted`,
  E2E_SEED_ALLOWED: "true",
  PREVIEW_E2E_EXPECTED_DB_HOST: approvedHost,
  VERCEL_ENV: "preview",
};

describe("Preview E2E account seed safety", () => {
  it("runs the environment guard before Payload configuration or database access", () => {
    const script = readFileSync(
      fileURLToPath(
        new URL("../../../scripts/seed-e2e-accounts.mjs", import.meta.url),
      ),
      "utf8",
    );
    const guard = script.indexOf(
      "assertE2EAccountSeedEnvironment(process.env)",
    );

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(script.indexOf("process.env.NODE_ENV"));
    expect(guard).toBeLessThan(script.indexOf("../src/payload.config.ts"));
    expect(guard).toBeLessThan(script.indexOf('await import("payload")'));
  });

  it("accepts only the exact approved isolated Preview host", () => {
    expect(assertE2EAccountSeedEnvironment(approvedEnvironment)).toEqual({
      databaseHost: approvedHost,
    });

    expect(() =>
      assertE2EAccountSeedEnvironment({
        ...approvedEnvironment,
        PREVIEW_E2E_EXPECTED_DB_HOST: `copy-${approvedHost}`,
      }),
    ).toThrow(/approved isolated Preview database/u);
    expect(() =>
      assertE2EAccountSeedEnvironment({
        ...approvedEnvironment,
        DATABASE_URL:
          "postgresql://redacted@preview-e2e.example.invalid/redacted",
        PREVIEW_E2E_EXPECTED_DB_HOST: "preview-e2e.example.invalid",
      }),
    ).toThrow(/approved isolated Preview database/u);
  });

  it.each([undefined, "development", "production"])(
    "fails closed outside exact Preview when VERCEL_ENV is %s",
    (vercelEnvironment) => {
      expect(() =>
        assertE2EAccountSeedEnvironment({
          ...approvedEnvironment,
          VERCEL_ENV: vercelEnvironment,
        }),
      ).toThrow(/outside Preview/u);
    },
  );

  it.each(["127.0.0.1", "localhost"])(
    "allows the isolated CI path only for local PostgreSQL at %s",
    (databaseHost) => {
      expect(
        assertE2EAccountSeedEnvironment({
          CI: "true",
          DATABASE_URL: `postgresql://postgres:postgres@${databaseHost}:5432/test`,
          E2E_SEED_ALLOWED: "true",
        }),
      ).toEqual({ databaseHost });
    },
  );

  it("rejects remote and loosely opted-in CI databases", () => {
    expect(() =>
      assertE2EAccountSeedEnvironment({
        CI: "true",
        DATABASE_URL:
          "postgresql://redacted@remote-ci.example.invalid/redacted",
        E2E_SEED_ALLOWED: "true",
      }),
    ).toThrow(/outside Preview/u);
    expect(() =>
      assertE2EAccountSeedEnvironment({
        CI: "TRUE",
        DATABASE_URL: "postgresql://redacted@127.0.0.1/redacted",
        E2E_SEED_ALLOWED: "true",
      }),
    ).toThrow(/outside Preview/u);
  });

  it("requires the explicit seed opt-in, expected host and PostgreSQL URL", () => {
    expect(() =>
      assertE2EAccountSeedEnvironment({
        ...approvedEnvironment,
        E2E_SEED_ALLOWED: "1",
      }),
    ).toThrow(/E2E_SEED_ALLOWED=true/u);
    expect(() =>
      assertE2EAccountSeedEnvironment({
        ...approvedEnvironment,
        PREVIEW_E2E_EXPECTED_DB_HOST: undefined,
      }),
    ).toThrow(/exact database host/u);
    expect(() =>
      assertE2EAccountSeedEnvironment({
        ...approvedEnvironment,
        DATABASE_URL: `https://${approvedHost}/redacted`,
      }),
    ).toThrow(/PostgreSQL URL/u);
  });
});
