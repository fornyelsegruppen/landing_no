import {
  caseMessageHistoryDeliveryFailureMessage,
  type CaseMessageHistoryLocale,
} from "@/lib/admin-v2/case-message-history";

export function CaseMessageFailureNotice({
  failureCode,
  locale,
}: {
  failureCode?: string;
  locale: CaseMessageHistoryLocale;
}) {
  return (
    <p className="text-danger mt-3 text-sm" role="alert">
      {caseMessageHistoryDeliveryFailureMessage(locale, failureCode)}
    </p>
  );
}
