import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  requireInternalUser: vi.fn(),
  getPayload: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/auth/internal-session", () => ({
  requireInternalUser: mocks.requireInternalUser,
}));
vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));

import WorkerLayout from "./layout";
import WorkerHomePage from "./page";

describe("protected worker pages", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns not-found before auth or data access when the feature is off", async () => {
    vi.stubEnv("FEATURE_WORKER_PORTAL", "false");

    await expect(WorkerHomePage()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(WorkerLayout({ children: null })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.requireInternalUser).not.toHaveBeenCalled();
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });
});
