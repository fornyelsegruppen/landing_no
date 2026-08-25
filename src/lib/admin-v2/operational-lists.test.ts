import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { loadOperationalList } from "./operational-lists";

describe("admin operational lists", () => {
  it.each([
    ["offers", "quotes", "lead.recordState"],
    ["contracts", "contracts", "quote.lead.recordState"],
    ["work", "work-orders", "lead.recordState"],
  ] as const)("loads only active customer cases for %s", async (kind, collection, relation) => {
    const find = vi.fn().mockResolvedValue({ docs: [] });
    await loadOperationalList({ find } as unknown as Pick<Payload, "find">, kind);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection, where: kind === "work" ? { [relation]: { equals: "active" } } : { and: [{ [relation]: { equals: "active" } }, { status: { not_equals: "superseded" } }] } }));
  });

  it("maps a contract back to the custom case workspace", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 7, reference: "K-7", status: "signed", quote: { lead: { id: 3, name: "Ola" } } }] });
    await expect(loadOperationalList({ find } as unknown as Pick<Payload, "find">, "contracts")).resolves.toEqual([expect.objectContaining({ customer: "Ola", href: "/admin-v2/cases/3", reference: "K-7" })]);
  });

  it("uses visit time, arrival window and employee for work instead of only updatedAt", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{
      id: 9,
      reference: "A-9",
      status: "scheduled",
      scheduledAt: "2026-08-26T08:00:00.000Z",
      arrivalWindow: "10:00–12:00",
      updatedAt: "2026-08-25T12:00:00.000Z",
      assignedWorker: { id: 4, displayName: "Kari Arbeider" },
      lead: { id: 5, name: "Ola" },
    }] });

    await expect(loadOperationalList({ find } as unknown as Pick<Payload, "find">, "work")).resolves.toEqual([
      expect.objectContaining({
        employee: "Kari Arbeider",
        scheduledAt: "2026-08-26T08:00:00.000Z",
        arrivalWindow: "10:00–12:00",
      }),
    ]);
  });
});
