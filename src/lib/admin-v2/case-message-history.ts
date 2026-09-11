export const initialCaseMessageHistoryLimit = 5;

export function splitCaseMessageHistory<T>(messages: readonly T[]) {
  return {
    older: messages.slice(initialCaseMessageHistoryLimit),
    recent: messages.slice(0, initialCaseMessageHistoryLimit),
  };
}
