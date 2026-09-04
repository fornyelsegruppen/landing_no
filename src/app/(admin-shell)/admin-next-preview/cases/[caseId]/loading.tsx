import { cookies } from "next/headers";
import { AdminAsyncFeedback } from "@/components/admin-next/admin-async-feedback";
import { normalizePanelLocale } from "@/lib/panel-i18n";
import { panelLanguagePreferenceCookie } from "@/lib/panel-language-preference";

const loadingCopy = {
  nb: "Laster canonical sak",
  lt: "Įkeliama canonical byla",
  en: "Loading canonical case",
} as const;

export default async function AdminNextCaseWorkspaceLoading() {
  const cookieStore = await cookies();
  const locale = normalizePanelLocale(
    cookieStore.get(panelLanguagePreferenceCookie)?.value ??
      cookieStore.get("tf_panel_language")?.value,
  );
  return (
    <div
      className="mx-auto max-w-[900px]"
      data-case-workspace-load-state="pending"
    >
      <AdminAsyncFeedback
        action={loadingCopy[locale]}
        locale={locale}
        state="pending"
      />
    </div>
  );
}
