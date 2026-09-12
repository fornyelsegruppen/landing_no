import "server-only";
import type { Payload } from "payload";
import { withAdminReadConnection, type AdminReadUser } from "./admin-read-db";

export type CaseCurrentSelection = {
  measurementId: number | null;
  priceId: number | null;
  workingQuoteId: number | null;
  workingContractId: number | null;
  actionContractId: number | null;
  effectiveContractId: number | null;
  effectiveQuoteId: number | null;
  workOrderId: number | null;
  messageId: number | null;
};

type SelectionRow = {
  measurement_id: number | string | null;
  price_id: number | string | null;
  working_quote_id: number | string | null;
  working_contract_id: number | string | null;
  action_contract_id: number | string | null;
  effective_contract_id: number | string | null;
  effective_quote_id: number | string | null;
  work_order_id: number | string | null;
  message_id: number | string | null;
};

const currentSelectionSql = `
WITH quote_ranked AS (
  SELECT
    q.id,
    q.status::text AS status,
    COALESCE(q.version::numeric, 0) AS version,
    CASE q.status::text
      WHEN 'accepted' THEN 80
      WHEN 'viewed' THEN 70
      WHEN 'sent' THEN 60
      WHEN 'approved' THEN 50
      WHEN 'draft' THEN 40
      WHEN 'declined' THEN 30
      ELSE 0
    END AS status_priority
  FROM quotes q
  WHERE q.lead_id = $1::integer
),
working_quote AS (
  SELECT id, status
  FROM quote_ranked
  ORDER BY
    CASE
      WHEN status IS NULL OR status NOT IN ('superseded', 'revoked', 'expired')
        THEN 0
      ELSE 1
    END,
    version DESC,
    status_priority DESC,
    id DESC
  LIMIT 1
),
working_contract AS (
  SELECT c.id
  FROM contracts c
  JOIN quotes owner_quote
    ON owner_quote.id = c.quote_id
   AND owner_quote.lead_id = $1::integer
  WHERE (
    (
      EXISTS (SELECT 1 FROM working_quote)
      AND c.quote_id = (SELECT id FROM working_quote)
      AND (
        c.status::text IS NULL
        OR c.status::text NOT IN ('superseded', 'revoked')
      )
    )
    OR NOT EXISTS (SELECT 1 FROM working_quote)
  )
  ORDER BY
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM working_quote)
       AND (c.status::text IS NULL OR c.status::text NOT IN ('superseded', 'revoked'))
        THEN 0
      WHEN NOT EXISTS (SELECT 1 FROM working_quote) THEN 1
      ELSE 0
    END,
    COALESCE(c.version::numeric, 0) DESC,
    c.id DESC
  LIMIT 1
),
effective_contract AS (
  SELECT c.id, c.quote_id
  FROM contracts c
  JOIN quotes q ON q.id = c.quote_id AND q.lead_id = $1::integer
  WHERE c.status::text = 'signed' AND c.company_signed_at IS NOT NULL
  ORDER BY COALESCE(c.version::numeric, 0) DESC, c.id DESC
  LIMIT 1
),
visible_messages AS (
  SELECT m.id, m.status, m.category, m.subject, m.created_at
  FROM messages m
  WHERE m.lead_id = $1::integer
    AND NOT COALESCE(m.category::text = 'ai_reply' AND m.status::text = 'cancelled', false)
    AND NOT COALESCE(
      m.category::text = 'ai_reply'
      AND m.status::text = 'draft'
      AND m.reply_to_message_id IS NULL
      AND EXISTS (SELECT 1 FROM working_quote)
      AND (SELECT status FROM working_quote) IS DISTINCT FROM 'draft'
    , false)
),
priority_message AS (
  SELECT m.id
  FROM visible_messages m
  WHERE m.status::text IN ('failed', 'attention', 'draft')
    AND NOT EXISTS (
      SELECT 1
      FROM visible_messages newer
      WHERE newer.status::text IN ('approved', 'queued', 'sent', 'delivered')
        AND newer.subject IS NOT DISTINCT FROM m.subject
        AND newer.category IS NOT DISTINCT FROM m.category
        AND newer.created_at > m.created_at
    )
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT 1
),
latest_message AS (
  SELECT id
  FROM visible_messages
  ORDER BY created_at DESC, id DESC
  LIMIT 1
),
latest_action_contract AS (
  SELECT c.id
  FROM contracts c
  JOIN quotes owner_quote
    ON owner_quote.id = c.quote_id
   AND owner_quote.lead_id = $1::integer
  WHERE c.status::text IS DISTINCT FROM 'superseded'
  ORDER BY COALESCE(c.version::numeric, 0) DESC, c.id DESC
  LIMIT 1
),
fallback_action_contract AS (
  SELECT c.id
  FROM contracts c
  JOIN quotes owner_quote
    ON owner_quote.id = c.quote_id
   AND owner_quote.lead_id = $1::integer
  ORDER BY COALESCE(c.version::numeric, 0) DESC, c.id DESC
  LIMIT 1
),
latest_measurement AS (
  SELECT id
  FROM roof_measurements
  WHERE lead_id = $1::integer AND status::text IS DISTINCT FROM 'superseded'
  ORDER BY created_at DESC, id DESC
  LIMIT 1
),
fallback_measurement AS (
  SELECT id
  FROM roof_measurements
  WHERE lead_id = $1::integer
  ORDER BY created_at DESC, id DESC
  LIMIT 1
),
latest_price AS (
  SELECT id
  FROM price_calculations
  WHERE lead_id = $1::integer AND status::text IS DISTINCT FROM 'superseded'
  ORDER BY created_at DESC, id DESC
  LIMIT 1
),
fallback_price AS (
  SELECT id
  FROM price_calculations
  WHERE lead_id = $1::integer
  ORDER BY created_at DESC, id DESC
  LIMIT 1
),
latest_work_order AS (
  SELECT id
  FROM work_orders
  WHERE lead_id = $1::integer AND status::text IS DISTINCT FROM 'cancelled'
  ORDER BY created_at DESC, id DESC
  LIMIT 1
),
fallback_work_order AS (
  SELECT id
  FROM work_orders
  WHERE lead_id = $1::integer
  ORDER BY created_at DESC, id DESC
  LIMIT 1
)
SELECT
  COALESCE((SELECT id FROM latest_measurement), (SELECT id FROM fallback_measurement))::integer AS measurement_id,
  COALESCE((SELECT id FROM latest_price), (SELECT id FROM fallback_price))::integer AS price_id,
  (SELECT id FROM working_quote)::integer AS working_quote_id,
  (SELECT id FROM working_contract)::integer AS working_contract_id,
  COALESCE(
    (SELECT id FROM working_contract),
    (SELECT id FROM latest_action_contract),
    (SELECT id FROM fallback_action_contract)
  )::integer AS action_contract_id,
  (SELECT id FROM effective_contract)::integer AS effective_contract_id,
  (SELECT quote_id FROM effective_contract)::integer AS effective_quote_id,
  COALESCE((SELECT id FROM latest_work_order), (SELECT id FROM fallback_work_order))::integer AS work_order_id,
  COALESCE((SELECT id FROM priority_message), (SELECT id FROM latest_message))::integer AS message_id
`;

function id(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function loadCaseCurrentSelection(
  payload: Pick<Payload, "db">,
  user: AdminReadUser,
  leadId: number,
): Promise<CaseCurrentSelection> {
  if (!Number.isSafeInteger(leadId) || leadId <= 0) {
    throw new TypeError("Invalid case lead ID");
  }
  return withAdminReadConnection(payload, user, async (connection) => {
    const result = await connection.query<SelectionRow>(currentSelectionSql, [
      leadId,
    ]);
    const row = result.rows[0];
    return {
      measurementId: id(row?.measurement_id ?? null),
      priceId: id(row?.price_id ?? null),
      workingQuoteId: id(row?.working_quote_id ?? null),
      workingContractId: id(row?.working_contract_id ?? null),
      actionContractId: id(row?.action_contract_id ?? null),
      effectiveContractId: id(row?.effective_contract_id ?? null),
      effectiveQuoteId: id(row?.effective_quote_id ?? null),
      workOrderId: id(row?.work_order_id ?? null),
      messageId: id(row?.message_id ?? null),
    };
  });
}
