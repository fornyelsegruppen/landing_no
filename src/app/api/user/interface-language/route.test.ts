import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    update: mocks.update,
  })),
}));

import { panelLanguagePreferenceCookie } from "@/lib/panel-language-preference";
import { POST } from "./route";

function request(interfaceLanguage: unknown) {
  return new Request("https://preview.example/api/user/interface-language", {
    body: JSON.stringify({ interfaceLanguage }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("own interface language", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.update.mockReset().mockResolvedValue({ id: 7 });
  });

  it("persists the authenticated user's changed profile preference and cookie", async () => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 7, role: "admin" },
    });

    const response = await POST(request("lt"));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      collection: "users",
      data: { interfaceLanguage: "lt" },
      id: 7,
      overrideAccess: true,
    });
    expect(response.headers.get("set-cookie")).toContain(
      `${panelLanguagePreferenceCookie}=lt`,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects an unauthenticated update without touching a profile", async () => {
    mocks.auth.mockResolvedValue({ user: null });

    const response = await POST(request("lt"));

    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an inactive account and an invalid locale", async () => {
    mocks.auth.mockResolvedValueOnce({
      user: { active: false, id: 7, role: "admin" },
    });
    expect((await POST(request("lt"))).status).toBe(401);

    mocks.auth.mockResolvedValueOnce({
      user: { active: true, id: 7, role: "worker" },
    });
    expect((await POST(request("de"))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
