import { describe, expect, it } from "vitest";
import { buildReleaseGate } from "./release-gate";

const completeEnvironment = {
  FEATURE_AI_DRAFTS: "true",
  FEATURE_ROOF_MEASUREMENT: "true",
  FEATURE_CUSTOMER_QUOTES: "true",
  FEATURE_CONTRACT_SIGNING: "true",
  FEATURE_WORKER_PORTAL: "true",
  FEATURE_AUTOMATED_REMINDERS: "true",
  FEATURE_SEO_SCHEDULER: "true",
  FEATURE_CASE_STATE_ENGINE_V2: "true",
  FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
  FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
  FEATURE_COMMUNICATION_ROUTING_V2: "true",
  FEATURE_CUSTOMER_LIFECYCLE_V2: "true",
  FEATURE_SECURITY_HARDENING_V2: "true",
  GEMINI_API_KEY: "secret-gemini",
  RESEND_API_KEY: "secret-resend",
  NORGE_I_BILDER_TOKEN: "secret-map",
  MAP_TERMS_ACCEPTED_AT: "2026-08-23T00:00:00Z",
  CUSTOMER_TOKEN_SECRET: "secret-customer",
  LEGAL_REVIEW_REFERENCE: "LEGAL-1",
  GOOGLE_SEARCH_CONSOLE_CREDENTIALS: "secret-search",
  CRON_SECRET: "secret-cron",
  UPSTASH_REDIS_REST_URL: "https://example.invalid",
  UPSTASH_REDIS_REST_TOKEN: "secret-upstash",
  TURNSTILE_SECRET_KEY: "secret-turnstile",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-turnstile",
  BLOB_READ_WRITE_TOKEN: "secret-blob",
  STAGING_QA_REFERENCE: "QA-1",
  RESTORE_TEST_REFERENCE: "RESTORE-1",
  LEAD_INBOX_PILOT_REFERENCE: "PILOT-1",
  PRODUCTION_OWNER_APPROVAL_REFERENCE: "OWNER-1",
  AI_CONTENT_PILOT_REFERENCE: "AI-1",
  ROOF_VALIDATION_REFERENCE: "ROOF-1",
  PRICING_APPROVAL_REFERENCE: "PRICE-1",
  QUOTE_JOURNEY_QA_REFERENCE: "QUOTE-1",
  SIGNATURE_APPROVAL_REFERENCE: "SIGN-1",
  CONTRACT_JOURNEY_QA_REFERENCE: "CONTRACT-1",
  WORKER_MOBILE_QA_REFERENCE: "WORKER-1",
  COMMUNICATION_APPROVAL_REFERENCE: "COMMS-1",
  SEO_PILOT_REFERENCE: "SEO-1",
  STATE_INVARIANT_QA_REFERENCE: "STATE-1",
  ROOF_EVIDENCE_QA_REFERENCE: "EVIDENCE-1",
  ADMIN_OPERATIONS_QA_REFERENCE: "ADMIN-1",
  COMMUNICATION_V2_QA_REFERENCE: "COMMS-V2-1",
  CUSTOMER_LIFECYCLE_QA_REFERENCE: "LIFECYCLE-1",
  SECURITY_HARDENING_QA_REFERENCE: "SECURITY-1",
};

describe("production release gate", () => {
  it("keeps every risky feature safely disabled by default", () => {
    const gate = buildReleaseGate({});
    expect(gate.productionReady).toBe(false);
    expect(gate.counts).toEqual({ go: 0, noGo: 0, disabled: 13 });
  });

  it("returns go only when integrations and named evidence are complete", () => {
    const gate = buildReleaseGate(completeEnvironment);
    expect(gate.productionReady).toBe(true);
    expect(gate.counts).toEqual({ go: 13, noGo: 0, disabled: 0 });
  });

  it("blocks an enabled feature when staging evidence is missing without exposing values", () => {
    const environment = { ...completeEnvironment, WORKER_MOBILE_QA_REFERENCE: "" };
    const gate = buildReleaseGate(environment);
    expect(gate.features.workerPortal).toMatchObject({ status: "no_go", missingEvidence: ["WORKER_MOBILE_QA_REFERENCE"] });
    const serialized = JSON.stringify(gate);
    expect(serialized).not.toContain("secret-gemini");
    expect(serialized).not.toContain("secret-resend");
  });
});
