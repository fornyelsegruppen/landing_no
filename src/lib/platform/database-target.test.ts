import { describe, expect, it } from "vitest";
import {
  databaseEndpointFingerprint,
  previewDatabaseTarget,
} from "./database-target";

describe("Preview database target evidence", () => {
  it("returns stable non-secret endpoint and project fingerprints in Preview", () => {
    const target = previewDatabaseTarget({
      DATABASE_URL:
        "postgres://user:secret@ep-preview-branch-pooler.us-east-1.aws.neon.tech/app?sslmode=require",
      NEON_PROJECT_ID: "approved-neon-project",
      VERCEL_ENV: "preview",
    });

    expect(target).toEqual({
      status: "configured",
      endpointFingerprint: databaseEndpointFingerprint(
        "postgres://other:credentials@ep-preview-branch.us-east-1.aws.neon.tech/other",
      ),
      projectFingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
      source: "DATABASE_URL",
    });
    expect(JSON.stringify(target)).not.toContain("secret");
    expect(JSON.stringify(target)).not.toContain("neon.tech");
  });

  it("fails observably for missing or invalid Preview configuration", () => {
    expect(previewDatabaseTarget({ VERCEL_ENV: "preview" })).toEqual({
      status: "missing",
    });
    expect(
      previewDatabaseTarget({
        DATABASE_URL: "not-a-database-url",
        NEON_PROJECT_ID: "approved-neon-project",
        VERCEL_ENV: "preview",
      }),
    ).toEqual({ status: "invalid" });
  });

  it("does not expose a target outside Preview", () => {
    expect(
      previewDatabaseTarget({
        DATABASE_URL: "postgres://user:secret@production.example.test/app",
        NEON_PROJECT_ID: "production-neon-project",
        VERCEL_ENV: "production",
      }),
    ).toBeNull();
  });
});
