export const adminDocumentTypes = [
  "all",
  "quote",
  "contract_draft",
  "customer_signed",
  "final_contract",
  "change_agreement",
  "work_documentation",
  "measurement",
  "invoice_draft",
  "official_invoice",
  "warranty",
] as const;
export type AdminDocumentType = (typeof adminDocumentTypes)[number];

export type AdminDocumentItem = {
  caseHref: string;
  createdAt?: string;
  customer: string;
  filename: string;
  hash?: string;
  href: string;
  id: string;
  leadId: number;
  reference: string;
  status?: string;
  type: Exclude<AdminDocumentType, "all">;
  version?: number;
};

export function isMetadataOnlyDocument(
  item: Pick<AdminDocumentItem, "type" | "filename" | "href">,
) {
  return (
    (item.type === "invoice_draft" || item.type === "warranty") &&
    item.filename === "" &&
    item.href.startsWith("/admin-v2/cases/")
  );
}

/** Consecutive groups preserve the register's global keyset order. */
export function groupDocumentPage(items: AdminDocumentItem[]) {
  const groups: {
    key: string;
    caseHref: string;
    customer: string;
    leadId: number;
    documents: AdminDocumentItem[];
  }[] = [];
  for (const item of items) {
    const previous = groups[groups.length - 1];
    if (previous?.leadId === item.leadId) previous.documents.push(item);
    else
      groups.push({
        key: item.id,
        caseHref: item.caseHref,
        customer: item.customer,
        leadId: item.leadId,
        documents: [item],
      });
  }
  return groups;
}
