import { describe, expect, it, vi } from "vitest";
import { createAdminNextCanonicalFieldVisitAdapter } from "@/lib/admin-next/field-visit-read-adapter";

describe("Admin Next canonical field visit reader", () => {
  it("scopes worker reads and projects the canonical work-order state", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{
      id: 44,
      reference: "WV-44",
      status: "on_way",
      workSummary: "Takvask",
      scheduledAt: "2026-09-01T08:00:00.000Z",
      arrivalWindow: "10:00–12:00",
      assignedWorker: { id: 7, displayName: "Kari Arbeider" },
      lead: { id: 12, name: "Ola Kunde", address: "Testveien", houseNumber: "4", postal: "0123", city: "Oslo" },
      beforePhotos: [],
      afterPhotos: [],
      updatedAt: "2026-09-01T07:30:00.000Z",
    }] });
    const adapter = createAdminNextCanonicalFieldVisitAdapter({ find } as never, { id: 7, role: "worker", displayName: "Kari Arbeider" });
    const result = await adapter.load("WV-44", "assigned");

    expect(result).toMatchObject({ status: "ready", source: "canonical", value: { state: "on_way", worker: { name: "Kari Arbeider" } } });
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      where: { and: [{ reference: { equals: "WV-44" } }, { assignedWorker: { equals: 7 } }] },
    }));
  });

  it("does not reveal a visit outside the worker scope", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] });
    const adapter = createAdminNextCanonicalFieldVisitAdapter({ find } as never, { id: 7, role: "worker" });
    await expect(adapter.load("WV-99", "assigned")).resolves.toEqual({ status: "not_found" });
  });
});

