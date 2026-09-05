import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminNextPreviewWorkQueueEntry } from "@/lib/admin-next/work-queue-navigation";

const mocks = vi.hoisted(() => ({
  buildRollout: vi.fn(),
  requireAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth/internal-session", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));
vi.mock("@/lib/admin-next/rollout-view", () => ({
  buildAdminNextRolloutView: mocks.buildRollout,
}));
vi.mock("@/components/admin-next/admin-next-shell", () => ({
  AdminNextShell: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-shell": true }, children),
}));

import AdminNextLayout from "./layout";

describe("Admin Next Preview layout", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset().mockResolvedValue({
      displayName: "Preview operator",
      email: "operator@example.invalid",
      interfaceLanguage: "lt",
    });
    mocks.buildRollout.mockReset().mockReturnValue({ state: "preview" });
  });

  it("requests the verified ONE UI login return without changing global auth defaults", async () => {
    const element = await AdminNextLayout({
      children: createElement("p", null, "workspace"),
    });

    expect(mocks.requireAdminUser).toHaveBeenCalledWith({
      loginReturnTo: adminNextPreviewWorkQueueEntry,
    });
    expect(renderToStaticMarkup(element)).toContain("workspace");
  });
});
