import { describe, expect, it } from "vitest";
import type { Payload } from "payload";
import {
  assertAutomaticMessageRecipientAllowed,
  assertControlledPilotAutomationRecipientAllowed,
  assertMessageDeliveryClass,
  AutomaticRecipientBlockedError,
  automationRecipientAllowlist,
  messageDeliveryClass,
  MessageDeliveryClassRequiredError,
  messageRequiresAutomationRecipientPolicy,
} from "./automation-recipient-policy";

describe("controlled-pilot automation recipient policy", () => {
  it("normalizes a comma-separated allowlist and fails closed when it is empty", () => {
    expect([
      ...automationRecipientAllowlist({
        AUTOMATION_RECIPIENT_ALLOWLIST:
          " Owner@Example.no,qa@example.no, invalid ",
      }),
    ]).toEqual(["owner@example.no", "qa@example.no"]);

    expect(() =>
      assertControlledPilotAutomationRecipientAllowed("owner@example.no", {}),
    ).toThrow(AutomaticRecipientBlockedError);
  });

  it("allows only normalized allowlisted recipients during the controlled pilot", () => {
    const environment = {
      AUTOMATION_RECIPIENT_ALLOWLIST: "OWNER@example.no",
    };
    expect(() =>
      assertControlledPilotAutomationRecipientAllowed(
        " owner@EXAMPLE.no ",
        environment,
      ),
    ).not.toThrow();
    expect(() =>
      assertControlledPilotAutomationRecipientAllowed(
        "customer@example.no",
        environment,
      ),
    ).toThrow(AutomaticRecipientBlockedError);
  });

  it("does not constrain delivery after the real full-automation evidence gate", () => {
    expect(() =>
      assertControlledPilotAutomationRecipientAllowed("customer@example.no", {
        PLATFORM_OPERATING_MODE: "full_automation",
        LEAD_INBOX_PILOT_REFERENCE: "lead-pilot",
        ROOF_VALIDATION_REFERENCE: "roof-validation",
      }),
    ).not.toThrow();
  });

  it("parses and distinguishes explicit delivery authorization classes", async () => {
    const automatic = {
      lead: 7,
      aiAnalysis: { workOrderId: 9, communicationKind: "same_day" },
    };
    const approved = {
      lead: 7,
      aiAnalysis: {
        workOrderId: 9,
        communicationKind: "schedule_confirmation",
        adminApprovedTransactional: true,
      },
    };
    expect(messageDeliveryClass({ deliveryClass: "automation" })).toBe(
      "automation",
    );
    expect(messageDeliveryClass({ deliveryClass: "admin_approved" })).toBe(
      "admin_approved",
    );
    expect(messageDeliveryClass({ deliveryClass: "customer_initiated" })).toBe(
      "customer_initiated",
    );
    expect(messageDeliveryClass({})).toBeNull();
    expect(messageDeliveryClass({ deliveryClass: "unknown" })).toBeNull();
    expect(() => assertMessageDeliveryClass("unknown")).toThrow(
      MessageDeliveryClassRequiredError,
    );
    expect(messageRequiresAutomationRecipientPolicy("automation")).toBe(true);
    expect(messageRequiresAutomationRecipientPolicy("admin_approved")).toBe(
      false,
    );
    expect(messageRequiresAutomationRecipientPolicy("customer_initiated")).toBe(
      false,
    );

    const findByID = async () => ({
      communicationEmail: "pilot@example.no",
      email: "original@example.no",
    });
    const payload = { findByID } as unknown as Payload;
    await expect(
      assertAutomaticMessageRecipientAllowed(payload, automatic, "automation", {
        AUTOMATION_RECIPIENT_ALLOWLIST: "PILOT@example.no",
      }),
    ).resolves.toBeUndefined();
    await expect(
      assertAutomaticMessageRecipientAllowed(payload, automatic, "automation", {
        AUTOMATION_RECIPIENT_ALLOWLIST: "other@example.no",
      }),
    ).rejects.toBeInstanceOf(AutomaticRecipientBlockedError);
    await expect(
      assertAutomaticMessageRecipientAllowed(
        payload,
        approved,
        "admin_approved",
        {},
      ),
    ).resolves.toBeUndefined();
  });
});
