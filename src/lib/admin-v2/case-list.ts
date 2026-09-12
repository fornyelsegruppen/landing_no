import type { Payload } from "payload";
import type { CaseNextActionKind } from "./case-read-model";
import {
  normalizeAdminListPagination,
  type AdminListPagination,
  type AdminListPaginationMeta,
} from "./pagination";
import { withAdminReadConnection, type AdminReadUser } from "./admin-read-db";

export const caseListStatusKeys = [
  "all",
  "open",
  "customer_waiting",
  "waiting_customer",
  "converted",
  "closed",
] as const;
export type CaseListStatus = (typeof caseListStatusKeys)[number];

export const caseListRecordStateKeys = [
  "active",
  "archived",
  "trashed",
  "all",
] as const;
export type CaseListRecordState = (typeof caseListRecordStateKeys)[number];

export type AdminCaseListFilters = {
  action?: CaseNextActionKind | "all";
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  recordState?: CaseListRecordState;
  status?: CaseListStatus;
  workerId?: number;
};

export type AdminCaseListItem = {
  archiveClassification?: string;
  assignedWorker?: string;
  createdAt?: string;
  customer: string;
  dueAt?: string;
  email?: string;
  href: string;
  id: number;
  inquiryType?: string;
  nextAction: CaseNextActionKind;
  overdue: boolean;
  phone?: string;
  postalAddress?: string;
  purgeAfter?: string;
  recordState: string;
  status?: string;
  workStatus?: string;
};

export type AdminCaseListResult = {
  items: AdminCaseListItem[];
  workers: Array<{ id: number; name: string }>;
};
export type AdminCaseListPagedResult = AdminCaseListResult &
  AdminListPaginationMeta;

type SqlCaseListRow = {
  id: number | string;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  house_number?: unknown;
  postal?: unknown;
  city?: unknown;
  inquiry_type?: unknown;
  status?: unknown;
  record_state?: unknown;
  archive_classification?: unknown;
  created_at?: unknown;
  next_action_at?: unknown;
  purge_after?: unknown;
  assigned_worker_name?: unknown;
  work_status?: unknown;
  next_action?: unknown;
};

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return undefined;
  return value;
}

export function normalizeCaseListFilters(
  input: AdminCaseListFilters,
): AdminCaseListFilters {
  const query =
    typeof input.query === "string"
      ? input.query.replace(/\s+/g, " ").trim().slice(0, 80)
      : undefined;
  const status =
    input.status &&
    (caseListStatusKeys as readonly string[]).includes(input.status)
      ? input.status
      : "all";
  const recordState =
    input.recordState &&
    (caseListRecordStateKeys as readonly string[]).includes(input.recordState)
      ? input.recordState
      : "active";
  return {
    action: input.action || "all",
    dateFrom: validDate(input.dateFrom),
    dateTo: validDate(input.dateTo),
    query: query || undefined,
    recordState,
    status,
    workerId:
      Number.isInteger(input.workerId) && Number(input.workerId) > 0
        ? Number(input.workerId)
        : undefined,
  };
}

function sqlParam(parameters: unknown[], value: unknown) {
  parameters.push(value);
  return `$${parameters.length}`;
}

function sqlText(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : undefined;
}

function sqlNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return undefined;
}

/**
 * Build the bounded registry query. All lead predicates are applied in the
 * state CTE, while action and worker predicates are applied to the derived
 * state before LIMIT/OFFSET. The count query and data query share this exact
 * CTE, so filtered totals cannot be inferred from a capped source page.
 */
function sqlCaseListQuery(filters: AdminCaseListFilters) {
  const parameters: unknown[] = [];
  const predicates: string[] = [];
  if (filters.recordState && filters.recordState !== "all") {
    predicates.push(
      `l.record_state::text = ${sqlParam(parameters, filters.recordState)}::text`,
    );
  }
  if (filters.status === "open") predicates.push(`l.status::text <> 'closed'`);
  else if (filters.status && filters.status !== "all") {
    predicates.push(
      `l.status::text = ${sqlParam(parameters, filters.status)}::text`,
    );
  }
  if (filters.dateFrom) {
    predicates.push(
      `l.created_at >= ${sqlParam(parameters, `${filters.dateFrom}T00:00:00.000Z`)}::timestamptz`,
    );
  }
  if (filters.dateTo) {
    predicates.push(
      `l.created_at <= ${sqlParam(parameters, `${filters.dateTo}T23:59:59.999Z`)}::timestamptz`,
    );
  }
  if (filters.query) {
    const query = sqlParam(parameters, `%${filters.query}%`);
    const identityPredicates = [
      `l.name ILIKE ${query}::text`,
      `l.email ILIKE ${query}::text`,
      `l.phone ILIKE ${query}::text`,
      `l.address ILIKE ${query}::text`,
      `l.house_number ILIKE ${query}::text`,
      `l.postal ILIKE ${query}::text`,
      `l.city ILIKE ${query}::text`,
      `EXISTS (SELECT 1 FROM "quotes" reference_quote WHERE reference_quote.lead_id = l.id AND reference_quote.reference ILIKE ${query}::text)`,
      `EXISTS (SELECT 1 FROM "contracts" reference_contract JOIN "quotes" contract_quote ON contract_quote.id = reference_contract.quote_id WHERE contract_quote.lead_id = l.id AND reference_contract.reference ILIKE ${query}::text)`,
      `EXISTS (SELECT 1 FROM "work_orders" reference_work WHERE reference_work.lead_id = l.id AND reference_work.reference ILIKE ${query}::text)`,
    ];
    if (/^\d+$/.test(filters.query)) {
      identityPredicates.push(
        `l.id = ${sqlParam(parameters, Number(filters.query))}::integer`,
      );
    }
    predicates.push(`(${identityPredicates.join(" OR ")})`);
  }

  const stateWhere = predicates.length
    ? `WHERE ${predicates.join(" AND ")}`
    : "";
  const actionWhere: string[] = [];
  if (filters.action && filters.action !== "all") {
    actionWhere.push(
      `derived.next_action = ${sqlParam(parameters, filters.action)}::text`,
    );
  }
  if (filters.workerId) {
    actionWhere.push(
      `derived.assigned_worker_id = ${sqlParam(parameters, filters.workerId)}::integer`,
    );
  }
  const derivedWhere = actionWhere.length
    ? `WHERE ${actionWhere.join(" AND ")}`
    : "";

  const cte = `
WITH state AS (
  SELECT
    l.id, l.name, l.email, l.phone, l.address, l.house_number, l.postal,
    l.city, l.inquiry_type, l.status, l.record_state, l.archive_classification,
    l.created_at, l.next_action_at, l.purge_after, l.next_action_blocker,
    l.assigned_to_id,
    measurement.id AS measurement_id, measurement.status AS measurement_status,
    price.id AS price_id, price.status AS price_status,
    quote.id AS quote_id, quote.status AS quote_status,
    contract.id AS contract_id, contract.status AS contract_status,
    contract.company_signed_at,
    message.id AS message_id, message.status AS message_status,
    message.category AS message_category, message.direction AS message_direction,
    message.subject AS message_subject,
    message.reply_to_message_id,
    message.ai_analysis AS message_ai_analysis,
    work_order.id AS work_order_id, work_order.status AS work_status,
    work_order.assigned_worker_id AS work_assigned_worker_id,
    COALESCE(work_worker.display_name, assigned_worker.display_name) AS assigned_worker_name,
    work_order.documentation_submitted_at
  FROM "leads" l
  LEFT JOIN LATERAL (
    SELECT id, status FROM "roof_measurements"
    WHERE lead_id = l.id
    ORDER BY (status IS NOT DISTINCT FROM 'superseded') ASC, created_at DESC, id DESC
    LIMIT 1
  ) measurement ON TRUE
  LEFT JOIN LATERAL (
    SELECT id, status FROM "price_calculations"
    WHERE lead_id = l.id
    ORDER BY (status IS NOT DISTINCT FROM 'superseded') ASC, created_at DESC, id DESC
    LIMIT 1
  ) price ON TRUE
  LEFT JOIN LATERAL (
    SELECT id, status, version FROM "quotes"
    WHERE lead_id = l.id
    ORDER BY
      COALESCE(status IN ('expired', 'revoked', 'superseded'), FALSE) ASC,
      COALESCE(version, 0) DESC,
      CASE status
        WHEN 'accepted' THEN 80
        WHEN 'viewed' THEN 70
        WHEN 'sent' THEN 60
        WHEN 'approved' THEN 50
        WHEN 'draft' THEN 40
        WHEN 'declined' THEN 30
        ELSE 0
      END DESC,
      id DESC
    LIMIT 1
  ) quote ON TRUE
  LEFT JOIN LATERAL (
    SELECT id, status, company_signed_at FROM "contracts"
    WHERE quote_id = quote.id
       OR quote_id IN (
         SELECT related_quote.id FROM "quotes" related_quote
         WHERE related_quote.lead_id = l.id
       )
    ORDER BY
      CASE
        WHEN quote_id = quote.id
          AND (status IS NULL OR status NOT IN ('revoked', 'superseded')) THEN 0
        WHEN status IS DISTINCT FROM 'superseded' THEN 1
        ELSE 2
      END,
      COALESCE(version, 0) DESC, id DESC
    LIMIT 1
  ) contract ON TRUE
  LEFT JOIN LATERAL (
    SELECT id, status, category, direction, subject, reply_to_message_id, ai_analysis, created_at
    FROM "messages"
    WHERE lead_id = l.id
      AND NOT (
        COALESCE(category::text, '') = 'ai_reply'
        AND status IS NOT DISTINCT FROM 'cancelled'
      )
      AND NOT (
        quote.id IS NOT NULL AND quote.status::text IS DISTINCT FROM 'draft'
        AND COALESCE(category::text, '') = 'ai_reply'
        AND COALESCE(status::text, '') = 'draft'
        AND reply_to_message_id IS NULL
      )
    ORDER BY
      CASE WHEN status IN ('failed', 'attention', 'draft')
        AND NOT EXISTS (
          SELECT 1 FROM "messages" newer
          WHERE newer.lead_id = "messages".lead_id
            AND newer.subject IS NOT DISTINCT FROM "messages".subject
            AND newer.category IS NOT DISTINCT FROM "messages".category
            AND newer.status IN ('approved', 'queued', 'sent', 'delivered')
            AND newer.created_at > "messages".created_at
        ) THEN 0 ELSE 1 END,
      created_at DESC, id DESC
    LIMIT 1
  ) message ON TRUE
  LEFT JOIN LATERAL (
    SELECT id, status, assigned_worker_id, documentation_submitted_at
    FROM "work_orders"
    WHERE lead_id = l.id
    ORDER BY (status IS NOT DISTINCT FROM 'cancelled') ASC,
      created_at DESC, id DESC
    LIMIT 1
  ) work_order ON TRUE
  LEFT JOIN "users" work_worker ON work_worker.id = work_order.assigned_worker_id
  LEFT JOIN "users" assigned_worker ON assigned_worker.id = l.assigned_to_id
  ${stateWhere}
), derived AS (
  SELECT state.*,
    COALESCE(work_assigned_worker_id, assigned_to_id) AS assigned_worker_id,
    CASE
      WHEN next_action_blocker = 'CUSTOMER_CANCELLATION_REQUEST' THEN 'review_cancellation'
      WHEN message_status IN ('failed', 'attention') THEN 'retry_message'
      WHEN message_status = 'draft'
        AND (message_ai_analysis ->> 'customerContractRequestId') ~ '^[1-9][0-9]*$'
        AND message_ai_analysis ->> 'decision' IN ('close', 'do_not_contact')
        THEN 'send_closure_confirmation'
      WHEN message_status = 'draft' AND NOT (
        COALESCE(message_category::text, '') = 'ai_reply'
        AND NULLIF(address, '') IS NOT NULL
        AND address !~* '^ikke oppgitt$'
        AND inquiry_type IS DISTINCT FROM 'usikker'
      ) THEN 'approve_message'
      WHEN status = 'closed' THEN 'none'
      WHEN quote_status = 'declined' THEN 'follow_up_decline'
      WHEN work_status = 'unassigned' THEN 'assign_worker'
      WHEN work_status = 'assigned' THEN 'schedule_work'
      WHEN work_status = 'blocked' THEN 'resolve_work_block'
      WHEN work_status = 'completed' AND documentation_submitted_at IS NOT NULL THEN 'review_completion'
      WHEN work_status = 'completed' THEN 'wait_worker_documentation'
      WHEN work_status = 'scheduled' THEN 'wait_scheduled_start'
      WHEN work_status IN ('on_way', 'arrived', 'precheck', 'ready') THEN 'wait_worker_precheck'
      WHEN work_status = 'in_progress' THEN 'wait_work_completion'
      WHEN work_status IN ('documented', 'cancelled') THEN 'none'
      WHEN quote_status = 'accepted' AND contract_status = 'signed' AND company_signed_at IS NULL THEN 'company_sign_contract'
      WHEN quote_status = 'accepted' AND contract_status = 'signed' AND company_signed_at IS NOT NULL AND work_order_id IS NULL THEN 'create_work_order'
      WHEN message_direction = 'inbound' AND message_category::text = 'customer_question' THEN 'prepare_question_reply'
      WHEN message_id IS NULL OR message_direction = 'inbound' THEN 'generate_reply'
      WHEN measurement_id IS NULL THEN 'prepare_package'
      WHEN measurement_status IN ('draft', 'review_required') AND price_id IS NOT NULL AND quote_status = 'draft' AND contract_status = 'draft' THEN 'approve_package'
      WHEN measurement_status IN ('draft', 'review_required') THEN 'approve_measurement'
      WHEN measurement_status = 'blocked' THEN 'measurement_required'
      WHEN measurement_status = 'approved' AND price_id IS NULL THEN 'calculate_price'
      WHEN price_status = 'ready' AND quote_id IS NULL THEN 'create_quote'
      WHEN quote_status = 'draft' THEN 'approve_quote'
      WHEN quote_status = 'approved' THEN 'issue_quote'
      WHEN quote_status IN ('sent', 'viewed') THEN 'wait_customer'
      ELSE 'none'
    END AS next_action
  FROM state
), filtered AS (
  SELECT * FROM derived
  ${derivedWhere}
)`;
  return { cte, parameters };
}

function mapCaseRow(row: SqlCaseListRow): AdminCaseListItem {
  const id = sqlNumber(row.id) || 0;
  const dueAt = sqlText(row.next_action_at);
  return {
    archiveClassification: sqlText(row.archive_classification),
    assignedWorker: sqlText(row.assigned_worker_name),
    createdAt: sqlText(row.created_at),
    customer: sqlText(row.name) || `#${id}`,
    dueAt,
    email: sqlText(row.email),
    href: `/admin-v2/cases/${id}`,
    id,
    inquiryType: sqlText(row.inquiry_type),
    nextAction: (sqlText(row.next_action) || "none") as CaseNextActionKind,
    overdue: Boolean(dueAt && new Date(dueAt).getTime() <= Date.now()),
    phone: sqlText(row.phone),
    postalAddress: [
      sqlText(row.address),
      sqlText(row.house_number),
      sqlText(row.postal),
      sqlText(row.city),
    ]
      .filter(Boolean)
      .join(" "),
    purgeAfter: sqlText(row.purge_after),
    recordState: sqlText(row.record_state) || "active",
    status: sqlText(row.status),
    workStatus: sqlText(row.work_status),
  };
}

async function loadAdminCaseListFromSql(
  payload: Pick<Payload, "db">,
  user: AdminReadUser,
  filters: AdminCaseListFilters,
  page: Required<AdminListPagination>,
): Promise<AdminCaseListPagedResult> {
  const { cte, parameters } = sqlCaseListQuery(filters);
  return withAdminReadConnection(payload, user, async (connection) => {
    const workerResult = await connection.query<{
      id: number | string;
      display_name?: unknown;
      email?: unknown;
    }>(
      `SELECT id, display_name, email FROM "users"
       WHERE role = 'worker' AND active = TRUE
       ORDER BY display_name ASC NULLS LAST, id ASC
       LIMIT 50`,
    );
    const workers = workerResult.rows
      .map((worker) => ({
        id: sqlNumber(worker.id) || 0,
        name:
          sqlText(worker.display_name) ||
          sqlText(worker.email) ||
          `#${sqlNumber(worker.id)}`,
      }))
      .filter((worker) => worker.id > 0);

    const countResult = await connection.query<{ total_docs: number | string }>(
      `${cte} SELECT count(*) AS total_docs FROM filtered`,
      parameters,
    );
    const totalDocs = Number(countResult.rows[0]?.total_docs || 0);
    const dataParameters = [
      ...parameters,
      page.limit,
      (page.page - 1) * page.limit,
    ];
    const rows = await connection.query<SqlCaseListRow>(
      `${cte}
SELECT id, name, email, phone, address, house_number, postal, city,
  inquiry_type, status, record_state, archive_classification, created_at,
  next_action_at, purge_after, assigned_worker_name, work_status, next_action
FROM filtered
ORDER BY created_at DESC NULLS LAST, id DESC
LIMIT $${dataParameters.length - 1}::integer OFFSET $${dataParameters.length}::integer`,
      dataParameters,
    );
    return {
      items: rows.rows.map(mapCaseRow),
      workers,
      hasNextPage: page.page * page.limit < totalDocs,
      hasPrevPage: page.page > 1,
      page: page.page,
      totalDocs,
      totalPages: Math.max(1, Math.ceil(totalDocs / page.limit)),
    };
  });
}

export async function loadAdminCaseList(
  payload: Pick<Payload, "db">,
  rawFilters: AdminCaseListFilters = {},
  pagination: AdminListPagination = {},
  user: AdminReadUser = null,
): Promise<AdminCaseListPagedResult> {
  const filters = normalizeCaseListFilters(rawFilters);
  const page = normalizeAdminListPagination(
    pagination,
  ) as Required<AdminListPagination>;
  return loadAdminCaseListFromSql(payload, user, filters, page);
}
