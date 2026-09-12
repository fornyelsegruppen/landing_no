import { describe, expect, it } from "vitest";
import {
  blogEditorRefreshState,
  BLOG_EDITOR_REFRESH_RECOVERY_MS,
} from "./blog-editor-refresh-state";

describe("blogEditorRefreshState", () => {
  it("keeps the editor frozen until the server supplies a new version", () => {
    expect(BLOG_EDITOR_REFRESH_RECOVERY_MS).toBeGreaterThan(0);
    expect(
      blogEditorRefreshState({
        awaitingRefresh: true,
        refreshRecoveryVisible: false,
      }),
    ).toEqual({ freezeEditor: true, showSafeReload: false });
  });

  it("offers only the explicit safe reload after a delayed refresh", () => {
    expect(
      blogEditorRefreshState({
        awaitingRefresh: true,
        refreshRecoveryVisible: true,
      }),
    ).toEqual({ freezeEditor: true, showSafeReload: true });
    expect(
      blogEditorRefreshState({
        awaitingRefresh: false,
        refreshRecoveryVisible: true,
      }),
    ).toEqual({ freezeEditor: false, showSafeReload: false });
  });
});
