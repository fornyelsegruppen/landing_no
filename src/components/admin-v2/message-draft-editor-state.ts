export type MessageDraftServerSnapshot = {
  bodyText: string;
  messageId: number;
  subject: string;
  updatedAt: string;
};

export type MessageDraftEditorState = MessageDraftServerSnapshot & {
  baselineBodyText: string;
  baselineSubject: string;
  hasServerConflict: boolean;
};

export function createMessageDraftEditorState(
  snapshot: MessageDraftServerSnapshot,
): MessageDraftEditorState {
  return {
    ...snapshot,
    baselineBodyText: snapshot.bodyText,
    baselineSubject: snapshot.subject,
    hasServerConflict: false,
  };
}

export function messageDraftIsDirty(state: MessageDraftEditorState) {
  return (
    state.subject !== state.baselineSubject ||
    state.bodyText !== state.baselineBodyText
  );
}

export function reconcileMessageDraftEditorState(
  current: MessageDraftEditorState,
  incoming: MessageDraftServerSnapshot,
): MessageDraftEditorState {
  if (incoming.messageId !== current.messageId) {
    return createMessageDraftEditorState(incoming);
  }

  const serverChanged =
    incoming.updatedAt !== current.updatedAt ||
    incoming.subject !== current.baselineSubject ||
    incoming.bodyText !== current.baselineBodyText;
  if (!serverChanged) return current;

  if (messageDraftIsDirty(current)) {
    return { ...current, hasServerConflict: true };
  }

  return createMessageDraftEditorState(incoming);
}

export function updateMessageDraftEditorState(
  current: MessageDraftEditorState,
  patch: Partial<Pick<MessageDraftEditorState, "bodyText" | "subject">>,
) {
  return { ...current, ...patch };
}

export function acceptSavedMessageDraft(
  current: MessageDraftEditorState,
  updatedAt?: string,
): MessageDraftEditorState {
  return {
    ...current,
    baselineBodyText: current.bodyText,
    baselineSubject: current.subject,
    hasServerConflict: false,
    updatedAt: updatedAt || current.updatedAt,
  };
}
