import "server-only";
import type { Payload } from "payload";
import { withAdminReadConnection, type AdminReadUser } from "./admin-read-db";
import type { AdminDocumentItem } from "./documents";
import {
  buildDocumentRegisterQuery,
  buildDocumentStatusFacetQuery,
  documentRegisterFilterFingerprint,
  encodeDocumentRegisterCursor,
  type DocumentRegisterDirection,
  type DocumentRegisterFilters,
} from "./document-register-query";

type Row = Record<string, unknown> & {
  id: string;
  lead_id: number;
  customer: string;
  reference: string;
  filename: string;
  href: string;
  case_href: string;
  type: AdminDocumentItem["type"];
  status: string | null;
  version: number | string | null;
  created_at: Date | string;
  hash: string | null;
  source_id: number | string;
  type_rank: number;
};

export type AdminDocumentRegister = {
  items: AdminDocumentItem[];
  statuses: string[];
  previousCursor?: string;
  nextCursor?: string;
};

/** Only a bounded page and status labels leave the guarded read transaction. */
export async function loadAdminDocumentRegister(
  payload: Pick<Payload, "db">,
  user: AdminReadUser,
  filters: DocumentRegisterFilters = {},
  cursor?: string,
  direction: DocumentRegisterDirection = "forward",
): Promise<AdminDocumentRegister> {
  return withAdminReadConnection(payload, user, async (connection) => {
    if (direction === "backward" && !cursor)
      throw new TypeError("Missing cursor");
    const query = buildDocumentRegisterQuery({ filters, cursor, direction });
    const result = await connection.query<Row>(query.text, query.values);
    const page = result.rows.slice(0, 25);
    if (query.reverseResults) page.reverse();
    const encode = (row: Row, target: DocumentRegisterDirection) =>
      encodeDocumentRegisterCursor({
        version: 1,
        direction: target,
        createdAt: new Date(row.created_at).toISOString(),
        typeRank: row.type_rank,
        sourceId: Number(row.source_id),
        filterFingerprint: documentRegisterFilterFingerprint(filters),
      });
    let previousCursor: string | undefined;
    let nextCursor: string | undefined;
    if (page.length) {
      const previous = encode(page[0], "backward");
      const next = encode(page[page.length - 1], "forward");
      // Probe the opposite boundary in the same snapshot. Never infer that
      // an old cursor still has neighbors after concurrent record changes.
      const opposite = direction === "forward" ? "backward" : "forward";
      const probe = buildDocumentRegisterQuery({
        filters,
        direction: opposite,
        cursor: opposite === "backward" ? previous : next,
      });
      const exists = await connection.query<{ present: boolean }>(
        `SELECT EXISTS (${probe.text}) AS present`,
        probe.values,
      );
      const more = result.rows.length > 25;
      if (direction === "forward" ? exists.rows[0]?.present : more)
        previousCursor = previous;
      if (direction === "forward" ? more : exists.rows[0]?.present)
        nextCursor = next;
    }
    const facet = buildDocumentStatusFacetQuery();
    const statuses = await connection.query<{ status: string }>(
      facet.text,
      facet.values,
    );
    return {
      items: page.map((row) => ({
        id: row.id,
        leadId: row.lead_id,
        customer: row.customer,
        reference: row.reference,
        filename: row.filename,
        href: row.href,
        caseHref: row.case_href,
        type: row.type,
        status: row.status ?? undefined,
        version: row.version === null ? undefined : Number(row.version),
        createdAt: new Date(row.created_at).toISOString(),
        hash: row.hash ?? undefined,
      })),
      statuses: statuses.rows.map((row) => row.status),
      previousCursor,
      nextCursor,
    };
  });
}
