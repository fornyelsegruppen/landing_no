import type { ReactNode } from "react";
import { splitCaseMessageHistory } from "@/lib/admin-v2/case-message-history";

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
        <details className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <summary className="hover:text-accent cursor-pointer font-semibold">
            {olderLabel} ({older.length})
          </summary>
          <div className="mt-3 grid min-w-0 gap-3">
            {older.map(renderMessage)}
          </div>
        </details>
      ) : null}
    </div>
  );
}
