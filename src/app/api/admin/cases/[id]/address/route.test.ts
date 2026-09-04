import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  execute: vi.fn(),
  getPayload: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.isAdmin }));
vi.mock("@/lib/cases/preview-case-address-command", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/cases/preview-case-address-command")
    >();
  return { ...original, executePreviewCaseAddressCommand: mocks.execute };
});

import {
  PREVIEW_CASE_ADDRESS_COMMAND_RESULT_VERSION,
  PreviewCaseAddressCommandError,
} from "@/lib/cases/preview-case-address-command";
import { PATCH } from "./route";

const body = {
  expectedCaseRevision: 7,
  expectedAddressRevision: 1,
  idempotencyKey: "address-correction-13-r1",
  reasonCode: "operator_correction",
  address: {
    street: "New gate",
    houseNumber: "2A",
    postalCode: "0001",
    city: "Oslo",
  },
};

function request(value: unknown = body) {
  return new Request("http://localhost/api/admin/cases/13/address", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Correlation-ID": "corr-address-route",
    },
    body: JSON.stringify(value),
  });
}

const context = { params: Promise.resolve({ id: "13" }) };

describe("PATCH /api/admin/cases/:id/address", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND", "true");
    mocks.auth.mockReset().mockResolvedValue({
      user: { id: 7, role: "admin", active: true },
    });
    mocks.getPayload.mockReset().mockResolvedValue({ auth: mocks.auth });
    mocks.isAdmin.mockReset().mockReturnValue(true);
    mocks.execute.mockReset().mockResolvedValue({
      schemaVersion: PREVIEW_CASE_ADDRESS_COMMAND_RESULT_VERSION,
      status: "applied",
      case: { id: 13, caseRevision: 8, addressRevision: 2 },
      address: body.address,
      rfInvalidation: { status: "not_applicable" },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["production", "true"],
    ["preview", "false"],
  ])(
    "returns a fail-closed 404 before Payload/auth in %s with flag %s",
    async (vercelEnvironment, flag) => {
      vi.stubEnv("VERCEL_ENV", vercelEnvironment);
      vi.stubEnv("FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND", flag);

      const response = await PATCH(request(), context);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        code:
          vercelEnvironment === "preview"
            ? "FEATURE_DISABLED"
            : "PREVIEW_REQUIRED",
      });
      expect(mocks.getPayload).not.toHaveBeenCalled();
      expect(mocks.auth).not.toHaveBeenCalled();
      expect(mocks.execute).not.toHaveBeenCalled();
    },
  );

  it("authenticates an active admin and constructs only server-owned actor/correlation fields", async () => {
    const response = await PATCH(request(), context);

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.execute).toHaveBeenCalledWith({
      payload: { auth: mocks.auth },
      command: {
        schemaVersion: "preview-case-address-command.v1",
        leadId: 13,
        actorId: 7,
        correlationId: "corr-address-route",
        ...body,
      },
    });
  });

  it.each([
    [null, false, 401],
    [{ id: 8, role: "worker", active: true }, false, 403],
  ] as const)(
    "rejects unauthorized caller %j",
    async (user, isAdmin, status) => {
      mocks.auth.mockResolvedValue({ user });
      mocks.isAdmin.mockReturnValue(isAdmin);

      const response = await PATCH(request(), context);

      expect(response.status).toBe(status);
      expect(mocks.execute).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed input before Payload initialization", async () => {
    const response = await PATCH(
      request({ ...body, unexpected: true }),
      context,
    );

    expect(response.status).toBe(400);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("maps optimistic and idempotency conflicts to 409 without leaking details", async () => {
    mocks.execute.mockRejectedValue(
      new PreviewCaseAddressCommandError(
        "CASE_REVISION_CONFLICT",
        "private internal detail",
        7,
        8,
      ),
    );

    const response = await PATCH(request(), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Case address correction was not applied",
      code: "CASE_REVISION_CONFLICT",
      expectedRevision: 7,
      actualRevision: 8,
    });
  });

  it("returns 200 for an exact idempotent replay", async () => {
    mocks.execute.mockResolvedValue({
      schemaVersion: PREVIEW_CASE_ADDRESS_COMMAND_RESULT_VERSION,
      status: "replayed",
      case: { id: 13, caseRevision: 8, addressRevision: 2 },
      address: body.address,
      rfInvalidation: { status: "not_applicable" },
    });

    const response = await PATCH(request(), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "replayed",
      case: { caseRevision: 8, addressRevision: 2 },
    });
  });
});
