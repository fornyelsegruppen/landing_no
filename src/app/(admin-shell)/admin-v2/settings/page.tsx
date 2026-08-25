import Link from "next/link";
import { PlatformHealthPanel } from "@/components/admin-v2/platform-health-panel";
import { SettingsForm } from "@/components/admin-v2/settings-form";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { buildPlatformHealth, loadOperationalHealth } from "@/lib/platform/health";
import { buildReleaseGate } from "@/lib/platform/release-gate";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const payload = await getPayload();
  const [settings, operational] = await Promise.all([
    payload.findGlobal({ slug: "site-settings", depth: 0, draft: false, overrideAccess: true }),
    loadOperationalHealth(payload),
  ]);
  const values = {
    brandName: settings.brandName || "Takfornyelse",
    phone: settings.phone || "+47 47 73 58 88",
    email: settings.email || "post@takfornyelse.as",
    street: settings.street || "Lyngveien 28",
    postal: settings.postal || "1182",
    city: settings.city || "Oslo",
    orgNr: settings.orgNr || "916 693 168",
    openingDays: settings.openingDays || "Monday, Tuesday, Wednesday, Thursday, Friday",
    openingTime: settings.openingTime || "08:00",
    closingTime: settings.closingTime || "16:00",
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.control}</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">{copy.settingsAdmin.title}</h1><p className="mt-2 text-muted-foreground">{copy.settingsAdmin.intro}</p></header>
    <PlatformHealthPanel health={buildPlatformHealth()} locale={user.interfaceLanguage} operational={operational} releaseGate={buildReleaseGate()}/>
    <SettingsForm locale={user.interfaceLanguage} values={values}/>
    <details className="rounded-2xl border border-white/10 p-4 text-sm text-muted-foreground"><summary className="cursor-pointer font-bold">{copy.settingsAdmin.technical}</summary><Link className="mt-3 inline-block text-accent" href="/admin/globals/site-settings">{copy.settingsAdmin.technical}</Link></details>
  </div>;
}
