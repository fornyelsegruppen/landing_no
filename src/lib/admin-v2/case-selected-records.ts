import "server-only";
import type { Payload } from "payload";
import { withAdminReadConnection, type AdminReadUser } from "./admin-read-db";
import { parseCaseRecordId } from "./case-history-navigation";

export type SelectedCaseRecord = {
  kind: "invoice" | "warranty";
  id: number;
  reference: string;
  status: string;
  workReference?: string;
  documentId?: number;
  createdAt?: string;
  subtotalExVatOre?: number;
  vatOre?: number;
  totalIncVatOre?: number;
  issuedAt?: string;
  dueAt?: string;
  externalReference?: string;
  adminNote?: string;
  scope?: string;
  startsAt?: string;
  endsAt?: string;
  termsVersion?: string;
};

type Selection = {
  invoiceRecord?: string | string[];
  warrantyRecord?: string | string[];
};
const string = (value: unknown) =>
  typeof value === "string" ? value : undefined;
const date = (value: unknown) =>
  value instanceof Date ? value.toISOString() : string(value);
const amount = (value: unknown) => (value == null ? undefined : Number(value));

/** Exact, read-only historical metadata; never replaces current business DTOs. */
export async function loadCaseSelectedRecords(
  payload: Pick<Payload, "db">,
  user: AdminReadUser,
  leadId: number,
  selection: Selection,
): Promise<{ records: SelectedCaseRecord[]; unavailable: boolean }> {
  return withAdminReadConnection(payload, user, async (connection) => {
    if (!Number.isSafeInteger(leadId) || leadId <= 0 || leadId > 2147483647)
      return { records: [], unavailable: true };
    const records: SelectedCaseRecord[] = [];
    let unavailable = false;
    for (const kind of ["invoice", "warranty"] as const) {
      const requested =
        kind === "invoice" ? selection.invoiceRecord : selection.warrantyRecord;
      if (requested === undefined) continue;
      const id = parseCaseRecordId(requested);
      if (!id) {
        unavailable = true;
        continue;
      }
      // Only these two fixed schemas are selectable. Both ID and case ownership
      // are predicates before LIMIT, independent of the 100-row presentation cap.
      const fields =
        kind === "invoice"
          ? "r.subtotal_ex_vat_ore, r.vat_ore, r.total_inc_vat_ore, r.issued_at, r.due_at, r.external_reference, r.admin_note"
          : "r.scope, r.starts_at, r.ends_at, r.terms_version";
      const table = kind === "invoice" ? "invoice_records" : "warranties";
      const result = await connection.query(
        `
        SELECT r.id, r.reference, r.status::text, r.created_at,
          m.id AS document_id, w.reference AS work_reference, ${fields}
        FROM ${table} r
        LEFT JOIN private_media m ON m.id = r.document_id
        LEFT JOIN work_orders w ON w.id = r.work_order_id AND w.lead_id = $1::integer
        WHERE r.lead_id = $1::integer AND r.id = $2::integer LIMIT 1
      `,
        [leadId, id],
      );
      const row = result.rows[0];
      if (!row) {
        unavailable = true;
        continue;
      }
      records.push({
        kind,
        id: Number(row.id),
        reference: string(row.reference) ?? `#${id}`,
        status: string(row.status) ?? "",
        workReference: string(row.work_reference),
        documentId:
          row.document_id == null ? undefined : Number(row.document_id),
        createdAt: date(row.created_at),
        ...(kind === "invoice"
          ? {
              subtotalExVatOre: amount(row.subtotal_ex_vat_ore),
              vatOre: amount(row.vat_ore),
              totalIncVatOre: amount(row.total_inc_vat_ore),
              issuedAt: date(row.issued_at),
              dueAt: date(row.due_at),
              externalReference: string(row.external_reference),
              adminNote: string(row.admin_note),
            }
          : {
              scope: string(row.scope),
              startsAt: date(row.starts_at),
              endsAt: date(row.ends_at),
              termsVersion: string(row.terms_version),
            }),
      });
    }
    return { records, unavailable };
  });
}
