import Link from "next/link";
import { PlatformHealthPanel } from "@/components/admin-v2/platform-health-panel";
import { SettingsForm } from "@/components/admin-v2/settings-form";
import { ProductionTermsActivation } from "@/components/admin-v2/production-terms-activation";
import { PRODUCTION_PILOT_TERMS } from "@/content/production-pilot-terms";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import {
  buildPlatformHealth,
  loadOperationalHealth,
} from "@/lib/platform/health";
import { buildReleaseGate } from "@/lib/platform/release-gate";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const payload = await getPayload();
  const [settings, operational, approvedTerms] = await Promise.all([
    payload.findGlobal({
      slug: "site-settings",
      depth: 0,
      draft: false,
      overrideAccess: true,
    }),
    loadOperationalHealth(payload),
    payload.find({
      collection: "contract-terms",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      sort: "-approvedAt",
      where: { status: { equals: "approved" } },
    }),
  ]);
  const values = {
    brandName: settings.brandName || "Takfornyelse",
    phone: settings.phone || "+47 47 73 58 88",
    email: settings.email || "post@takfornyelse.as",
    street: settings.street || "Lyngveien 28",
    postal: settings.postal || "1182",
    city: settings.city || "Oslo",
    orgNr: settings.orgNr || "916 693 168",
    openingDays:
      settings.openingDays || "Monday, Tuesday, Wednesday, Thursday, Friday",
    openingTime: settings.openingTime || "08:00",
    closingTime: settings.closingTime || "16:00",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-accent text-xs font-bold tracking-[.2em] uppercase">
          {copy.control}
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {copy.settingsAdmin.title}
        </h1>
        <p className="text-muted-foreground mt-2">{copy.settingsAdmin.intro}</p>
      </header>
      <PlatformHealthPanel
        health={buildPlatformHealth()}
        locale={user.interfaceLanguage}
        operational={operational}
        releaseGate={buildReleaseGate()}
      />
      <ProductionTermsActivation
        activeVersion={approvedTerms.docs[0]?.version}
        locale={user.interfaceLanguage}
        targetVersion={PRODUCTION_PILOT_TERMS.version}
      />
      <SettingsForm locale={user.interfaceLanguage} values={values} />
      <details className="text-muted-foreground rounded-2xl border border-white/10 p-4 text-sm">
        <summary className="cursor-pointer font-bold">
          {copy.settingsAdmin.technical}
        </summary>
        <Link
          className="text-accent mt-3 inline-block"
          href="/admin/globals/site-settings"
        >
          {copy.settingsAdmin.technical}
        </Link>
      </details>
    </div>
  );
}
