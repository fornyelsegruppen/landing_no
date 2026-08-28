import { afterEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  assertPayloadAiUsageAvailable,
  reserveCustomerReplyAiRequest,
} from "./payload-usage-limit";

afterEach(() => {
  delete process.env.GEMINI_DAILY_REQUEST_LIMIT;
  delete process.env.GEMINI_MONTHLY_REQUEST_LIMIT;
});

function payloadWithCounts(blog: number, leads: number, customerReplies = 0) {
  return {
    count: vi.fn(async ({ collection }: { collection: string }) => ({
      totalDocs:
        collection === "seo-runs"
          ? blog
          : collection === "audit-events"
            ? customerReplies
            : leads,
    })),
  } as unknown as Payload;
}

function payloadWithReservableCustomerUsage() {
  let customerReplies = 0;
  const create = vi.fn(
    async ({ collection }: { collection: string; data: unknown }) => {
      if (collection !== "audit-events") throw new Error("unexpected create");
      customerReplies += 1;
      return { id: customerReplies };
    },
  );
  const payload = {
    count: vi.fn(async ({ collection }: { collection: string }) => ({
      totalDocs: collection === "audit-events" ? customerReplies : 0,
    })),
    create,
  } as unknown as Payload;
  return { create, payload };
}

describe("combined Gemini usage limits", () => {
  it("reserves a call before a blog run", async () => {
    process.env.GEMINI_DAILY_REQUEST_LIMIT = "3";
    await expect(
      assertPayloadAiUsageAvailable(payloadWithCounts(2, 1), {
        reserve: 1,
        now: new Date("2026-08-23T12:00:00Z"),
      }),
    ).rejects.toThrow(/daily/);
  });

  it("allows configured capacity and enforces the monthly ceiling", async () => {
    process.env.GEMINI_DAILY_REQUEST_LIMIT = "20";
    process.env.GEMINI_MONTHLY_REQUEST_LIMIT = "5";
    await expect(
      assertPayloadAiUsageAvailable(payloadWithCounts(1, 1), { reserve: 1 }),
    ).resolves.toMatchObject({ daily: 2 });
    await expect(
      assertPayloadAiUsageAvailable(payloadWithCounts(3, 2), { reserve: 1 }),
    ).rejects.toThrow(/monthly/);
  });

  it("records and enforces each customer-reply Gemini request exactly once", async () => {
    process.env.GEMINI_DAILY_REQUEST_LIMIT = "2";
    process.env.GEMINI_MONTHLY_REQUEST_LIMIT = "2";
    const state = payloadWithReservableCustomerUsage();
    const input = {
      attempt: 1,
      correlationId: "customer-reply-attempt-1",
      sourceMessageId: 44,
    };

    await expect(
      reserveCustomerReplyAiRequest(state.payload, input),
    ).resolves.toMatchObject({ reserved: 1 });
    await expect(
      reserveCustomerReplyAiRequest(state.payload, {
        ...input,
        attempt: 2,
        correlationId: "customer-reply-attempt-2",
      }),
    ).resolves.toMatchObject({ reserved: 1 });
    await expect(
      reserveCustomerReplyAiRequest(state.payload, {
        ...input,
        attempt: 3,
        correlationId: "customer-reply-attempt-3",
      }),
    ).rejects.toThrow(/daily/);

    expect(state.create).toHaveBeenCalledTimes(2);
    expect(state.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: "audit-events",
        data: expect.objectContaining({
          action: "ai.customer-reply.request",
          correlationId: "customer-reply-attempt-2",
          metadata: expect.objectContaining({ attempt: 2 }),
        }),
      }),
    );
  });

  it("includes recorded customer-reply calls in combined limits", async () => {
    process.env.GEMINI_DAILY_REQUEST_LIMIT = "4";
    await expect(
      assertPayloadAiUsageAvailable(payloadWithCounts(1, 1, 2), {
        reserve: 1,
      }),
    ).rejects.toThrow(/daily/);
  });
});
