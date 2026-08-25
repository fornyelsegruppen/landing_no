import { describe, expect, it } from "vitest";
import { bareEmail, caseReplyAddress, leadIdFromCaseReply } from "./case-reply";

const env = { RESEND_INBOUND_DOMAIN: "inbound.example.no", CUSTOMER_TOKEN_SECRET: "s".repeat(40) };

describe("case reply routing", () => {
  it("round-trips a signed case alias", () => {
    const address = caseReplyAddress(42, env)!;
    expect(leadIdFromCaseReply([address], env)).toBe(42);
    expect(leadIdFromCaseReply([address.replace("sak-42", "sak-41")], env)).toBeNull();
  });

  it("normalizes display-name sender addresses", () => {
    expect(bareEmail("Ola Nordmann <OLA@example.no>")).toBe("ola@example.no");
  });
});
