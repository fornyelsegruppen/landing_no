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

  it("enables reviewed footprint measurement without licensed imagery", () => {
    expect(featureReadiness("roofMeasurement", { FEATURE_ROOF_MEASUREMENT: "true" })).toEqual({
      enabled: true,
      ready: true,
      unavailable: [],
    });
    expect(() => assertFeatureReady("roofMeasurement", {
      FEATURE_ROOF_MEASUREMENT: "true",
    })).not.toThrow();
    expect(readIntegrationStatus({}).imagery.readiness).toBe("configuration_required");
  });

  it("distinguishes disabled from missing configuration", () => {
    expect(() => assertFeatureReady("aiDrafts", {})).toThrowError(
      new FeatureUnavailableError("aiDrafts", "disabled"),
    );
  });

  it("keeps quote viewing separate from the stronger signing gate", () => {
    const quoteEnvironment = {
      FEATURE_CUSTOMER_QUOTES: "true",
      RESEND_API_KEY: "configured",
      LEGAL_REVIEW_REFERENCE: "lawyer-review-2026-08",
    };
    expect(() => assertFeatureReady("customerQuotes", quoteEnvironment)).not.toThrow();
    expect(featureReadiness("contractSigning", {
      ...quoteEnvironment,
      FEATURE_CONTRACT_SIGNING: "true",
    })).toMatchObject({
      enabled: true,
      ready: false,
      unavailable: ["signature"],
    });
  });

  it("allows non-delivering email logs only in an explicitly enabled preview", () => {
    const preview = {
      VERCEL_ENV: "preview",
      ALLOW_PREVIEW_EMAIL_LOG: "true",
      FEATURE_CUSTOMER_QUOTES: "true",
      LEGAL_REVIEW_REFERENCE: "staging-test",
    };
    expect(readIntegrationStatus(preview).email).toMatchObject({ readiness: "ready", provider: "log", missing: [] });
    expect(() => assertFeatureReady("customerQuotes", preview)).not.toThrow();
    expect(readIntegrationStatus({ ...preview, VERCEL_ENV: "production" }).email.readiness).toBe("configuration_required");
  });
});
