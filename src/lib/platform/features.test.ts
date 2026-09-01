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
      roofFusionV1: false,
      customerQuotes: false,
      contractSigning: false,
      workerPortal: false,
      automatedReminders: false,
      seoScheduler: false,
      caseStateEngineV2: false,
      measurementEvidenceV2: false,
      adminExceptionFlowsV2: false,
      communicationRoutingV2: false,
      customerLifecycleV2: false,
      securityHardeningV2: false,
    });
  });

  it("reports missing configuration without exposing values", () => {
    expect(readIntegrationStatus({}).ai).toEqual({
      name: "ai",
      readiness: "configuration_required",
      provider: "fake",
      missing: ["GEMINI_API_KEY"],
    });
    expect(readIntegrationStatus({}).rateLimit.missing).toEqual([
      "UPSTASH_REDIS_REST_URL or KV_REST_API_URL",
      "UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN",
    ]);
    expect(readIntegrationStatus({}).botProtection.missing).toEqual([
      "TURNSTILE_SECRET_KEY",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ]);
    expect(readIntegrationStatus({}).privateStorage.missing).toEqual([
      "BLOB_READ_WRITE_TOKEN",
    ]);
    expect(readIntegrationStatus({}).stockImages).toEqual({
      name: "stockImages",
      readiness: "configuration_required",
      provider: "pexels",
      missing: ["PEXELS_API_KEY"],
    });
  });

  it("does not consider an enabled feature ready without dependencies", () => {
    expect(
      featureReadiness("seoScheduler", { FEATURE_SEO_SCHEDULER: "true" }),
    ).toEqual({
      enabled: true,
      ready: false,
      unavailable: ["ai", "jobs", "stockImages"],
    });
  });

  it("allows a fully configured feature", () => {
    const environment = {
      FEATURE_SEO_SCHEDULER: "1",
      GEMINI_API_KEY: "configured",
      CRON_SECRET: "configured",
      PEXELS_API_KEY: "configured",
    };

    expect(() => assertFeatureReady("seoScheduler", environment)).not.toThrow();
  });

  it("enables reviewed footprint measurement without licensed imagery", () => {
    expect(
      featureReadiness("roofMeasurement", { FEATURE_ROOF_MEASUREMENT: "true" }),
    ).toEqual({
      enabled: true,
      ready: true,
      unavailable: [],
    });
    expect(() =>
      assertFeatureReady("roofMeasurement", {
        FEATURE_ROOF_MEASUREMENT: "true",
      }),
    ).not.toThrow();
    expect(readIntegrationStatus({}).imagery.readiness).toBe(
      "configuration_required",
    );
  });

  it("keeps Roof Fusion independent from every legacy roof flag", () => {
    expect(
      featureReadiness("roofFusionV1", {
        FEATURE_ROOF_MEASUREMENT: "true",
        FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
        BLOB_READ_WRITE_TOKEN: "configured",
      }),
    ).toEqual({ enabled: false, ready: false, unavailable: [] });
    expect(
      featureReadiness("roofFusionV1", { FEATURE_ROOF_FUSION_V1: "true" }),
    ).toEqual({ enabled: true, ready: true, unavailable: [] });
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
    expect(() =>
      assertFeatureReady("customerQuotes", quoteEnvironment),
    ).not.toThrow();
    expect(
      featureReadiness("contractSigning", {
        ...quoteEnvironment,
        FEATURE_CONTRACT_SIGNING: "true",
      }),
    ).toMatchObject({
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
    expect(readIntegrationStatus(preview).email).toMatchObject({
      readiness: "ready",
      provider: "log",
      missing: [],
    });
    expect(() => assertFeatureReady("customerQuotes", preview)).not.toThrow();
    expect(
      readIntegrationStatus({ ...preview, VERCEL_ENV: "production" }).email
        .readiness,
    ).toBe("configuration_required");
  });

  it("keeps every remediation capability independently reversible", () => {
    const flags = readFeatureFlags({
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_MEASUREMENT_EVIDENCE_V2: "1",
    });

    expect(flags.caseStateEngineV2).toBe(true);
    expect(flags.measurementEvidenceV2).toBe(true);
    expect(flags.adminExceptionFlowsV2).toBe(false);
    expect(flags.communicationRoutingV2).toBe(false);
    expect(flags.customerLifecycleV2).toBe(false);
    expect(flags.securityHardeningV2).toBe(false);
  });

  it("requires private storage before immutable measurement evidence is ready", () => {
    expect(
      featureReadiness("measurementEvidenceV2", {
        FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
      }),
    ).toEqual({
      enabled: true,
      ready: false,
      unavailable: ["privateStorage"],
    });
    expect(
      featureReadiness("measurementEvidenceV2", {
        FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
        BLOB_READ_WRITE_TOKEN: "configured",
      }),
    ).toMatchObject({ ready: true, unavailable: [] });
  });

  it("requires distributed abuse controls and private storage before security rollout", () => {
    expect(
      featureReadiness("securityHardeningV2", {
        FEATURE_SECURITY_HARDENING_V2: "true",
        PAYLOAD_SECRET: "configured",
      }),
    ).toEqual({
      enabled: true,
      ready: false,
      unavailable: ["rateLimit", "botProtection", "privateStorage"],
    });

    expect(() =>
      assertFeatureReady("securityHardeningV2", {
        FEATURE_SECURITY_HARDENING_V2: "true",
        PAYLOAD_SECRET: "configured",
        UPSTASH_REDIS_REST_URL: "configured",
        UPSTASH_REDIS_REST_TOKEN: "configured",
        TURNSTILE_SECRET_KEY: "configured",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "configured",
        BLOB_READ_WRITE_TOKEN: "configured",
      }),
    ).not.toThrow();
    expect(
      readIntegrationStatus({
        KV_REST_API_URL: "configured",
        KV_REST_API_TOKEN: "configured",
      }).rateLimit,
    ).toMatchObject({ readiness: "ready", missing: [] });
  });
});
