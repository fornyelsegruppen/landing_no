import type { PanelLocale } from "@/lib/panel-i18n";

const copy = {
  nb: {
    accepted:
      "Kunden har godkjent den skriftlige endringsavtalen. Arbeidet kunne fortsette.",
    acceptedCompleted:
      "Kunden godkjente den skriftlige endringsavtalen. Arbeidet er ferdig og dokumentert. Ingen handling er nødvendig nå.",
    blocked:
      "Berørt arbeid må stå på vent til kunden har godkjent endringen skriftlig.",
    changeAgreement: "Endringsavtale",
    contractMaximum: "Avtalt maksimalpris",
    declined:
      "Kunden avslo endringsavtalen. Arbeidet kan ikke fortsette etter endringen.",
    inspectedTotal: "Kontrollert pris",
    overage: "Over maksimalprisen",
    resolved: "Løst",
    review: "Krever avklaring",
    superseded:
      "Denne endringsavtalen er erstattet. Kontroller den gjeldende versjonen før arbeidet fortsetter.",
    title: "Maksimalprisen ble overskredet",
  },
  lt: {
    accepted:
      "Klientas priėmė rašytinį pakeitimo susitarimą. Darbą buvo galima tęsti.",
    acceptedCompleted:
      "Klientas priėmė rašytinį pakeitimo susitarimą. Darbas užbaigtas ir dokumentuotas. Dabar veiksmų nereikia.",
    blocked:
      "Susiję darbai turi būti sustabdyti, kol klientas raštu priims pakeitimą.",
    changeAgreement: "Pakeitimo susitarimas",
    contractMaximum: "Sutarta maksimali kaina",
    declined:
      "Klientas atmetė pakeitimo susitarimą. Darbo pagal pakeitimą tęsti negalima.",
    inspectedTotal: "Patikros kaina",
    overage: "Viršyta",
    resolved: "Išspręsta",
    review: "Reikia sprendimo",
    superseded:
      "Šis pakeitimo susitarimas pakeistas nauja versija. Prieš tęsdami patikrinkite galiojančią versiją.",
    title: "Maksimali kaina buvo viršyta",
  },
  en: {
    accepted:
      "The customer accepted the written change agreement. Work could continue.",
    acceptedCompleted:
      "The customer accepted the written change agreement. The work is complete and documented. No action is required now.",
    blocked:
      "Affected work must remain stopped until the customer accepts the change in writing.",
    changeAgreement: "Change agreement",
    contractMaximum: "Agreed maximum price",
    declined:
      "The customer declined the change agreement. Work cannot continue under the change.",
    inspectedTotal: "Inspected price",
    overage: "Above maximum",
    resolved: "Resolved",
    review: "Decision required",
    superseded:
      "This change agreement was superseded. Check the current version before work continues.",
    title: "The maximum price was exceeded",
  },
} as const;

const unsuccessfulStatuses = new Set(["declined", "revoked"]);

export function CasePriceOutcomeSummary({
  afterTotalIncVatOre,
  beforeMaximumTotalIncVatOre,
  changeReference,
  changeStatus,
  changeStatusAt,
  changeStatusLabel,
  formatMoney,
  locale,
  reasonCode,
  workOrderStatus,
}: {
  afterTotalIncVatOre?: number;
  beforeMaximumTotalIncVatOre?: number | null;
  changeReference: string;
  changeStatus?: string;
  changeStatusAt?: string;
  changeStatusLabel: string;
  formatMoney: (value?: number) => string;
  locale: PanelLocale;
  reasonCode?: string;
  workOrderStatus?: string;
}) {
  if (reasonCode !== "over_maximum") return null;

  const labels = copy[locale];
  const amountKnown =
    typeof afterTotalIncVatOre === "number" &&
    typeof beforeMaximumTotalIncVatOre === "number";
  const overageOre = amountKnown
    ? Math.max(0, afterTotalIncVatOre - beforeMaximumTotalIncVatOre)
    : undefined;
  const accepted = changeStatus === "accepted";
  const declined = Boolean(
    changeStatus && unsuccessfulStatuses.has(changeStatus),
  );
  const superseded = changeStatus === "superseded";
  const outcome = accepted
    ? workOrderStatus === "documented"
      ? labels.acceptedCompleted
      : labels.accepted
    : declined
      ? labels.declined
      : superseded
        ? labels.superseded
        : labels.blocked;

  return (
    <section
      aria-label={labels.title}
      className="border-warning/55 bg-warning/8 mt-4 min-w-0 rounded-2xl border p-3 sm:p-4"
      data-price-outcome="over-maximum"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-warning text-xs font-bold tracking-[.14em] uppercase">
            {labels.title}
            {typeof overageOre === "number" && overageOre > 0 ? (
              <span className="ml-1 whitespace-nowrap">
                +{formatMoney(overageOre)}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm font-semibold [overflow-wrap:anywhere]">
            {labels.changeAgreement}: {changeReference}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[.68rem] font-bold tracking-wider uppercase ${
            accepted
              ? "border-success/45 bg-success/10 text-success"
              : declined
                ? "border-danger/45 bg-danger/10 text-danger"
                : "border-warning/45 bg-warning/10 text-warning"
          }`}
        >
          {accepted ? labels.resolved : labels.review} · {changeStatusLabel}
          {changeStatusAt ? ` · ${changeStatusAt}` : ""}
        </span>
      </div>

      <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="min-w-0 rounded-xl bg-black/15 p-2.5">
          <dt className="text-muted-foreground text-[.68rem] font-bold tracking-wider uppercase">
            {labels.contractMaximum}
          </dt>
          <dd className="mt-1 font-bold [overflow-wrap:anywhere]">
            {formatMoney(beforeMaximumTotalIncVatOre ?? undefined)}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl bg-black/15 p-2.5">
          <dt className="text-muted-foreground text-[.68rem] font-bold tracking-wider uppercase">
            {labels.inspectedTotal}
          </dt>
          <dd className="mt-1 font-bold [overflow-wrap:anywhere]">
            {formatMoney(afterTotalIncVatOre)}
          </dd>
        </div>
        <div className="border-warning/30 bg-warning/8 min-w-0 rounded-xl border p-2.5">
          <dt className="text-warning text-[.68rem] font-bold tracking-wider uppercase">
            {labels.overage}
          </dt>
          <dd className="text-warning mt-1 font-bold [overflow-wrap:anywhere]">
            {typeof overageOre === "number" && overageOre > 0
              ? `+${formatMoney(overageOre)}`
              : "—"}
          </dd>
        </div>
      </dl>

      <p
        className={`mt-3 text-sm font-semibold [overflow-wrap:anywhere] ${
          accepted
            ? "text-success"
            : declined
              ? "text-danger"
              : "text-warning"
        }`}
      >
        {outcome}
      </p>
    </section>
  );
}
