import { describe, expect, it, vi } from "vitest";
import { caseReplyAddress } from "./case-reply";
import { applyResendInboundEmail } from "./resend-inbound";

const env = { RESEND_INBOUND_DOMAIN: "inbound.example.no", CUSTOMER_TOKEN_SECRET: "s".repeat(40) };

describe("Resend inbound email", () => {
  it("binds a signed reply only to the matching customer", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 7, email: "ola@example.no", status: "waiting_customer", revision: 1 }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 20 }),
      update: vi.fn().mockResolvedValue({ id: 7, revision: 2 }),
    };
    const result = await applyResendInboundEmail(payload as never, { email_id: "in-1", from: "Ola <ola@example.no>", to: [caseReplyAddress(7, env)!], subject: "Re: tilbud" }, vi.fn(async () => ({ text: "Kan dere forklare garantien?" })), "corr", env);
    expect(result).toMatchObject({ matched: true, leadId: 7 });
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: "messages", data: expect.objectContaining({ direction: "inbound", status: "delivered" }) }));
  });

  it("does not attach a forged sender to the case", async () => {
    const payload = { findByID: vi.fn().mockResolvedValue({ id: 7, email: "ola@example.no" }) };
    await expect(applyResendInboundEmail(payload as never, { email_id: "in-2", from: "other@example.no", to: [caseReplyAddress(7, env)!] }, vi.fn(), "corr", env)).resolves.toMatchObject({ matched: false, reason: "sender-mismatch" });
  });
});
