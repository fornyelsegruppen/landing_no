import { describe, expect, it } from "vitest";
import { workerPortalAvailable, workerPrivateNoStoreHeaders } from "./gate";

describe("worker portal gate", () => {
  it("is fail-closed unless the worker portal flag is explicitly enabled", () => {
    expect(workerPortalAvailable({})).toBe(false);
    expect(workerPortalAvailable({ FEATURE_WORKER_PORTAL: "false" })).toBe(
      false,
    );
    expect(workerPortalAvailable({ FEATURE_WORKER_PORTAL: "true" })).toBe(true);
  });

  it("defines private no-store caching for worker data", () => {
    expect(workerPrivateNoStoreHeaders).toEqual({
      "Cache-Control": "private, no-store",
    });
  });
});
