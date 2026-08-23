import { describe, expect, it } from "vitest";
import {
  assertFeatureReady,
  FeatureUnavailableError,
  featureReadiness,
  readFeatureFlags,
  readIntegrationStatus,
} from "./features";

describe("platform feature configuration", () => {
  it("keeps every risky feature disabled by default", () => {
    expect(readFeatureFlags({})).toEqual({
      aiDrafts: false,
      roofMeasurement: false,
      customerQuotes: false,
      contractSigning: false,
      workerPortal: false,
      automatedReminders: false,
      seoScheduler: false,
    });
  });

  it("reports missing configuration without exposing values", () => {
    expect(readIntegrationStatus({}).ai).toEqual({
      name: "ai",
      readiness: "configuration_required",
      provider: "fake",
      missing: ["GEMINI_API_KEY"],
    });
  });

  it("does not consider an enabled feature ready without dependencies", () => {
    expect(
      featureReadiness("seoScheduler", { FEATURE_SEO_SCHEDULER: "true" }),
    ).toEqual({
      enabled: true,
      ready: false,
      unavailable: ["ai", "jobs"],
    });
  });

  it("allows a fully configured feature", () => {
    const environment = {
      FEATURE_SEO_SCHEDULER: "1",
      GEMINI_API_KEY: "configured",
      CRON_SECRET: "configured",
    };

    expect(() => assertFeatureReady("seoScheduler", environment)).not.toThrow();
  });

  it("does not enable automatic roof measurement without licensed imagery access", () => {
    expect(featureReadiness("roofMeasurement", { FEATURE_ROOF_MEASUREMENT: "true" })).toEqual({
      enabled: true,
      ready: false,
      unavailable: ["imagery"],
    });
    expect(() => assertFeatureReady("roofMeasurement", {
      FEATURE_ROOF_MEASUREMENT: "true",
      NORGE_I_BILDER_TOKEN: "configured",
      MAP_TERMS_ACCEPTED_AT: "2026-08-23T00:00:00Z",
    })).not.toThrow();
  });

  it("distinguishes disabled from missing configuration", () => {
    expect(() => assertFeatureReady("aiDrafts", {})).toThrowError(
      new FeatureUnavailableError("aiDrafts", "disabled"),
    );
  });
});
