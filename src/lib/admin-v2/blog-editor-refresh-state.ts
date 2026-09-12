export const BLOG_EDITOR_REFRESH_RECOVERY_MS = 7_000;

export function blogEditorRefreshState(input: {
  awaitingRefresh: boolean;
  refreshRecoveryVisible: boolean;
}) {
  return {
    freezeEditor: input.awaitingRefresh,
    showSafeReload: input.awaitingRefresh && input.refreshRecoveryVisible,
  };
}
