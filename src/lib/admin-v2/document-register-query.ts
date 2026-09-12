export const documentRegisterLimit = 26;
export const documentRegisterSearchLimit = 80;

export const documentRegisterTypes = [
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

export type DocumentRegisterType = (typeof documentRegisterTypes)[number];
export type DocumentRegisterDirection = "forward" | "backward";

export type DocumentRegisterFilters = {
  query?: string;
  status?: string;
  type?: DocumentRegisterType;
};

export type DocumentRegisterCursor = {
  version: 1;
  direction: DocumentRegisterDirection;
  createdAt: string;
  typeRank: number;
  sourceId: number;
  filterFingerprint: string;
};

export type DocumentRegisterQuery = {
  text: string;
  values: unknown[];
  direction: DocumentRegisterDirection;
  reverseResults: boolean;
};

type ParamBuilder = {
  values: unknown[];
  parameter(value: unknown): string;
};

function params(): ParamBuilder {
  const values: unknown[] = [];
  return {
    values,
    parameter(value) {
      values.push(value);
      return `$${values.length}`;
    },
  };
}

function normalizeFilterValue(value: string | undefined) {
  return value?.trim().slice(0, documentRegisterSearchLimit) || "";
}

export function normalizeDocumentRegisterFilters(
  filters: DocumentRegisterFilters = {},
) {
  return {
    query: normalizeFilterValue(filters.query),
    status: filters.status && filters.status !== "all" ? filters.status : "",
    type: filters.type && filters.type !== "all" ? filters.type : "",
  };
}

export function documentRegisterFilterFingerprint(filters: DocumentRegisterFilters = {}) {
  const value = JSON.stringify(normalizeDocumentRegisterFilters(filters));
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isDirection(value: unknown): value is DocumentRegisterDirection {
  return value === "forward" || value === "backward";
}

function isCursor(value: unknown): value is DocumentRegisterCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Partial<DocumentRegisterCursor>;
  return (
    cursor.version === 1 &&
    isDirection(cursor.direction) &&
    typeof cursor.createdAt === "string" &&
    Number.isFinite(Date.parse(cursor.createdAt)) &&
    typeof cursor.typeRank === "number" &&
    Number.isSafeInteger(cursor.typeRank) &&
    cursor.typeRank >= 1 &&
    cursor.typeRank <= 10 &&
    typeof cursor.sourceId === "number" &&
    Number.isSafeInteger(cursor.sourceId) &&
    cursor.sourceId > 0 &&
    typeof cursor.filterFingerprint === "string" &&
    /^[0-9a-f]{8}$/.test(cursor.filterFingerprint)
  );
}

export function encodeDocumentRegisterCursor(cursor: DocumentRegisterCursor) {
  if (!isCursor(cursor)) throw new TypeError("Invalid document register cursor");
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDocumentRegisterCursor(
  encoded: string,
  filters: DocumentRegisterFilters = {},
  direction: DocumentRegisterDirection = "forward",
): DocumentRegisterCursor {
  if (typeof encoded !== "string" || encoded.length > 512) {
    throw new TypeError("Invalid document register cursor");
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      !isCursor(decoded) ||
      decoded.direction !== direction ||
      decoded.filterFingerprint !== documentRegisterFilterFingerprint(filters)
    ) {
      throw new TypeError("Document register cursor does not match the filters");
    }
    return decoded;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError("Invalid document register cursor");
  }
}

function literal(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

type Branch = {
  type: Exclude<DocumentRegisterType, "all">;
  rank: number;
  sourceId: string;
  leadId: string;
  customer: string;
  reference: string;
  filename: string;
  href: string;
  status: string;
  version: string;
  createdAt: string;
  hash: string;
  from: string;
  required: string;
};

const branches: readonly Branch[] = [
  {
    type: "quote",
    rank: 1,
    sourceId: "q.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(q.reference, ''), '#' || q.id::text)",
    filename: "COALESCE(NULLIF(q.reference, ''), q.id::text) || '.pdf'",
    href: "'/api/admin/quotes/' || q.id::text || '/pdf'",
    status: "q.status::text",
    version: "q.version::numeric",
    createdAt: "q.created_at::timestamptz",
    hash: "q.snapshot_hash::text",
    from: '"quotes" q JOIN "leads" l ON l.id = q.lead_id',
    required: "TRUE",
  },
  {
    type: "contract_draft",
    rank: 2,
    sourceId: "c.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(c.reference, ''), '#' || c.id::text)",
    filename: "COALESCE(NULLIF(c.reference, ''), c.id::text) || '.pdf'",
    href: "'/api/admin/quotes/' || q.id::text || '/pdf'",
    status: "c.status::text",
    version: "c.version::numeric",
    createdAt: "c.created_at::timestamptz",
    hash: "c.document_hash::text",
    from: '"contracts" c JOIN "quotes" q ON q.id = c.quote_id JOIN "leads" l ON l.id = q.lead_id LEFT JOIN "private_media" sm ON sm.id = c.signed_document_id LEFT JOIN "private_media" fm ON fm.id = c.company_signed_document_id',
    required: "sm.id IS NULL AND fm.id IS NULL",
  },
  {
    type: "customer_signed",
    rank: 3,
    sourceId: "c.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(c.reference, ''), '#' || c.id::text)",
    filename: "COALESCE(NULLIF(sm.filename, ''), COALESCE(NULLIF(c.reference, ''), c.id::text) || '.pdf')",
    href: "'/api/admin/media/' || sm.id::text",
    status: "c.status::text",
    version: "c.version::numeric",
    createdAt: "c.created_at::timestamptz",
    hash: "c.document_hash::text",
    from: '"contracts" c JOIN "quotes" q ON q.id = c.quote_id JOIN "leads" l ON l.id = q.lead_id JOIN "private_media" sm ON sm.id = c.signed_document_id',
    required: "TRUE",
  },
  {
    type: "final_contract",
    rank: 4,
    sourceId: "c.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(c.reference, ''), '#' || c.id::text)",
    filename: "COALESCE(NULLIF(fm.filename, ''), COALESCE(NULLIF(c.reference, ''), c.id::text) || '.pdf')",
    href: "'/api/admin/media/' || fm.id::text",
    status: "c.status::text",
    version: "c.version::numeric",
    createdAt: "c.created_at::timestamptz",
    hash: "c.document_hash::text",
    from: '"contracts" c JOIN "quotes" q ON q.id = c.quote_id JOIN "leads" l ON l.id = q.lead_id JOIN "private_media" fm ON fm.id = c.company_signed_document_id',
    required: "TRUE",
  },
  {
    type: "change_agreement",
    rank: 5,
    sourceId: "a.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(a.reference, ''), '#' || a.id::text)",
    filename: "COALESCE(NULLIF(m.filename, ''), COALESCE(NULLIF(a.reference, ''), a.id::text) || '.pdf')",
    href: "'/api/admin/media/' || m.id::text",
    status: "a.status::text",
    version: "a.version::numeric",
    createdAt: "a.created_at::timestamptz",
    hash: "a.document_hash::text",
    from: '"change_agreements" a JOIN "work_orders" w ON w.id = a.work_order_id JOIN "leads" l ON l.id = w.lead_id JOIN "private_media" m ON m.id = a.accepted_document_id',
    required: "TRUE",
  },
  {
    type: "work_documentation",
    rank: 6,
    sourceId: "m.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(w.reference, ''), '#' || m.id::text)",
    filename: "COALESCE(NULLIF(m.filename, ''), '#' || m.id::text)",
    href: "'/api/admin/media/' || m.id::text",
    status: "w.status::text",
    version: "NULL::numeric",
    createdAt: "m.created_at::timestamptz",
    hash: "NULL::text",
    from: '"private_media" m JOIN "work_orders" w ON m.owner_type IN (\'work-order\', \'work\') AND m.owner_id = w.id::text JOIN "leads" l ON l.id = w.lead_id',
    required: "TRUE",
  },
  {
    type: "measurement",
    rank: 7,
    sourceId: "r.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(r.reference, ''), '#' || r.id::text)",
    filename: "COALESCE(NULLIF(m.filename, ''), 'measurement-' || r.id::text)",
    href: "'/api/admin/media/' || m.id::text",
    status: "r.status::text",
    version: "NULL::numeric",
    createdAt: "r.created_at::timestamptz",
    hash: "r.input_hash::text",
    from: '"roof_measurements" r JOIN "leads" l ON l.id = r.lead_id JOIN "private_media" m ON m.id = r.map_image_id',
    required: "TRUE",
  },
  {
    type: "invoice_draft",
    rank: 8,
    sourceId: "i.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(i.reference, ''), '#' || i.id::text)",
    filename: "CASE WHEN m.id IS NULL THEN '' ELSE COALESCE(NULLIF(m.filename, ''), COALESCE(NULLIF(i.reference, ''), i.id::text) || '.pdf') END",
    href: "CASE WHEN m.id IS NULL THEN '/admin-v2/cases/' || l.id::text || '?invoiceRecord=' || i.id::text || '#invoice-' || i.id::text ELSE '/api/admin/media/' || m.id::text END",
    status: "i.status::text",
    version: "NULL::numeric",
    createdAt: "i.created_at::timestamptz",
    hash: "CASE WHEN m.id IS NULL THEN NULL ELSE i.document_hash::text END",
    from: '"invoice_records" i JOIN "leads" l ON l.id = i.lead_id LEFT JOIN "private_media" m ON m.id = i.document_id',
    required: "TRUE",
  },
  {
    type: "official_invoice",
    rank: 9,
    sourceId: "i.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(i.invoice_number, ''), NULLIF(i.reference, ''), '#' || i.id::text)",
    filename: "COALESCE(NULLIF(m.filename, ''), COALESCE(NULLIF(i.invoice_number, ''), i.id::text) || '.pdf')",
    href: "'/api/admin/media/' || m.id::text",
    status: "i.status::text",
    version: "NULL::numeric",
    createdAt: "i.created_at::timestamptz",
    hash: "i.original_hash::text",
    from: '"official_invoices" i JOIN "leads" l ON l.id = i.lead_id JOIN "private_media" m ON m.id = i.original_document_id',
    required: "TRUE",
  },
  {
    type: "warranty",
    rank: 10,
    sourceId: "w.id",
    leadId: "l.id",
    customer: "COALESCE(NULLIF(l.name, ''), '#' || l.id::text)",
    reference: "COALESCE(NULLIF(w.reference, ''), '#' || w.id::text)",
    filename: "CASE WHEN m.id IS NULL THEN '' ELSE COALESCE(NULLIF(m.filename, ''), COALESCE(NULLIF(w.reference, ''), w.id::text) || '.pdf') END",
    href: "CASE WHEN m.id IS NULL THEN '/admin-v2/cases/' || l.id::text || '?warrantyRecord=' || w.id::text || '#warranty-' || w.id::text ELSE '/api/admin/media/' || m.id::text END",
    status: "w.status::text",
    version: "NULL::numeric",
    createdAt: "w.created_at::timestamptz",
    hash: "CASE WHEN m.id IS NULL THEN NULL ELSE w.document_hash::text END",
    from: '"warranties" w JOIN "leads" l ON l.id = w.lead_id LEFT JOIN "private_media" m ON m.id = w.document_id',
    required: "TRUE",
  },
];

function selectedBranches(type?: DocumentRegisterType) {
  return type && type !== "all"
    ? branches.filter((branch) => branch.type === type)
    : branches;
}

function whereFor(
  branch: Branch,
  filter: ReturnType<typeof normalizeDocumentRegisterFilters>,
  builder: ParamBuilder,
  cursor?: DocumentRegisterCursor,
  includeStatus = true,
) {
  const where = [branch.required];
  if (filter.query) {
    const search = builder.parameter(escapeLike(filter.query));
    const fields = [branch.customer, branch.reference, branch.filename, `${branch.leadId}::text`];
    where.push(
      `(${fields.map((field) => `COALESCE(${field}::text, '') ILIKE '%' || ${search} || '%' ESCAPE CHR(92)`).join(" OR ")})`,
    );
  }
  if (includeStatus && filter.status) {
    where.push(`${branch.status} = ${builder.parameter(filter.status)}`);
  }
  if (cursor) {
    const created = builder.parameter(cursor.createdAt);
    const rank = builder.parameter(cursor.typeRank);
    const source = builder.parameter(cursor.sourceId);
    const boundary =
      cursor.direction === "forward"
        ? `(${branch.createdAt} < ${created}::timestamptz OR (${branch.createdAt} = ${created}::timestamptz AND (${branch.rank} > ${rank} OR (${branch.rank} = ${rank} AND ${branch.sourceId} < ${source}))))`
        : `(${branch.createdAt} > ${created}::timestamptz OR (${branch.createdAt} = ${created}::timestamptz AND (${branch.rank} < ${rank} OR (${branch.rank} = ${rank} AND ${branch.sourceId} > ${source}))))`;
    where.push(boundary);
  }
  return where.join(" AND ");
}

function branchSelect(
  branch: Branch,
  filter: ReturnType<typeof normalizeDocumentRegisterFilters>,
  builder: ParamBuilder,
  cursor?: DocumentRegisterCursor,
  includeStatus = true,
  withLimit = true,
) {
  const where = whereFor(branch, filter, builder, cursor, includeStatus);
  const order = cursor?.direction === "backward"
    ? `${branch.createdAt} ASC, ${branch.sourceId} ASC`
    : `${branch.createdAt} DESC, ${branch.sourceId} DESC`;
  return `SELECT ${literal(branch.type)} || '-' || ${branch.sourceId}::text AS id, ${branch.leadId}::integer AS lead_id, ${branch.customer}::text AS customer, ${branch.reference}::text AS reference, ${branch.filename}::text AS filename, ${branch.href}::text AS href, '/admin-v2/cases/' || ${branch.leadId}::text AS case_href, ${literal(branch.type)}::text AS type, ${branch.status}::text AS status, ${branch.version} AS version, ${branch.createdAt}::timestamptz AS created_at, ${branch.hash}::text AS hash, ${branch.sourceId}::bigint AS source_id, ${branch.rank}::integer AS type_rank FROM ${branch.from} WHERE ${where}${withLimit ? ` ORDER BY ${order} LIMIT ${documentRegisterLimit}` : ""}`;
}

function orderFor(direction: DocumentRegisterDirection) {
  return direction === "forward"
    ? "created_at DESC, type_rank ASC, source_id DESC"
    : "created_at ASC, type_rank DESC, source_id ASC";
}

export function buildDocumentRegisterQuery(input: {
  filters?: DocumentRegisterFilters;
  direction?: DocumentRegisterDirection;
  cursor?: string | null;
} = {}): DocumentRegisterQuery {
  const filters = input.filters || {};
  const direction = input.direction || "forward";
  if (direction === "backward" && !input.cursor) {
    throw new TypeError("A backward document register query requires a cursor");
  }
  const builder = params();
  const normalized = normalizeDocumentRegisterFilters(filters);
  const cursor = input.cursor
    ? decodeDocumentRegisterCursor(input.cursor, filters, direction)
    : undefined;
  const selected = selectedBranches(filters.type);
  const union = selected.map((branch) => `(${branchSelect(branch, normalized, builder, cursor)})`).join(" UNION ALL ");
  return {
    text: `SELECT id, lead_id, customer, reference, filename, href, case_href, type, status, version, created_at, hash, source_id, type_rank FROM (${union}) AS document_candidates ORDER BY ${orderFor(direction)} LIMIT ${documentRegisterLimit}`,
    values: builder.values,
    direction,
    reverseResults: direction === "backward",
  };
}

export function buildDocumentStatusFacetQuery(
  filters: DocumentRegisterFilters = {},
): { text: string; values: unknown[] } {
  const builder = params();
  const normalized = normalizeDocumentRegisterFilters(filters);
  const union = selectedBranches(filters.type)
    .map((branch) => `SELECT ${branch.status}::text AS status FROM ${branch.from} WHERE ${whereFor(branch, normalized, builder, undefined, false)}`)
    .join(" UNION ALL ");
  return {
    text: `SELECT DISTINCT status FROM (${union}) AS document_statuses WHERE status IS NOT NULL ORDER BY status`,
    values: builder.values,
  };
}
