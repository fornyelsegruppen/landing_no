import { afterEach, describe, expect, it, vi } from "vitest";
import { processQuoteFollowUpJob } from "./follow-up";
import { enqueueQuoteFollowUps } from "./follow-up-schedule";
import { AutomaticRecipientBlockedError } from "@/lib/messages/automation-recipient-policy";

describe("quote follow-up", () => {
  afterEach(() => {
    delete process.env.FEATURE_COMMUNICATION_ROUTING_V2;
    delete process.env.RESEND_API_KEY;
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL_ENV;
    delete process.env.AUTOMATION_EMERGENCY_PAUSE;
    delete process.env.AUTOMATION_RECIPIENT_ALLOWLIST;
  });

  it("keeps automatic follow-ups paused by default in Production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.FEATURE_COMMUNICATION_ROUTING_V2 = "true";
    process.env.RESEND_API_KEY = "test";
    process.env.CRON_SECRET = "test";
    const payload = { find: vi.fn(), create: vi.fn() };

    const result = await enqueueQuoteFollowUps(
      payload as never,
      { quoteId: 4, leadId: 2, validUntil: "2026-09-10T10:00:00.000Z" },
      "corr",
      new Date("2026-08-25T10:00:00.000Z"),
    );

    expect(result).toMatchObject({ skipped: true, created: 0 });
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("creates at most two reminders and one expiry job idempotently", async () => {
    process.env.FEATURE_COMMUNICATION_ROUTING_V2 = "true";
    process.env.RESEND_API_KEY = "test";
    process.env.CRON_SECRET = "test";
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: Math.random(),
        ...data,
      })),
    };
    const result = await enqueueQuoteFollowUps(
      payload as never,
      { quoteId: 4, leadId: 2, validUntil: "2026-09-10T10:00:00.000Z" },
      "corr",
      new Date("2026-08-25T10:00:00.000Z"),
    );
    expect(result.created).toBe(3);
    expect(payload.create).toHaveBeenCalledTimes(3);
  });

  it("expires an unanswered quote and revokes its draft contract", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 4,
        status: "viewed",
        validUntil: "2026-08-25T10:00:00.000Z",
        lead: 2,
      }),
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [{ id: 8, status: "issued" }] }),
      update: vi.fn().mockResolvedValue({ id: 4, status: "expired" }),
    };
    const result = await processQuoteFollowUpJob(
      payload as never,
      {
        quoteId: 4,
        leadId: 2,
        kind: "expire",
        validUntil: "2026-08-25T10:00:00.000Z",
      },
      "corr",
      new Date("2026-08-25T10:00:01.000Z"),
    );
    expect(result).toMatchObject({ expired: true });
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "quotes",
        data: { status: "expired" },
      }),
    );
  });

  it("blocks a non-allowlisted automatic follow-up before provider delivery", async () => {
    process.env.AUTOMATION_RECIPIENT_ALLOWLIST = "pilot@example.no";
    const payload = {
      findByID: vi
        .fn()
        .mockResolvedValueOnce({
          id: 4,
          status: "sent",
          validUntil: "2026-09-10T10:00:00.000Z",
          version: 1,
        })
        .mockResolvedValueOnce({
          id: 2,
          name: "Kunde",
          email: "customer@example.no",
        }),
    };

    await expect(
      processQuoteFollowUpJob(
        payload as never,
        {
          quoteId: 4,
          leadId: 2,
          kind: "reminder_1",
          validUntil: "2026-09-10T10:00:00.000Z",
        },
        "corr-allowlist",
        new Date("2026-09-01T10:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(AutomaticRecipientBlockedError);
    expect(payload.findByID).toHaveBeenCalledTimes(2);
  });
});
