import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  loadAdminDashboard,
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
    expect(parseAdminQueue("../../admin")).toBeNull();
    expect(parseAdminQueue(undefined)).toBeNull();
  });

  it("loads deterministic dashboard counts", async () => {
    const totals = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
    const count = vi.fn().mockImplementation(async () => ({ totalDocs: totals.shift() }));
    const result = await loadAdminDashboard(
      { count } as unknown as Pick<Payload, "count">,
      new Date("2026-08-24T08:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      counts: {
        newLeads: 2,
        aiDrafts: 3,
        replyDrafts: 5,
        attention: 48,
        activeWork: 19,
        unassignedWork: 23,
        pendingQuotes: 29,
        pendingContracts: 31,
        changeAgreements: 37,
        upcomingWork: 41,
      },
    });
    expect(count).toHaveBeenCalledTimes(13);
  });

  it("does not disguise database failures as zero counts", async () => {
    const count = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(loadAdminDashboard({ count } as unknown as Pick<Payload, "count">)).resolves.toEqual({
      ok: false,
      counts: null,
    });
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
    expect(find.mock.calls[0]?.[0].where.or).toEqual(
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
