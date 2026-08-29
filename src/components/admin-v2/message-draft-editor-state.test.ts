import { describe, expect, it } from "vitest";
import {
  acceptSavedMessageDraft,
  createMessageDraftEditorState,
  messageDraftIsDirty,
  reconcileMessageDraftEditorState,
  updateMessageDraftEditorState,
} from "./message-draft-editor-state";

const original = {
  bodyText: "Original customer-specific answer",
  messageId: 17,
  subject: "Original subject",
  updatedAt: "2026-08-29T10:00:00.000Z",
};

describe("message draft editor state", () => {
  it("accepts a newer server snapshot when the editor is clean", () => {
    const current = createMessageDraftEditorState(original);
    const result = reconcileMessageDraftEditorState(current, {
      ...original,
      bodyText: "Saved by another administrator",
      updatedAt: "2026-08-29T10:01:00.000Z",
    });

    expect(result.bodyText).toBe("Saved by another administrator");
    expect(result.updatedAt).toBe("2026-08-29T10:01:00.000Z");
    expect(result.hasServerConflict).toBe(false);
  });

  it("preserves unsaved text and the original concurrency token when updatedAt changes", () => {
    const current = updateMessageDraftEditorState(
      createMessageDraftEditorState(original),
      { bodyText: "Administrator's unsaved answer" },
    );
    const result = reconcileMessageDraftEditorState(current, {
      ...original,
      bodyText: "A newer server answer",
      updatedAt: "2026-08-29T10:01:00.000Z",
    });

    expect(result.bodyText).toBe("Administrator's unsaved answer");
    expect(result.updatedAt).toBe(original.updatedAt);
    expect(result.hasServerConflict).toBe(true);
    expect(messageDraftIsDirty(result)).toBe(true);
  });

  it("resets safely when a different message becomes active", () => {
    const dirty = updateMessageDraftEditorState(
      createMessageDraftEditorState(original),
      { subject: "Unsaved subject" },
    );
    const result = reconcileMessageDraftEditorState(dirty, {
      bodyText: "Different reply",
      messageId: 18,
      subject: "Different subject",
      updatedAt: "2026-08-29T10:02:00.000Z",
    });

    expect(result).toEqual({
      baselineBodyText: "Different reply",
      baselineSubject: "Different subject",
      bodyText: "Different reply",
      hasServerConflict: false,
      messageId: 18,
      subject: "Different subject",
      updatedAt: "2026-08-29T10:02:00.000Z",
    });
  });

  it("moves the optimistic concurrency baseline after a successful save", () => {
    const dirty = updateMessageDraftEditorState(
      createMessageDraftEditorState(original),
      { bodyText: "Saved answer" },
    );
    const saved = acceptSavedMessageDraft(dirty, "2026-08-29T10:03:00.000Z");

    expect(messageDraftIsDirty(saved)).toBe(false);
    expect(saved.updatedAt).toBe("2026-08-29T10:03:00.000Z");
  });
});
