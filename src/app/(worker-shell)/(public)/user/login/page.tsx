import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { WorkerLoginForm } from "@/components/worker/login-form";
import { PanelLanguageSwitcher } from "@/components/worker/panel-language-switcher";
import { getInternalUser } from "@/lib/auth/internal-session";
import { getWorkerCopy, normalizePanelLocale } from "@/lib/panel-i18n";

export const dynamic = "force-dynamic";

export default async function WorkerLoginPage() {
  if (await getInternalUser()) redirect("/user");
  const locale = normalizePanelLocale((await cookies()).get("tf_panel_language")?.value);
  const copy = getWorkerCopy(locale);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-background-elevated p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Takfornyelse
          </p>
          <PanelLanguageSwitcher locale={locale} />
        </div>
        <h1 className="mt-2 text-3xl font-bold">{copy.loginTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {copy.loginIntro}
        </p>
        <WorkerLoginForm locale={locale} />
      </section>
    </main>
  );
}
