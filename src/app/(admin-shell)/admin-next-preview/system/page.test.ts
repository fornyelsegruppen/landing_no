import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildHealth: vi.fn(),
  buildReleaseGate: vi.fn(),
  buildRollout: vi.fn(),
  getPayload: vi.fn(),
  loadOperational: vi.fn(),
  panel: vi.fn(),
  requireAdminUser: vi.fn(),
}));

vi.mock("@/components/admin-v2/platform-health-panel", () => ({
  PlatformHealthPanel: mocks.panel,
}));
vi.mock("@/lib/admin-next/rollout-view", () => ({
  buildAdminNextRolloutView: mocks.buildRollout,
}));
vi.mock("@/lib/auth/internal-session", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));
vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/platform/health", () => ({
  buildPlatformHealth: mocks.buildHealth,
  loadOperationalHealth: mocks.loadOperational,
}));
vi.mock("@/lib/platform/release-gate", () => ({
  buildReleaseGate: mocks.buildReleaseGate,
}));

import AdminSystemHealthPage from "./page";

describe("Admin Next system health route", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset().mockResolvedValue({
      interfaceLanguage: "lt",
    });
    mocks.getPayload.mockReset().mockResolvedValue({ id: "payload" });
    mocks.loadOperational.mockReset().mockResolvedValue({ id: "operations" });
    mocks.buildHealth.mockReset().mockReturnValue({ id: "health" });
    mocks.buildReleaseGate.mockReset().mockReturnValue({ id: "release" });
    mocks.buildRollout.mockReset().mockReturnValue({ id: "rollout" });
    mocks.panel.mockReset();
  });

  it("loads real operational evidence and passes independent Preview and Production views", async () => {
    const element = await AdminSystemHealthPage();

    expect(mocks.requireAdminUser).toHaveBeenCalledOnce();
    expect(mocks.getPayload).toHaveBeenCalledOnce();
    expect(mocks.loadOperational).toHaveBeenCalledWith({ id: "payload" });
    expect(element.type).toBe(mocks.panel);
    expect(element.props).toEqual({
      headingLevel: "h1",
      health: { id: "health" },
      locale: "lt",
      operational: { id: "operations" },
      releaseGate: { id: "release" },
      rollout: { id: "rollout" },
    });
  });
});
