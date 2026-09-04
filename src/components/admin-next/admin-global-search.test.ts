import { describe, expect, it } from "vitest";
import { shouldOpenAdminGlobalSearchShortcut } from "./admin-global-search";

function trigger(rectCount: number) {
  return {
    getClientRects: () => ({ length: rectCount }) as DOMRectList,
  };
}

describe("admin global search shortcut", () => {
  it("opens only the responsive search instance that is visibly rendered", () => {
    const shortcut = { ctrlKey: true, key: "k", metaKey: false };

    expect(shouldOpenAdminGlobalSearchShortcut(shortcut, trigger(1))).toBe(
      true,
    );
    expect(shouldOpenAdminGlobalSearchShortcut(shortcut, trigger(0))).toBe(
      false,
    );
    expect(shouldOpenAdminGlobalSearchShortcut(shortcut, null)).toBe(false);
  });

  it("ignores unmodified and unrelated keyboard input", () => {
    expect(
      shouldOpenAdminGlobalSearchShortcut(
        { ctrlKey: false, key: "k", metaKey: false },
        trigger(1),
      ),
    ).toBe(false);
    expect(
      shouldOpenAdminGlobalSearchShortcut(
        { ctrlKey: true, key: "p", metaKey: false },
        trigger(1),
      ),
    ).toBe(false);
  });
});
