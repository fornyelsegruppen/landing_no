import "server-only";
import type { Payload } from "payload";
import type { CaseDocument, CaseHistoryPage } from "./case-read-model";
import {
  caseHistoryPageSize,
  normalizeCaseHistoryPage,
} from "./case-read-model";
import { withAdminReadConnection, type AdminReadUser } from "./admin-read-db";

// Ownership is established against all related rows, not a DTO's current
// measurement/order/invoice or a capped array of quote/contract versions.
export const caseMediaOwnerPredicate = `(
  (m.owner_type = 'lead' AND m.owner_id = $1::integer::text)
  OR (m.owner_type = 'roof-measurement' AND EXISTS (
    SELECT 1 FROM roof_measurements e WHERE e.lead_id = $1 AND e.id::text = m.owner_id
  ))
  OR (m.owner_type = 'quote' AND EXISTS (
    SELECT 1 FROM quotes e WHERE e.lead_id = $1 AND e.id::text = m.owner_id
  ))
  OR (m.owner_type = 'contract' AND EXISTS (
    SELECT 1 FROM contracts e JOIN quotes q ON q.id = e.quote_id
    WHERE q.lead_id = $1 AND e.id::text = m.owner_id
  ))
  OR (m.owner_type IN ('work-order', 'work', 'completion-certificate') AND EXISTS (
    SELECT 1 FROM work_orders e WHERE e.lead_id = $1 AND e.id::text = m.owner_id
  ))
  OR (m.owner_type = 'change-agreement' AND EXISTS (
    SELECT 1 FROM change_agreements e JOIN work_orders w ON w.id = e.work_order_id
    WHERE w.lead_id = $1 AND e.id::text = m.owner_id
  ))
  OR (m.owner_type = 'invoice-record' AND EXISTS (
    SELECT 1 FROM invoice_records e WHERE e.lead_id = $1 AND e.id::text = m.owner_id
  ))
  OR (m.owner_type = 'warranty' AND EXISTS (
    SELECT 1 FROM warranties e WHERE e.lead_id = $1 AND e.id::text = m.owner_id
  ))
)`;

export async function loadCaseDocumentHistory(
  payload: Pick<Payload, "db">,
  user: AdminReadUser,
  leadId: number,
  requestedPage: unknown,
): Promise<CaseHistoryPage<CaseDocument>> {
  if (!Number.isSafeInteger(leadId) || leadId <= 0)
    throw new Error("INVALID_CASE_ID");
  return withAdminReadConnection(payload, user, async (connection) => {
    const count = await connection.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM private_media m WHERE ${caseMediaOwnerPredicate}`,
      [leadId],
    );
    const totalDocs = Number(count.rows[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalDocs / caseHistoryPageSize));
    const page = Math.min(normalizeCaseHistoryPage(requestedPage), totalPages);
    const result = await connection.query<{
      id: number;
      filename: string | null;
      classification: string | null;
      createdAt: string;
      mimeType: string | null;
      ownerId: string | null;
      ownerType: string | null;
    }>(
      `SELECT m.id, m.filename, m.classification::text AS classification,
        to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
        m.mime_type AS "mimeType", m.owner_id AS "ownerId", m.owner_type AS "ownerType"
       FROM private_media m WHERE ${caseMediaOwnerPredicate}
       ORDER BY m.created_at DESC, m.id DESC LIMIT $2 OFFSET $3`,
      [leadId, caseHistoryPageSize, (page - 1) * caseHistoryPageSize],
    );
    return {
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      page,
      totalDocs,
      totalPages,
      items: result.rows.map((row) => ({
        id: row.id,
        filename: row.filename || `#${row.id}`,
        classification: row.classification || undefined,
        createdAt: row.createdAt,
        mimeType: row.mimeType || undefined,
        ownerId: row.ownerId || undefined,
        ownerType: row.ownerType || undefined,
        href: `/api/admin/media/${row.id}`,
      })),
    };
  });
}
