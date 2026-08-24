import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { caseActionRequiresConfirmation, deriveCaseNextAction, loadAdminCase } from "./case-read-model";

describe("admin case next action", () => {
  it("requires confirmation for every financial action", () => {
    expect(caseActionRequiresConfirmation("calculate_price")).toBe(true);
    expect(caseActionRequiresConfirmation("create_quote")).toBe(true);
    expect(caseActionRequiresConfirmation("approve_quote")).toBe(true);
    expect(caseActionRequiresConfirmation("issue_quote")).toBe(true);
    expect(caseActionRequiresConfirmation("approve_package")).toBe(true);
    expect(caseActionRequiresConfirmation("generate_reply")).toBe(false);
    expect(caseActionRequiresConfirmation("approve_message")).toBe(false);
  });

  it.each([
    [{ leadStatus: "new" }, "generate_reply"],
    [{ leadStatus: "draft_ready", message: { id: 1, status: "draft" } }, "approve_message"],
    [{ leadStatus: "draft_ready", canPreparePackage: true, message: { id: 1, status: "draft", category: "ai_reply" } }, "prepare_package"],
    [{ leadStatus: "new", message: { id: 2, status: "failed" } }, "retry_message"],
    [{ leadStatus: "measuring", message: { id: 1, status: "sent" } }, "prepare_package"],
    [{ leadStatus: "measuring", message: { id: 1, status: "cancelled" }, measurement: { id: 3, status: "review_required" }, price: { id: 4, status: "superseded" }, quote: { id: 5, status: "draft" }, contract: { id: 6, status: "draft" } }, "approve_package"],
    [{ leadStatus: "measuring", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "review_required" } }, "approve_measurement"],
    [{ leadStatus: "measuring", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "approved" } }, "calculate_price"],
    [{ leadStatus: "quoted", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "approved" }, price: { id: 4, status: "ready" } }, "create_quote"],
    [{ leadStatus: "quoted", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "approved" }, price: { id: 4, status: "superseded" }, quote: { id: 5, status: "draft" } }, "approve_quote"],
    [{ leadStatus: "quoted", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "approved" }, price: { id: 4, status: "superseded" }, quote: { id: 5, status: "approved" } }, "issue_quote"],
    [{ leadStatus: "waiting_customer", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "approved" }, price: { id: 4, status: "superseded" }, quote: { id: 5, status: "sent" } }, "wait_customer"],
    [{ leadStatus: "waiting_customer", message: { id: 1, status: "sent" }, quote: { id: 5, status: "declined" } }, "follow_up_decline"],
    [{ leadStatus: "converted", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "approved" }, price: { id: 4, status: "superseded" }, quote: { id: 5, status: "accepted" }, contract: { id: 6, status: "signed" } }, "create_work_order"],
    [{ leadStatus: "converted", message: { id: 1, status: "sent" }, measurement: { id: 3, status: "approved" }, price: { id: 4, status: "superseded" }, quote: { id: 5, status: "accepted" }, contract: { id: 6, status: "signed" }, workOrder: { id: 7, status: "unassigned" } }, "assign_worker"],
    [{ leadStatus: "closed" }, "none"],
  ])("derives %s as %s", (input, expected) => {
    expect(deriveCaseNextAction(input)).toMatchObject({ kind: expected });
  });
});

describe("admin case read model", () => {
  it("returns null for an unknown lead", async () => {
    const payload = { findByID: vi.fn().mockRejectedValue(new Error("not found")) } as unknown as Payload;
    await expect(loadAdminCase(payload, 404)).resolves.toBeNull();
  });

  it("assembles the customer journey without returning raw access tokens", async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 1,
      name: "Ola Nordmann",
      email: "ola@example.no",
      phone: "99999999",
      address: "Testveien",
      houseNumber: "1",
      postal: "0001",
      city: "Oslo",
      inquiryType: "takvask",
      status: "quoted",
      createdAt: "2026-08-24T08:00:00.000Z",
    });
    const responses = [
      { docs: [{ id: 2, reference: "TM-1-V1", status: "approved", actualAreaMinTenths: 1000, actualAreaMaxTenths: 1200, createdAt: "2026-08-24T09:00:00.000Z" }] },
      { docs: [{ id: 3, reference: "PB-1", status: "superseded", totalIncVatOre: 1250000, createdAt: "2026-08-24T10:00:00.000Z" }] },
      { docs: [{ id: 4, reference: "T-1-V1", status: "approved", createdAt: "2026-08-24T11:00:00.000Z" }] },
      { docs: [{ id: 5, subject: "Takk", bodyText: "Hei", direction: "outbound", category: "receipt", channel: "email", status: "sent", createdAt: "2026-08-24T08:01:00.000Z" }] },
      { docs: [] },
      { docs: [{ id: 6, reference: "K-1-V1", status: "draft", createdAt: "2026-08-24T11:01:00.000Z" }] },
      { docs: [{ id: 7, filename: "tilbud.pdf", classification: "contract", mimeType: "application/pdf", url: "https://safe.blob.vercel-storage.com/private/file.pdf" }] },
    ];
    const find = vi.fn().mockImplementation(async () => responses.shift());
    const result = await loadAdminCase({ findByID, find } as unknown as Payload, 1);

    expect(result?.lead.address).toBe("Testveien 1 0001 Oslo");
    expect(result?.quote?.reference).toBe("T-1-V1");
    expect(result?.nextAction.kind).toBe("issue_quote");
    expect(result?.documents[0]?.href).toContain("/api/admin/blob?url=");
    expect(JSON.stringify(result)).not.toContain("tokenHash");
    expect(result?.timeline.map((item) => item.type)).toEqual(expect.arrayContaining(["lead", "message", "measurement", "price", "quote", "contract"]));
  });

  it("does not offer an obsolete draft after a newer equivalent was sent", async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 1, name: "Test", address: "Testveien", postal: "0001", status: "waiting_customer", createdAt: "2026-08-24T08:00:00.000Z" });
    const responses = [
      { docs: [{ id: 2, reference: "TM-1", status: "approved", createdAt: "2026-08-24T09:00:00.000Z" }] },
      { docs: [{ id: 3, reference: "PB-1", status: "superseded", createdAt: "2026-08-24T10:00:00.000Z" }] },
      { docs: [{ id: 4, reference: "T-1", status: "viewed", createdAt: "2026-08-24T11:00:00.000Z" }] },
      { docs: [
        { id: 6, subject: "Tilbud T-1", category: "quote", bodyText: "Sent", direction: "outbound", channel: "email", status: "sent", createdAt: "2026-08-24T12:00:00.000Z" },
        { id: 5, subject: "Tilbud T-1", category: "quote", bodyText: "Draft", direction: "outbound", channel: "email", status: "draft", createdAt: "2026-08-24T11:30:00.000Z" },
      ] },
      { docs: [] },
      { docs: [{ id: 7, reference: "K-1", status: "issued", createdAt: "2026-08-24T11:00:00.000Z" }] },
      { docs: [] },
    ];
    const find = vi.fn().mockImplementation(async () => responses.shift());
    const result = await loadAdminCase({ findByID, find } as unknown as Payload, 1);

    expect(result?.nextAction.kind).toBe("wait_customer");
  });
});
