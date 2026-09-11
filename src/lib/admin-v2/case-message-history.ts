export const initialCaseMessageHistoryLimit = 5;

export function splitCaseMessageHistory<T extends { id: string | number }>(
  messages: readonly T[],
  excludedMessageId?: T["id"],
) {
  const visibleMessages = messages.filter(
    (message) => message.id !== excludedMessageId,
  );

  return {
    older: visibleMessages.slice(initialCaseMessageHistoryLimit),
    recent: visibleMessages.slice(0, initialCaseMessageHistoryLimit),
  };
}
