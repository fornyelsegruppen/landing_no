import type { ReactNode } from "react";
import { splitCaseMessageHistory } from "@/lib/admin-v2/case-message-history";
import { CaseMessageHistoryDisclosure } from "./case-message-history-disclosure";

export function CaseMessageHistory<T extends { id: string | number }>({
  excludedMessageId,
  messages,
  olderLabel,
  renderMessage,
}: {
  excludedMessageId?: T["id"];
  messages: readonly T[];
  olderLabel: string;
  renderMessage: (message: T) => ReactNode;
}) {
  const { older, recent } = splitCaseMessageHistory(
    messages,
    excludedMessageId,
  );

  if (!recent.length) return null;

  return (
    <div className="grid min-w-0 gap-3">
      {recent.map(renderMessage)}
      {older.length ? (
        <CaseMessageHistoryDisclosure
          summary={`${olderLabel} (${older.length})`}
        >
          {older.map(renderMessage)}
        </CaseMessageHistoryDisclosure>
      ) : null}
    </div>
  );
}
