export type CaseCommercialRole = "effective" | "working" | "historical";

export type CaseCommercialVersion = {
  id: number;
  kind: "quote" | "contract";
  reference: string;
  version: number;
  status: string;
  role: CaseCommercialRole;
  supersedesId?: number;
  supersedesReference?: string;
  priceCalculationId?: number;
  quoteId?: number;
  pdfHref?: string;
  technicalHref: string;
  serviceDescription?: string;
  totalIncVatOre?: number;
  maximumTotalIncVatOre?: number;
  depositBasisPoints?: number;
  depositAmountIncVatOre?: number;
  signedAt?: string;
  companySignedAt?: string;
  createdAt?: string;
  documentHash?: string;
};

export type CaseCommercialContext = {
  workingQuote?: CaseCommercialVersion;
  workingContract?: CaseCommercialVersion;
  effectiveContract?: CaseCommercialVersion;
  quoteVersions: CaseCommercialVersion[];
  contractVersions: CaseCommercialVersion[];
};

export type CaseCommercialQuoteInput = {
  id: number;
  reference?: string;
  version?: number;
  status?: string;
  supersedesId?: number;
  priceCalculationId?: number;
  serviceDescription?: string;
  totalIncVatOre?: number;
  maximumTotalIncVatOre?: number;
  depositBasisPoints?: number;
  depositAmountIncVatOre?: number;
  createdAt?: string;
  documentHash?: string;
};

export type CaseCommercialContractInput = {
  id: number;
  quoteId?: number;
  reference?: string;
  version?: number;
  status?: string;
  supersedesId?: number;
  signedAt?: string;
  companySignedAt?: string;
  signedDocumentId?: number;
  companySignedDocumentId?: number;
  createdAt?: string;
  documentHash?: string;
};

const closedQuoteStatuses = new Set(["superseded", "revoked", "expired"]);
const closedContractStatuses = new Set(["superseded", "revoked"]);
const quoteStatusPriority: Record<string, number> = {
  accepted: 80,
  viewed: 70,
  sent: 60,
  approved: 50,
  draft: 40,
  declined: 30,
};

function newest<T extends { id: number; version?: number; status?: string }>(
  items: T[],
  statusPriority: Record<string, number> = {},
) {
  return [...items].sort(
    (left, right) =>
      (right.version || 0) - (left.version || 0) ||
      (statusPriority[right.status || ""] || 0) -
        (statusPriority[left.status || ""] || 0) ||
      right.id - left.id,
  );
}

export function deriveCaseCommercialContext(
  quotes: CaseCommercialQuoteInput[],
  contracts: CaseCommercialContractInput[],
): CaseCommercialContext {
  const sortedQuotes = newest(quotes, quoteStatusPriority);
  const workingQuoteRaw =
    sortedQuotes.find((item) => !closedQuoteStatuses.has(item.status || "")) ||
    sortedQuotes[0];
  const sortedContracts = newest(contracts);
  const workingContractRaw = workingQuoteRaw
    ? sortedContracts.find(
        (item) =>
          item.quoteId === workingQuoteRaw.id &&
          !closedContractStatuses.has(item.status || ""),
      )
    : sortedContracts.find(
        (item) => !closedContractStatuses.has(item.status || ""),
      ) || sortedContracts[0];
  const effectiveContractRaw = sortedContracts.find(
    (item) => item.status === "signed" && Boolean(item.companySignedAt),
  );

  const quoteById = new Map(quotes.map((item) => [item.id, item]));
  const contractById = new Map(contracts.map((item) => [item.id, item]));

  const quoteVersions = sortedQuotes.map<CaseCommercialVersion>((item) => ({
    id: item.id,
    kind: "quote",
    reference: item.reference || `T-${item.id}`,
    version: item.version || 1,
    status: item.status || "draft",
    role: item.id === workingQuoteRaw?.id ? "working" : "historical",
    supersedesId: item.supersedesId,
    supersedesReference: item.supersedesId
      ? quoteById.get(item.supersedesId)?.reference
      : undefined,
    priceCalculationId: item.priceCalculationId,
    quoteId: item.id,
    pdfHref: `/api/admin/quotes/${item.id}/pdf`,
    technicalHref: `/admin/collections/quotes/${item.id}`,
    serviceDescription: item.serviceDescription,
    totalIncVatOre: item.totalIncVatOre,
    maximumTotalIncVatOre: item.maximumTotalIncVatOre,
    depositBasisPoints: item.depositBasisPoints,
    depositAmountIncVatOre: item.depositAmountIncVatOre,
    createdAt: item.createdAt,
    documentHash: item.documentHash,
  }));

  const contractVersions = sortedContracts.map<CaseCommercialVersion>(
    (item) => {
      const quote = item.quoteId ? quoteById.get(item.quoteId) : undefined;
      const isEffective = item.id === effectiveContractRaw?.id;
      return {
        id: item.id,
        kind: "contract",
        reference: item.reference || `K-${item.id}`,
        version: item.version || quote?.version || 1,
        status: item.status || "draft",
        role: isEffective
          ? "effective"
          : item.id === workingContractRaw?.id
            ? "working"
            : "historical",
        supersedesId: item.supersedesId,
        supersedesReference: item.supersedesId
          ? contractById.get(item.supersedesId)?.reference
          : undefined,
        quoteId: item.quoteId,
        pdfHref: item.companySignedDocumentId
          ? `/api/admin/media/${item.companySignedDocumentId}`
          : item.signedDocumentId
            ? `/api/admin/media/${item.signedDocumentId}`
            : item.quoteId
              ? `/api/admin/quotes/${item.quoteId}/pdf`
              : undefined,
        technicalHref: `/admin/collections/contracts/${item.id}`,
        serviceDescription: quote?.serviceDescription,
        totalIncVatOre: quote?.totalIncVatOre,
        maximumTotalIncVatOre: quote?.maximumTotalIncVatOre,
        depositBasisPoints: quote?.depositBasisPoints,
        depositAmountIncVatOre: quote?.depositAmountIncVatOre,
        signedAt: item.signedAt,
        companySignedAt: item.companySignedAt,
        createdAt: item.createdAt,
        documentHash: item.documentHash,
      };
    },
  );

  return {
    workingQuote: quoteVersions.find((item) => item.id === workingQuoteRaw?.id),
    workingContract: contractVersions.find(
      (item) => item.id === workingContractRaw?.id,
    ),
    effectiveContract: contractVersions.find(
      (item) => item.id === effectiveContractRaw?.id,
    ),
    quoteVersions,
    contractVersions,
  };
}
