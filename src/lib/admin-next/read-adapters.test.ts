import { describe, expect, it, vi } from "vitest";
import type { AdminCaseWorkspace } from "@/lib/admin-v2/case-read-model";
import { projectAdminCaseWorkspace } from "@/lib/admin-next/case-read-adapter";
import { createAdminNextCanonicalTodayAdapter } from "@/lib/admin-next/today-read-adapter";

describe("Admin Next canonical read projections", () => {
  it("projects canonical Admin V2 queues into the Today contract", async () => {
    const find = vi.fn().mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === "quotes"
        ? [{ id: 2, reference: "Q-2", status: "draft", lead: { id: 12, name: "Ola Kunde" }, createdAt: "2026-09-01T08:30:00.000Z" }]
        : collection === "work-orders"
          ? [{ id: 3, reference: "WV-3", status: "scheduled", lead: { id: 12, name: "Ola Kunde" }, assignedWorker: { displayName: "Marius" }, scheduledAt: "2026-09-01T10:00:00.000Z", arrivalWindow: "12:00–14:00" }]
          : [],
      totalDocs: 0,
    }));
    const result = await createAdminNextCanonicalTodayAdapter({ find } as never, "Marius").load();
    expect(result.source).toBe("canonical");
    expect(new Set(result.value.map(({ stage }) => stage))).toEqual(new Set(["offer", "measurement", "visit"]));
    expect(result.value.some(({ ownedByCurrentUser }) => ownedByCurrentUser)).toBe(true);
  });

  it("projects the established Admin V2 case workspace without inventing Roof Fusion geometry", () => {
    const source = {
      lead: {
        id: 12,
        name: "Ola Kunde",
        address: "Testveien 4",
        postal: "0123",
        city: "Oslo",
        nextActionOverdue: false,
        nextActionOwner: "administrator",
        recordState: "active",
        revision: 1,
      },
      nextAction: { kind: "approve_measurement" },
      measurement: { id: 8, reference: "R3-8", status: "review_required", href: "/admin/collections/roof-measurements/8" },
      quote: undefined,
      contract: undefined,
      workOrder: undefined,
      documents: [],
      timeline: [],
    } as unknown as AdminCaseWorkspace;
    const value = projectAdminCaseWorkspace(source, new Date("2026-09-01T08:00:00.000Z"));
    expect(value).toMatchObject({ reference: "TF-12", customer: "Ola Kunde", nextAction: { title: "Godkjenn takmålingen" } });
    expect(value.measurementReview).toBeUndefined();
  });
});
