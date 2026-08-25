import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { loadAdminCaseList, normalizeCaseListFilters } from "./case-list";

describe("admin case list", () => {
  it("normalizes filters without accepting invalid dates or workers", () => {
    expect(normalizeCaseListFilters({
      query: "  Ola   Nordmann ",
      status: "unknown" as never,
      workerId: -1,
      dateFrom: "25.08.2026",
      dateTo: "2026-08-31",
    })).toEqual({
      action: "all",
      dateFrom: undefined,
      dateTo: "2026-08-31",
      query: "Ola Nordmann",
      recordState: "active",
      status: "all",
      workerId: undefined,
    });
  });

  it("assembles one searchable case with its real next action and worker", async () => {
    const find = vi.fn().mockImplementation(async (input: { collection: string }) => {
      switch (input.collection) {
        case "leads": return { docs: [{ id: 7, name: "Ola", email: "ola@example.no", address: "Testveien", houseNumber: "1", postal: "0001", city: "Oslo", inquiryType: "takvask", status: "converted", createdAt: "2026-08-25T08:00:00.000Z" }] };
        case "roof-measurements": return { docs: [{ id: 20, lead: 7, status: "approved" }] };
        case "price-calculations": return { docs: [{ id: 21, lead: 7, status: "ready" }] };
        case "quotes": return { docs: [{ id: 22, lead: 7, status: "accepted" }] };
        case "messages": return { docs: [{ id: 23, lead: 7, direction: "outbound", category: "contract", status: "sent" }] };
        case "work-orders": return { docs: [{ id: 25, lead: 7, status: "unassigned" }] };
        case "contracts": return { docs: [{ id: 24, quote: 22, status: "signed", companySignedAt: "2026-08-25T09:00:00.000Z" }] };
        case "users": return { docs: [{ id: 8, displayName: "Ansatt Test", role: "worker", active: true }] };
        default: return { docs: [] };
      }
    });

    const result = await loadAdminCaseList({ find } as unknown as Pick<Payload, "find">);

    expect(result.items).toEqual([
      expect.objectContaining({
        customer: "Ola",
        href: "/admin-v2/cases/7",
        nextAction: "assign_worker",
        postalAddress: "Testveien 1 0001 Oslo",
        workStatus: "unassigned",
      }),
    ]);
    expect(result.workers).toEqual([{ id: 8, name: "Ansatt Test" }]);
  });

  it("filters the assembled case by next action", async () => {
    const find = vi.fn().mockImplementation(async (input: { collection: string }) => {
      if (input.collection === "leads") return { docs: [{ id: 7, name: "Ola", address: "Testveien", inquiryType: "takvask", status: "new" }] };
      if (input.collection === "users") return { docs: [] };
      return { docs: [] };
    });

    await expect(loadAdminCaseList(
      { find } as unknown as Pick<Payload, "find">,
      { action: "company_sign_contract" },
    )).resolves.toEqual({ items: [], workers: [] });
  });
});
