import { ExternalLink, FileCheck2, TriangleAlert } from "lucide-react";
import type {
  CaseChangeAgreement,
  CaseDocument,
} from "@/lib/admin-v2/case-read-model";
import type { CaseCommercialVersion } from "@/lib/admin-v2/case-commercial-context";
import type { PanelLocale } from "@/lib/panel-i18n";

const copy = {
  nb: {
    accepted: "Elektronisk akseptert",
    acceptedAt: "Akseptert",
    change: "Godkjent endringsavtale",
    changePdfMissing: "PDF-bevis for godkjenningen ble ikke funnet",
    electronicEvidence:
      "Navn, tidspunkt og dokumentkontroll vises i PDF-beviset.",
    customerSignedAt: "Kunden signerte",
    openChange: "Åpne PDF for godkjent endringsavtale",
    openContract: "Åpne endelig signert kontrakt som PDF",
    originalContract: "Opprinnelig gjeldende kontrakt",
    pdfEvidenceMissing: "PDF-bevis ble ikke funnet",
    signedByBoth: "Signert av begge parter",
    supplierSignedAt: "Takfornyelse signerte",
    title: "Signatur- og godkjenningsbevis",
  },
  lt: {
    accepted: "Elektroniškai priimta",
    acceptedAt: "Priimta",
    change: "Priimtas pakeitimo susitarimas",
    changePdfMissing: "Priėmimo PDF įrodymas nerastas",
    electronicEvidence:
      "Vardas, laikas ir dokumento kontrolė pateikti PDF įrodyme.",
    customerSignedAt: "Klientas pasirašė",
    openChange: "Atidaryti priimto pakeitimo susitarimo PDF",
    openContract: "Atidaryti galutinį pasirašytos sutarties PDF",
    originalContract: "Originali galiojanti sutartis",
    pdfEvidenceMissing: "PDF įrodymas nerastas",
    signedByBoth: "Pasirašyta abiejų šalių",
    supplierSignedAt: "Takfornyelse pasirašė",
    title: "Pasirašymo ir priėmimo įrodymai",
  },
  en: {
    accepted: "Electronically accepted",
    acceptedAt: "Accepted",
    change: "Accepted change agreement",
    changePdfMissing: "Acceptance PDF evidence was not found",
    electronicEvidence:
      "The name, time and document control are shown in the PDF evidence.",
    customerSignedAt: "Customer signed",
    openChange: "Open accepted change agreement PDF",
    openContract: "Open final signed contract PDF",
    originalContract: "Original effective contract",
    pdfEvidenceMissing: "PDF evidence was not found",
    signedByBoth: "Signed by both parties",
    supplierSignedAt: "Takfornyelse signed",
    title: "Signing and acceptance evidence",
  },
} as const satisfies Record<PanelLocale, Record<string, string>>;

function isPdf(document: CaseDocument) {
  return (
    document.mimeType === "application/pdf" ||
    document.filename.toLocaleLowerCase().endsWith(".pdf")
  );
}

/**
 * Resolve only durable private-media links. In particular, never turn the
 * quote PDF regeneration endpoint into signing evidence.
 */
export function resolveCaseSigningEvidence(input: {
  change?: CaseChangeAgreement;
  documents: CaseDocument[];
  effectiveContract?: CaseCommercialVersion;
}) {
  const contract = input.effectiveContract;
  const linkedContractDocument = contract?.pdfHref?.startsWith(
    "/api/admin/media/",
  )
    ? input.documents.find(
        (document) =>
          document.href === contract.pdfHref &&
          document.ownerType === "contract" &&
          document.ownerId === String(contract.id) &&
          isPdf(document) &&
          document.filename.toLocaleLowerCase().startsWith("endelig-signert-"),
      )
    : undefined;

  const change = input.change?.status === "accepted" ? input.change : undefined;
  const acceptedChangeDocument = change
    ? input.documents.find(
        (document) =>
          document.ownerType === "change-agreement" &&
          document.ownerId === String(change.id) &&
          isPdf(document) &&
          document.filename.toLocaleLowerCase().includes("-akseptert"),
      )
    : undefined;

  return {
    acceptedChangeDocument,
    change,
    contract,
    fullySignedContractDocument: linkedContractDocument,
  };
}

export function caseContractDocumentHref(
  contract: CaseCommercialVersion,
  documents: CaseDocument[],
) {
  if (!contract.pdfHref) return undefined;
  if (contract.status !== "signed") return contract.pdfHref;
  if (contract.companySignedAt) {
    return resolveCaseSigningEvidence({
      documents,
      effectiveContract: contract,
    }).fullySignedContractDocument?.href;
  }
  if (!contract.pdfHref.startsWith("/api/admin/media/")) return undefined;
  return documents.find(
    (document) =>
      document.href === contract.pdfHref &&
      document.ownerType === "contract" &&
      document.ownerId === String(contract.id) &&
      isPdf(document),
  )?.href;
}

export function caseChangeDocumentHref(
  change: CaseChangeAgreement,
  documents: CaseDocument[],
) {
  if (change.status !== "accepted") {
    return `/api/admin/change-agreements/${change.id}/pdf`;
  }
  return resolveCaseSigningEvidence({ change, documents })
    .acceptedChangeDocument?.href;
}

export function CaseSigningEvidenceSummary({
  change,
  documents,
  effectiveContract,
  formatDate,
  locale,
}: {
  change?: CaseChangeAgreement;
  documents: CaseDocument[];
  effectiveContract?: CaseCommercialVersion;
  formatDate: (value?: string) => string;
  locale: PanelLocale;
}) {
  const labels = copy[locale];
  const evidence = resolveCaseSigningEvidence({
    change,
    documents,
    effectiveContract,
  });

  if (!evidence.contract && !evidence.change) return null;

  return (
    <section
      aria-labelledby="case-signing-evidence-title"
      className="mt-4 min-w-0 rounded-2xl border border-white/12 bg-black/15 p-3 sm:p-4"
      data-case-signing-evidence="true"
    >
      <h2
        className="text-xs font-bold tracking-[.14em] text-white/70 uppercase"
        id="case-signing-evidence-title"
      >
        {labels.title}
      </h2>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {evidence.contract ? (
          <article
            className={`min-w-0 rounded-xl border p-3 ${
              evidence.fullySignedContractDocument
                ? "border-success/40 bg-success/8"
                : "border-warning/45 bg-warning/8"
            }`}
            data-signing-evidence="contract"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              {evidence.fullySignedContractDocument ? (
                <FileCheck2
                  aria-hidden="true"
                  className="text-success mt-0.5 size-5 shrink-0"
                />
              ) : (
                <TriangleAlert
                  aria-hidden="true"
                  className="text-warning mt-0.5 size-5 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[.68rem] font-bold tracking-wider uppercase">
                  {labels.originalContract}
                </p>
                <p className="mt-1 font-bold [overflow-wrap:anywhere]">
                  {evidence.contract.reference}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold [overflow-wrap:anywhere] ${
                    evidence.fullySignedContractDocument
                      ? "text-success"
                      : "text-warning"
                  }`}
                >
                  {evidence.fullySignedContractDocument
                    ? labels.signedByBoth
                    : labels.pdfEvidenceMissing}
                </p>
              </div>
            </div>
            <dl className="mt-3 grid min-w-0 gap-1 text-xs text-white/75">
              {evidence.contract.signedAt ? (
                <div className="flex min-w-0 flex-wrap gap-x-1">
                  <dt>{labels.customerSignedAt}:</dt>
                  <dd className="font-semibold [overflow-wrap:anywhere]">
                    {formatDate(evidence.contract.signedAt)}
                  </dd>
                </div>
              ) : null}
              {evidence.contract.companySignedAt ? (
                <div className="flex min-w-0 flex-wrap gap-x-1">
                  <dt>{labels.supplierSignedAt}:</dt>
                  <dd className="font-semibold [overflow-wrap:anywhere]">
                    {formatDate(evidence.contract.companySignedAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
            {evidence.fullySignedContractDocument ? (
              <a
                className="text-success border-success/35 hover:bg-success/10 mt-3 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold [overflow-wrap:anywhere]"
                href={evidence.fullySignedContractDocument.href}
                rel="noreferrer"
                target="_blank"
              >
                {labels.openContract}
                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              </a>
            ) : null}
          </article>
        ) : null}

        {evidence.change ? (
          <article
            className={`min-w-0 rounded-xl border p-3 ${
              evidence.acceptedChangeDocument
                ? "border-success/40 bg-success/8"
                : "border-warning/45 bg-warning/8"
            }`}
            data-signing-evidence="change"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              {evidence.acceptedChangeDocument ? (
                <FileCheck2
                  aria-hidden="true"
                  className="text-success mt-0.5 size-5 shrink-0"
                />
              ) : (
                <TriangleAlert
                  aria-hidden="true"
                  className="text-warning mt-0.5 size-5 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[.68rem] font-bold tracking-wider uppercase">
                  {labels.change}
                </p>
                <p className="mt-1 font-bold [overflow-wrap:anywhere]">
                  {evidence.change.reference}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold [overflow-wrap:anywhere] ${
                    evidence.acceptedChangeDocument
                      ? "text-success"
                      : "text-warning"
                  }`}
                >
                  {evidence.acceptedChangeDocument
                    ? labels.accepted
                    : labels.changePdfMissing}
                </p>
              </div>
            </div>
            {evidence.change.acceptedAt ? (
              <p className="mt-3 text-xs [overflow-wrap:anywhere] text-white/75">
                {labels.acceptedAt}: {formatDate(evidence.change.acceptedAt)}
              </p>
            ) : null}
            {evidence.acceptedChangeDocument ? (
              <p className="text-muted-foreground mt-1 text-xs [overflow-wrap:anywhere]">
                {labels.electronicEvidence}
              </p>
            ) : null}
            {evidence.acceptedChangeDocument ? (
              <a
                className="text-success border-success/35 hover:bg-success/10 mt-3 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold [overflow-wrap:anywhere]"
                href={evidence.acceptedChangeDocument.href}
                rel="noreferrer"
                target="_blank"
              >
                {labels.openChange}
                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              </a>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}
