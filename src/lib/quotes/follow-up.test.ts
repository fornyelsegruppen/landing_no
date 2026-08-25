import { describe, expect, it, vi } from "vitest";
import { processQuoteFollowUpJob } from "./follow-up";
import { enqueueQuoteFollowUps } from "./follow-up-schedule";

describe("quote follow-up", () => {
  it("creates at most two reminders and one expiry job idempotently", async () => {
    const payload = { find: vi.fn().mockResolvedValue({ docs: [] }), create: vi.fn().mockImplementation(async ({ data }) => ({ id: Math.random(), ...data })) };
    const result = await enqueueQuoteFollowUps(payload as never, { quoteId: 4, leadId: 2, validUntil: "2026-09-10T10:00:00.000Z" }, "corr", new Date("2026-08-25T10:00:00.000Z"));
    expect(result.created).toBe(3);
    expect(payload.create).toHaveBeenCalledTimes(3);
  });

  it("expires an unanswered quote and revokes its draft contract", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 4, status: "viewed", validUntil: "2026-08-25T10:00:00.000Z", lead: 2 }),
      find: vi.fn().mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [{ id: 8, status: "issued" }] }),
      update: vi.fn().mockResolvedValue({ id: 4, status: "expired" }),
    };
    const result = await processQuoteFollowUpJob(payload as never, { quoteId: 4, leadId: 2, kind: "expire", validUntil: "2026-08-25T10:00:00.000Z" }, "corr", new Date("2026-08-25T10:00:01.000Z"));
    expect(result).toMatchObject({ expired: true });
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "quotes", data: { status: "expired" } }));
  });
});
