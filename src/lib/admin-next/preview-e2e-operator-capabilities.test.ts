import { describe, expect, it } from "vitest";
import { resolvePreviewE2eOperatorCapabilities } from "./preview-e2e-operator-capabilities";

const previewAdmin = {
  role: "admin" as const,
  environment: {
    FEATURE_CASE_STATE_ENGINE_V2: "true",
    PREVIEW_E2E_OPERATOR_ACCESS: "true",
    VERCEL_ENV: "preview",
  },
};

describe("Preview E2E operator capabilities", () => {
  it("is disabled unless the explicit access flag is exactly true", () => {
    expect(
      resolvePreviewE2eOperatorCapabilities({
        ...previewAdmin,
        environment: {
          ...previewAdmin.environment,
          PREVIEW_E2E_OPERATOR_ACCESS: "1",
        },
      }),
    ).toEqual([]);
  });

  it("never grants capabilities in Production", () => {
    expect(
      resolvePreviewE2eOperatorCapabilities({
        ...previewAdmin,
        environment: {
          ...previewAdmin.environment,
          VERCEL_ENV: "production",
        },
      }),
    ).toEqual([]);
  });

  it("never grants Preview E2E capabilities to a worker", () => {
    expect(
      resolvePreviewE2eOperatorCapabilities({
        ...previewAdmin,
        role: "worker",
      }),
    ).toEqual([]);
  });

  it("keeps manual drafting available while AI and sending stay independently gated", () => {
    expect(
      resolvePreviewE2eOperatorCapabilities({
        ...previewAdmin,
        environment: {
          ...previewAdmin.environment,
          FEATURE_AI_DRAFTS: "true",
        },
      }),
    ).toEqual([
      "case.read",
      "case.reply.prepare",
      "case.question.reply.prepare",
    ]);

    const capabilities = resolvePreviewE2eOperatorCapabilities({
      ...previewAdmin,
      environment: {
        ...previewAdmin.environment,
        CRON_SECRET: "preview-cron",
        FEATURE_AI_DRAFTS: "true",
        FEATURE_COMMUNICATION_ROUTING_V2: "true",
        GEMINI_API_KEY: "preview-gemini",
        RESEND_API_KEY: "preview-resend",
      },
    });

    expect(capabilities).toEqual([
      "case.read",
      "case.reply.prepare",
      "case.question.reply.prepare",
    ]);
  });

  it("grants an admin only the capabilities backed by ready Preview features", () => {
    const capabilities = resolvePreviewE2eOperatorCapabilities({
      ...previewAdmin,
      environment: {
        ...previewAdmin.environment,
        CRON_SECRET: "preview-cron",
        FEATURE_AI_DRAFTS: "true",
        FEATURE_COMMUNICATION_ROUTING_V2: "true",
        FEATURE_CUSTOMER_QUOTES: "true",
        FEATURE_ROOF_MEASUREMENT: "true",
        GEMINI_API_KEY: "preview-gemini",
        LEGAL_REVIEW_REFERENCE: "LEGAL-PREVIEW-1",
        PREVIEW_EMAIL_RECIPIENT_ALLOWLIST: "fornyelsegruppen@gmail.com",
        RESEND_API_KEY: "preview-resend",
      },
    });

    expect(capabilities).toEqual([
      "case.read",
      "case.reply.prepare",
      "case.question.reply.prepare",
      "message.approve_send",
      "message.retry_send",
      "commercial.package.prepare",
      "price.calculate",
      "quote.create",
      "quote.approve",
      "quote.issue",
      "quote.read",
    ]);
  });

  it("withholds every send capability until the exact Preview recipient policy is configured", () => {
    const environment = {
      ...previewAdmin.environment,
      CRON_SECRET: "preview-cron",
      FEATURE_COMMUNICATION_ROUTING_V2: "true",
      FEATURE_CONTRACT_SIGNING: "true",
      FEATURE_CUSTOMER_LIFECYCLE_V2: "true",
      FEATURE_CUSTOMER_QUOTES: "true",
      FEATURE_ROOF_MEASUREMENT: "true",
      LEGAL_REVIEW_REFERENCE: "LEGAL-PREVIEW-1",
      PAYLOAD_SECRET: "preview-signature-secret",
      RESEND_API_KEY: "preview-resend",
    };
    const sendCapabilities = [
      "message.approve_send",
      "message.retry_send",
      "message.closure.approve_send",
      "commercial.package.approve_send",
    ] as const;

    const withoutPolicy = resolvePreviewE2eOperatorCapabilities({
      ...previewAdmin,
      environment,
    });
    for (const capability of sendCapabilities) {
      expect(withoutPolicy).not.toContain(capability);
    }

    const withPolicy = resolvePreviewE2eOperatorCapabilities({
      ...previewAdmin,
      environment: {
        ...environment,
        PREVIEW_EMAIL_RECIPIENT_ALLOWLIST: "fornyelsegruppen@gmail.com",
      },
    });
    for (const capability of sendCapabilities) {
      expect(withPolicy).toContain(capability);
    }
  });

  it("projects route-exact candidate CTAs while inbound routing and security rollout stay off", () => {
    const capabilities = resolvePreviewE2eOperatorCapabilities({
      ...previewAdmin,
      environment: {
        ...previewAdmin.environment,
        FEATURE_COMMUNICATION_ROUTING_V2: "false",
        FEATURE_CONTRACT_SIGNING: "true",
        FEATURE_CUSTOMER_QUOTES: "true",
        FEATURE_ROOF_MEASUREMENT: "false",
        FEATURE_SECURITY_HARDENING_V2: "false",
        LEGAL_REVIEW_REFERENCE: "LEGAL-PREVIEW-1",
        PAYLOAD_SECRET: "preview-signature-secret",
        PREVIEW_EMAIL_RECIPIENT_ALLOWLIST: "fornyelsegruppen@gmail.com",
        RESEND_API_KEY: "preview-resend",
      },
    });

    expect(capabilities).toEqual(
      expect.arrayContaining([
        "message.approve_send",
        "message.retry_send",
        "commercial.package.approve_send",
        "contract.company_sign",
      ]),
    );
    expect(capabilities).not.toContain("commercial.package.prepare");
  });
});
