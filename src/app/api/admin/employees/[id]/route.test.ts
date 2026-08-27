import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  count: vi.fn(),
  delete: vi.fn(),
  findByID: vi.fn(),
  recordAudit: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    count: mocks.count,
    delete: mocks.delete,
    findByID: mocks.findByID,
    update: mocks.update,
  })),
}));
vi.mock("@/payload/access/roles", () => ({
  userIsAdmin: vi.fn(() => true),
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/audit/audit-event", () => ({
  recordAuditEvent: mocks.recordAudit,
}));

import { DELETE, PATCH } from "./route";

const context = { params: Promise.resolve({ id: "7" }) };

function request(method: "DELETE" | "PATCH", body?: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/employees/7", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("admin employee details", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({
      user: { id: 1, role: "admin" },
    });
    mocks.findByID.mockReset().mockResolvedValue({
      active: true,
      displayName: "Kari Nordmann",
      email: "kari@example.no",
      id: 7,
      interfaceLanguage: "nb",
      phone: null,
      role: "worker",
    });
    mocks.update.mockReset().mockResolvedValue({
      active: true,
      displayName: "Kari Nordmann",
      email: "kari@example.no",
      id: 7,
      interfaceLanguage: "lt",
      phone: "+47 900 00 000",
      role: "worker",
    });
    mocks.count.mockReset().mockResolvedValue({ totalDocs: 0 });
    mocks.delete.mockReset().mockResolvedValue({ id: 7 });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
  });

  it("updates the existing account and keeps the same email available", async () => {
    const response = await PATCH(
      request("PATCH", {
        displayName: "Kari Nordmann",
        email: "kari@example.no",
        interfaceLanguage: "lt",
        password: "",
        phone: "+47 900 00 000",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "kari@example.no",
          phone: "+47 900 00 000",
        }),
        id: 7,
      }),
    );
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("password");
  });

  it("permanently deletes an unused employee account", async () => {
    const response = await DELETE(request("DELETE"), context);

    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "users", id: 7 }),
    );
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ action: "employee.delete", entityId: 7 }),
    );
  });

  it("preserves an employee account that has operational history", async () => {
    mocks.count.mockResolvedValueOnce({ totalDocs: 1 });

    const response = await DELETE(request("DELETE"), context);
    const result = (await response.json()) as { code?: string };

    expect(response.status).toBe(409);
    expect(result.code).toBe("EMPLOYEE_HAS_HISTORY");
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
