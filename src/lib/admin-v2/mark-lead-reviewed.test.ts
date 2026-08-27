import { describe, expect, it, vi } from "vitest";
import { markLeadReviewed } from "./mark-lead-reviewed";

function payloadMock(input?: { reviewedAt?: string; revision?: number }) {
  const lead: Record<string, unknown> = {
    id: 10,
    caseRevision: input?.revision ?? 12,
    adminReviewedAt: input?.reviewedAt ?? null,
    adminReviewedBy: null,
  };
  const audits: Array<Record<string, unknown>> = [];
  const payload = {
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "audit-events" ? audits : [],
    })),
    findByID: vi.fn(async () => lead),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(lead, data);
      return lead;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      audits.push(data);
      return { id: audits.length, ...data };
    }),
  };
  return { audits, lead, payload };
}

describe("markLeadReviewed", () => {
  it("uses the central revisioned command and records one durable review", async () => {
    const state = payloadMock();
    const result = await markLeadReviewed(state.payload as never, {
      actorId: 3,
      lead: state.lead,
      leadId: 10,
      now: new Date("2026-08-28T00:00:00.000Z"),
    });

    expect(result).toEqual({
      duplicate: false,
      reviewedAt: "2026-08-28T00:00:00.000Z",
    });
    expect(state.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "leads",
        context: { expectedCaseRevision: 12, trustedCaseCommand: true },
        data: expect.objectContaining({
          adminReviewedAt: "2026-08-28T00:00:00.000Z",
          adminReviewedBy: 3,
          caseRevision: 13,
        }),
        id: 10,
        req: {
          context: { expectedCaseRevision: 12, trustedCaseCommand: true },
          payloadAPI: "local",
        },
      }),
    );
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: "case.mark_reviewed",
      actor: 3,
      changedFields: ["adminReviewedAt", "adminReviewedBy", "caseRevision"],
      entityId: "10",
    });
  });

  it("does not write or duplicate audit evidence when already reviewed", async () => {
    const reviewedAt = "2026-08-27T20:00:00.000Z";
    const state = payloadMock({ reviewedAt });
    const result = await markLeadReviewed(state.payload as never, {
      actorId: 3,
      lead: state.lead,
      leadId: 10,
    });

    expect(result).toEqual({ duplicate: true, reviewedAt });
    expect(state.payload.update).not.toHaveBeenCalled();
    expect(state.payload.create).not.toHaveBeenCalled();
  });

  it("fails closed if the command does not return a persisted timestamp", async () => {
    const state = payloadMock();
    state.payload.update.mockResolvedValueOnce({
      id: 10,
      caseRevision: 13,
      adminReviewedAt: null,
    });

    await expect(
      markLeadReviewed(state.payload as never, {
        actorId: 3,
        lead: state.lead,
        leadId: 10,
      }),
    ).rejects.toThrow("Lead review marker was not persisted");
  });
});
