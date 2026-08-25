import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  loadAdminDashboard,
  loadAdminQueue,
  normalizeAdminSearchTerm,
  parseAdminQueue,
  searchAdminRecords,
} from "./dashboard";

describe("admin v2 dashboard", () => {
  it("normalizes and limits user search input", () => {
    expect(normalizeAdminSearchTerm("  Ola   Nordmann  ")).toBe("Ola Nordmann");
    expect(normalizeAdminSearchTerm("x".repeat(120))).toHaveLength(80);
    expect(normalizeAdminSearchTerm(["invalid"])).toBe("");
  });

  it("accepts only known queue keys", () => {
    expect(parseAdminQueue("new-leads")).toBe("new-leads");
    expect(parseAdminQueue("signed-without-work")).toBe("signed-without-work");
    expect(parseAdminQueue("needs-scheduling")).toBe("needs-scheduling");
    expect(parseAdminQueue("completion-review")).toBe("completion-review");
    expect(parseAdminQueue("../../admin")).toBeNull();
    expect(parseAdminQueue(undefined)).toBeNull();
  });

  it("loads deterministic dashboard counts", async () => {
    const totals = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61];
    const count = vi.fn().mockImplementation(async () => ({ totalDocs: totals.shift() }));
    const find = vi.fn().mockImplementation(async (input: { collection: string }) => {
      if (input.collection === "contracts") return { docs: [{ id: 101 }, { id: 102 }] };
      if (input.collection === "work-orders") return { docs: [{ id: 201, contract: 101 }] };
      return { docs: [] };
    });
    const result = await loadAdminDashboard(
      { count, find } as unknown as Pick<Payload, "count" | "find">,
      new Date("2026-08-24T08:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      counts: {
        newLeads: 2,
        aiDrafts: 3,
        replyDrafts: 5,
        attention: 119,
        activeWork: 31,
        unassignedWork: 37,
        needsScheduling: 41,
        completionReview: 43,
        pendingQuotes: 47,
        pendingContracts: 53,
        changeAgreements: 59,
        upcomingWork: 61,
        signedWithoutWork: 1,
      },
    });
    expect(count).toHaveBeenCalledTimes(18);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it("does not disguise database failures as zero counts", async () => {
    const count = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const find = vi.fn();
    await expect(loadAdminDashboard({ count, find } as unknown as Pick<Payload, "count" | "find">)).resolves.toEqual({
      ok: false,
      counts: null,
    });
  });

  it("keeps final contracts visible until a work order exists", async () => {
    const find = vi.fn().mockImplementation(async (input: { collection: string }) => {
      if (input.collection === "contracts") {
        return { docs: [
          { id: 11, reference: "K-11", status: "signed", companySignedAt: "2026-08-25T08:00:00.000Z", quote: { lead: 91 } },
          { id: 12, reference: "K-12", status: "signed", companySignedAt: "2026-08-25T08:05:00.000Z", quote: { lead: 92 } },
        ] };
      }
      return { docs: [{ id: 31, contract: 11 }] };
    });

    const result = await loadAdminQueue(
      { find } as unknown as Pick<Payload, "find">,
      "signed-without-work",
    );

    expect(result).toEqual([
      expect.objectContaining({ reference: "K-12", href: "/admin-v2/cases/92", status: "fully_signed" }),
    ]);
  });

  it.each([
    ["unassigned-work", "unassigned"],
    ["needs-scheduling", "assigned"],
    ["completion-review", "completed"],
  ] as const)("loads the %s queue from its exact operational state", async (queue, status) => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 5, reference: "A-5", status, lead: 15 }] });

    const result = await loadAdminQueue(
      { find } as unknown as Pick<Payload, "find">,
      queue,
    );

    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "work-orders",
      where: queue === "completion-review"
        ? { and: [{ "lead.recordState": { equals: "active" } }, { status: { equals: status } }, { documentationSubmittedAt: { exists: true } }] }
        : { and: [{ "lead.recordState": { equals: "active" } }, { status: { equals: status } }] },
    }));
    expect(result[0]).toEqual(expect.objectContaining({ href: "/admin-v2/cases/15", status }));
  });

  it("keeps active work separate from assignment and completion queues", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] });

    await loadAdminQueue(
      { find } as unknown as Pick<Payload, "find">,
      "active-work",
    );

    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "work-orders",
      where: { and: [{ "lead.recordState": { equals: "active" } }, { status: { in: ["scheduled", "on_way", "arrived", "precheck", "ready", "in_progress"] } }] },
    }));
  });

  it("does not query for a one-character universal search", async () => {
    const find = vi.fn();
    await expect(searchAdminRecords({ find } as unknown as Pick<Payload, "find">, "a")).resolves.toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  it("searches customer identity, address and operational references", async () => {
    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [{ id: 7, name: "Ola Nordmann", address: "Testveien", postal: "0001", city: "Oslo", status: "new" }] })
      .mockResolvedValueOnce({ docs: [{ id: 8, reference: "TIL-100", status: "draft" }] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 9, reference: "JOB-100", status: "scheduled" }] });

    const results = await searchAdminRecords(
      { find } as unknown as Pick<Payload, "find">,
      "  Ola  ",
    );

    expect(find).toHaveBeenCalledTimes(4);
    expect(find.mock.calls[0]?.[0].where.and[1].or).toEqual(
      expect.arrayContaining([
        { name: { contains: "Ola" } },
        { phone: { contains: "Ola" } },
        { address: { contains: "Ola" } },
      ]),
    );
    expect(results.map((result) => result.type)).toEqual(["lead", "quote", "workOrder"]);
    expect(results[0]?.subtitle).toBe("Testveien 0001 Oslo");
  });
});
