import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assertPreviewMigrationDatabase,
  normalizedNeonEndpointId,
} from "./preview-database-guard.mjs";

const branchUrl =
  "postgresql://user:secret@ep-preview-branch-pooler.us-east-1.aws.neon.tech/app";
const branchFingerprint = createHash("sha256")
  .update("ep-preview-branch")
  .digest("hex");
const baseFingerprint = createHash("sha256")
  .update("ep-protected-base")
  .digest("hex");

function approvedEnvironment(overrides = {}) {
  return {
    DATABASE_URL: branchUrl,
    DATABASE_URL_MIGRATE: "",
    NEON_PROJECT_ID: "approved-neon-project",
    PREVIEW_BASE_DATABASE_ENDPOINT_SHA256: baseFingerprint,
    PREVIEW_EXPECTED_NEON_PROJECT_ID: "approved-neon-project",
    VERCEL_ENV: "preview",
    ...overrides,
  };
}

describe("Preview migration database guard", () => {
  it("accepts only a deployment endpoint in the approved Neon project", () => {
    assert.equal(
      assertPreviewMigrationDatabase(approvedEnvironment()),
      branchFingerprint,
    );
  });

  it("normalizes Neon pooler and direct hosts to one endpoint identity", () => {
    assert.equal(normalizedNeonEndpointId(branchUrl), "ep-preview-branch");
    assert.equal(
      normalizedNeonEndpointId(
        "postgres://other:secret@ep-preview-branch.us-east-1.aws.neon.tech/app",
      ),
      "ep-preview-branch",
    );
  });

  it("rejects a static migration override", () => {
    assert.throws(
      () =>
        assertPreviewMigrationDatabase(
          approvedEnvironment({ DATABASE_URL_MIGRATE: branchUrl }),
        ),
      /DATABASE_URL_MIGRATE overrides/,
    );
  });

  for (const [name, environment, expected] of [
    [
      "missing deployment URL",
      { VERCEL_ENV: "preview" },
      /deployment DATABASE_URL/,
    ],
    [
      "missing base fingerprint",
      approvedEnvironment({ PREVIEW_BASE_DATABASE_ENDPOINT_SHA256: "" }),
      /endpoint fingerprint/,
    ],
    [
      "protected base endpoint",
      approvedEnvironment({
        DATABASE_URL:
          "postgres://user:secret@ep-protected-base.us-east-1.aws.neon.tech/app",
      }),
      /protected base branch/,
    ],
    [
      "wrong Neon project",
      approvedEnvironment({ NEON_PROJECT_ID: "other-neon-project" }),
      /project identity/,
    ],
    [
      "non-Postgres URL",
      approvedEnvironment({
        DATABASE_URL:
          "mysql://user:BUILD_LOG_SECRET@ep-preview-branch.us-east-1.aws.neon.tech/app",
      }),
      /not PostgreSQL/,
    ],
    [
      "non-Neon host",
      approvedEnvironment({
        DATABASE_URL: "postgres://user:secret@database.example.test/app",
      }),
      /not a Neon endpoint/,
    ],
  ]) {
    it(`fails closed for ${name}`, () => {
      assert.throws(
        () => assertPreviewMigrationDatabase(environment),
        expected,
      );
    });
  }

  it("leaves non-Preview migration selection unchanged", () => {
    assert.equal(
      assertPreviewMigrationDatabase({
        DATABASE_URL_MIGRATE:
          "postgres://user:secret@production.example.test/app",
        VERCEL_ENV: "production",
      }),
      null,
    );
  });

  it("rejects Preview release controls on a non-Preview deployment target", () => {
    assert.throws(
      () =>
        assertPreviewMigrationDatabase({
          PREVIEW_BASE_DATABASE_ENDPOINT_SHA256: baseFingerprint,
          PREVIEW_EXPECTED_NEON_PROJECT_ID: "approved-neon-project",
          VERCEL_ENV: "production",
        }),
      /VERCEL_ENV is not preview/,
    );
  });

  it("fingerprints the supplied environment file instead of an ambient URL", async () => {
    const directory = await mkdtemp(join(tmpdir(), "preview-db-fingerprint-"));
    const environmentFile = join(directory, "preview.env");
    await writeFile(
      environmentFile,
      `DATABASE_URL=${branchUrl}\nNEON_PROJECT_ID=approved-neon-project\n`,
      "utf8",
    );
    try {
      const result = spawnSync(
        process.execPath,
        [
          join(process.cwd(), "scripts/database-endpoint-fingerprint.mjs"),
          environmentFile,
          "DATABASE_URL",
          "approved-neon-project",
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            DATABASE_URL:
              "postgres://ambient:secret@ep-wrong-ambient.us-east-1.aws.neon.tech/app",
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), branchFingerprint);
      assert.doesNotMatch(result.stdout, /secret|neon\.tech/i);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
