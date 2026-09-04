import { describe, expect, it } from "vitest";
import { ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS, shouldShowAdminPendingFeedback } from "./admin-async-feedback";

describe("unified admin async feedback threshold", () => {
  it("does not flash before 150 ms and becomes visible at the boundary", () => {
    expect(ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS).toBe(150);
    expect(shouldShowAdminPendingFeedback(149)).toBe(false);
    expect(shouldShowAdminPendingFeedback(150)).toBe(true);
  });
});
