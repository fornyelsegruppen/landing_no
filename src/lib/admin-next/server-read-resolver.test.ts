import { describe, expect, it } from "vitest";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";

const canonical = { source: "canonical" };
const fixture = { source: "fixture" };

function select(
  moduleId: "today" | "caseWorkspace" | "roofWorkbench" | "fieldVisit",
  environment: Record<string, string | undefined>,
  options: { role?: "admin" | "worker"; audience?: "admin" | "worker"; canonical?: typeof canonical } = {},
) {
  return resolveAdminNextServerRead({
    moduleId,
    rollout: buildAdminNextRolloutView(environment),
    environment,
    role: options.role || "admin",
    audience: options.audience,
    canonical: options.canonical === undefined ? canonical : options.canonical,
    fixture,
  });
}

describe("Admin Next server read resolver", () => {
  it("keeps all-off on the legacy paths", () => {
    for (const moduleId of ["today", "caseWorkspace", "roofWorkbench", "fieldVisit"] as const) {
      expect(select(moduleId, {}).kind).toBe("legacy_fallback");
    }
  });

  it("allows only ready canonical readers in a mixed Preview matrix", () => {
    const environment = {
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
    };
    expect(select("caseWorkspace", environment).kind).toBe("canonical_read");
    expect(select("today", environment).kind).toBe("legacy_fallback");
    expect(select("roofWorkbench", environment).kind).toBe("legacy_fallback");
    expect(select("fieldVisit", environment, { audience: "worker", role: "worker" }).kind).toBe("legacy_fallback");
  });

  it("selects all four canonical readers when every Preview gate is ready", () => {
    const environment = {
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
      FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
      FEATURE_WORKER_PORTAL: "true",
      BLOB_READ_WRITE_TOKEN: "configured",
    };
    expect(select("today", environment).kind).toBe("canonical_read");
    expect(select("caseWorkspace", environment).kind).toBe("canonical_read");
    expect(select("roofWorkbench", environment).kind).toBe("canonical_read");
    expect(select("fieldVisit", environment, { audience: "worker", role: "worker" }).kind).toBe("canonical_read");
  });

  it("falls back to fixtures when the canonical runtime is unavailable", () => {
    const environment = {
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
      BLOB_READ_WRITE_TOKEN: "configured",
    };
    const result = resolveAdminNextServerRead({
      moduleId: "roofWorkbench",
      rollout: buildAdminNextRolloutView(environment),
      environment,
      role: "admin",
      fixture,
    });
    expect(result).toMatchObject({ kind: "fixture_fallback", reason: "canonical_unavailable", adapter: fixture });
  });

  it("denies Production and a worker requesting an admin read model", () => {
    const production = {
      ADMIN_NEXT_MODE: "active",
      ADMIN_NEXT_RELEASE_REFERENCE: "approved",
      VERCEL_ENV: "production",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
    };
    expect(select("caseWorkspace", production)).toMatchObject({ kind: "legacy_fallback", reason: "production_denied" });

    const preview = {
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
    };
    expect(select("caseWorkspace", preview, { role: "worker" })).toMatchObject({ kind: "legacy_fallback", reason: "access_denied" });
  });
});

