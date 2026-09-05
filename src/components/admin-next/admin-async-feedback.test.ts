// @vitest-environment happy-dom

import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS, AdminAsyncFeedback, shouldShowAdminPendingFeedback } from "./admin-async-feedback";

describe("unified admin async feedback threshold", () => {
  afterEach(() => vi.useRealTimers());

  it("does not flash before 150 ms and becomes visible at the boundary", () => {
    expect(ADMIN_ASYNC_FEEDBACK_THRESHOLD_MS).toBe(150);
    expect(shouldShowAdminPendingFeedback(149)).toBe(false);
    expect(shouldShowAdminPendingFeedback(150)).toBe(true);
  });

  it("keeps pending feedback out of the live region until the 150 ms boundary", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(createElement(AdminAsyncFeedback, { action: "Search", delayMs: 150, state: "pending" })));
    expect(container.querySelector('[role="status"]')).toBeNull();
    act(() => vi.advanceTimersByTime(149));
    expect(container.querySelector('[role="status"]')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Search");
    act(() => root.unmount());
  });

  it("shows only explicitly safe retries and localizes recovery actions", () => {
    const unsafe = renderToStaticMarkup(createElement(AdminAsyncFeedback, {
      action: "Save",
      locale: "en",
      recoveryActions: [{ kind: "retry", onAction: () => undefined }],
      state: "error",
    }));
    const safe = renderToStaticMarkup(createElement(AdminAsyncFeedback, {
      action: "Save",
      locale: "en",
      recoveryActions: [
        { kind: "retry", onAction: () => undefined, safe: true },
        { kind: "back", onAction: () => undefined },
        { kind: "correct", onAction: () => undefined },
      ],
      state: "error",
    }));
    expect(unsafe).not.toContain("Try again");
    expect(safe).toContain("Try again");
    expect(safe).toContain("Go back");
    expect(safe).toContain("Correct");
    expect(safe).not.toMatch(/Bandyti|Grįžti|Koreguoti/);
  });
});
