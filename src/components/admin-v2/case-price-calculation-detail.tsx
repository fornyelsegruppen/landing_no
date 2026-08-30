import { ArrowRight, Calculator, ChevronDown } from "lucide-react";
import type { CasePriceCalculation } from "@/lib/admin-v2/case-read-model";
import type { PanelLocale } from "@/lib/panel-i18n";

type PriceComparison = {
  from: CasePriceCalculation;
  to: CasePriceCalculation;
};

const copy = {
  lt: {
    adjustment: "Pakeitimo pagrindas",
    area: "Skaičiuotas plotas",
    calculation: "Skaičiavimo detalės",
    changed: "Kas pasikeitė",
    discount: "Nuolaida",
    integrity: "Techninis vientisumo patvirtinimas",
    lineItems: "Skaičiavimo eilutės",
    maximum: "Didžiausia kaina",
    measurement: "Matavimo šaltinis",
    noChanges: "Finansinės reikšmės nepasikeitė.",
    output: "Sukurti pasiūlymai",
    priceRule: "Kainodaros taisyklė",
    service: "Paslauga",
    subtotal: "Suma be PVM",
    tolerance: "Leistina paklaida",
    total: "Suma su PVM",
    unitPrice: "Vieneto kaina be PVM",
    vat: "PVM",
    versionChange: "Versijų pakeitimas",
  },
  en: {
    adjustment: "Reason for change",
    area: "Calculated area",
    calculation: "Calculation details",
    changed: "What changed",
    discount: "Discount",
    integrity: "Technical integrity confirmation",
    lineItems: "Calculation lines",
    maximum: "Maximum price",
    measurement: "Measurement source",
    noChanges: "The financial values did not change.",
    output: "Quotes created",
    priceRule: "Pricing rule",
    service: "Service",
    subtotal: "Subtotal excl. VAT",
    tolerance: "Allowed tolerance",
    total: "Total incl. VAT",
    unitPrice: "Unit price excl. VAT",
    vat: "VAT",
    versionChange: "Version change",
  },
  nb: {
    adjustment: "Begrunnelse for endringen",
    area: "Beregnet areal",
    calculation: "Beregningsdetaljer",
    changed: "Hva ble endret",
    discount: "Rabatt",
    integrity: "Teknisk integritetsbekreftelse",
    lineItems: "Beregningslinjer",
    maximum: "Maksimalpris",
    measurement: "Målegrunnlag",
    noChanges: "De økonomiske verdiene ble ikke endret.",
    output: "Opprettede tilbud",
    priceRule: "Prisregel",
    service: "Tjeneste",
    subtotal: "Sum ekskl. mva.",
    tolerance: "Tillatt toleranse",
    total: "Sum inkl. mva.",
    unitPrice: "Enhetspris ekskl. mva.",
    vat: "Mva.",
    versionChange: "Versjonsendring",
  },
} as const;

function numericChanges(
  labels: (typeof copy)[PanelLocale],
  comparison: PriceComparison,
) {
  return [
    [
      labels.subtotal,
      comparison.from.subtotalExVatOre,
      comparison.to.subtotalExVatOre,
    ],
    [labels.vat, comparison.from.vatOre, comparison.to.vatOre],
    [
      labels.total,
      comparison.from.totalIncVatOre,
      comparison.to.totalIncVatOre,
    ],
    [
      labels.maximum,
      comparison.from.maximumTotalIncVatOre,
      comparison.to.maximumTotalIncVatOre,
    ],
    [labels.discount, comparison.from.discountOre, comparison.to.discountOre],
  ].filter(([, from, to]) => from !== to) as Array<
    [string, number | undefined, number | undefined]
  >;
}

export function CasePriceCalculationDetail({
  calculation,
  comparison,
  formatMoney,
  locale,
  measurementReference,
  quoteReferences = [],
}: {
  calculation: CasePriceCalculation;
  comparison?: PriceComparison;
  formatMoney: (value?: number) => string;
  locale: PanelLocale;
  measurementReference?: string;
  quoteReferences?: readonly string[];
}) {
  const labels = copy[locale];
  const changes = comparison ? numericChanges(labels, comparison) : [];

  return (
    <section
      aria-labelledby={`price-calculation-${calculation.id}-title`}
      className="border-accent/30 bg-accent/[.055] grid max-w-full min-w-0 gap-4 overflow-hidden rounded-2xl border p-4"
      data-price-calculation-detail={calculation.id}
    >
      <div className="flex items-center gap-3">
        <span className="border-accent/35 bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full border">
          <Calculator aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h3
            className="font-bold"
            id={`price-calculation-${calculation.id}-title`}
          >
            {labels.calculation}
          </h3>
          <p className="text-muted-foreground text-xs break-all">
            {calculation.reference}
          </p>
        </div>
      </div>

      {comparison ? (
        <div className="rounded-xl border border-white/10 bg-black/15 p-3">
          <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            {labels.versionChange}
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 font-bold">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {comparison.from.reference}
            </span>
            <ArrowRight
              aria-hidden="true"
              className="text-accent size-4 shrink-0"
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {comparison.to.reference}
            </span>
          </div>
          {changes.length ? (
            <div className="mt-3 grid gap-2" aria-label={labels.changed}>
              {changes.map(([label, from, to]) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-white/10 pt-2 text-sm"
                  key={label}
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-right font-semibold [overflow-wrap:anywhere]">
                    <span>{formatMoney(from)}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                    />
                    <span>{formatMoney(to)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              {labels.noChanges}
            </p>
          )}
        </div>
      ) : null}

      <dl className="divide-y divide-white/10 rounded-xl border border-white/10 bg-black/15 px-3">
        {[
          [labels.measurement, measurementReference],
          [labels.service, calculation.serviceKey],
          [
            labels.area,
            typeof calculation.quantityTenths === "number"
              ? `${(calculation.quantityTenths / 10).toLocaleString(locale === "en" ? "en-GB" : locale === "lt" ? "lt-LT" : "nb-NO")} m²`
              : undefined,
          ],
          [
            labels.priceRule,
            calculation.priceRuleId
              ? `#${calculation.priceRuleId}${calculation.priceRuleVersion ? ` · V${calculation.priceRuleVersion}` : ""}`
              : undefined,
          ],
          [labels.subtotal, formatMoney(calculation.subtotalExVatOre)],
          [labels.vat, formatMoney(calculation.vatOre)],
          [labels.total, formatMoney(calculation.totalIncVatOre)],
          [labels.maximum, formatMoney(calculation.maximumTotalIncVatOre)],
          [
            labels.tolerance,
            typeof calculation.toleranceBasisPoints === "number"
              ? `${calculation.toleranceBasisPoints / 100} %`
              : undefined,
          ],
          [labels.discount, formatMoney(calculation.discountOre)],
        ]
          .filter(([, value]) => value && value !== "—")
          .map(([label, value]) => (
            <div
              className="grid min-w-0 gap-1 py-2.5 text-sm sm:grid-cols-[minmax(6.5rem,.75fr)_minmax(0,1.25fr)] sm:gap-3"
              key={label}
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 font-semibold [overflow-wrap:anywhere] sm:text-right">
                {value}
              </dd>
            </div>
          ))}
      </dl>

      {calculation.lineItems.length ? (
        <div>
          <h4 className="text-sm font-bold">{labels.lineItems}</h4>
          <div className="mt-2 grid gap-2">
            {calculation.lineItems.map((line, index) => (
              <div
                className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm"
                key={`${line.code}:${index}`}
              >
                <p className="font-bold break-words">{line.code}</p>
                <p className="text-muted-foreground mt-1">
                  {typeof line.quantityTenths === "number"
                    ? `${line.quantityTenths / 10} m²`
                    : "—"}
                  {typeof line.unitPriceExVatOre === "number"
                    ? ` × ${formatMoney(line.unitPriceExVatOre)}`
                    : ""}
                  {typeof line.totalExVatOre === "number"
                    ? ` = ${formatMoney(line.totalExVatOre)}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {calculation.adjustmentReason ? (
        <div className="rounded-xl border border-white/10 bg-black/15 p-3">
          <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            {labels.adjustment}
          </p>
          <p className="mt-1 text-sm break-words">
            {calculation.adjustmentReason}
          </p>
        </div>
      ) : null}

      {quoteReferences.length ? (
        <div>
          <h4 className="text-sm font-bold">{labels.output}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {quoteReferences.map((reference) => (
              <span
                className="max-w-full rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold [overflow-wrap:anywhere]"
                key={reference}
              >
                {reference}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <details className="group rounded-xl border border-white/10 bg-black/10">
        <summary className="text-muted-foreground flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 text-xs font-semibold">
          <span className="min-w-0 flex-1">{labels.integrity}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <p className="border-t border-white/10 p-3 font-mono text-[.68rem] break-all text-white/65">
          {calculation.inputHash || "—"}
        </p>
      </details>
    </section>
  );
}
