import "server-only";
import type { Payload } from "payload";
import type {
  CustomerQuestionContext,
  CustomerQuestionContextMessage,
  CustomerQuestionContextThread,
} from "@/lib/messages/customer-question-state";
import { withAdminReadConnection, type AdminReadUser } from "./admin-read-db";

const maxRequestedQuestionIds = 25;

type QuestionRow = {
  isUnresolved: boolean;
  q_aiAnalysis: unknown;
  q_aiAssisted: boolean | null;
  q_bodyText: string | null;
  q_category: string | null;
  q_channel: string | null;
  q_createdAt: string | Date | null;
  q_deliveredAt: string | Date | null;
  q_direction: string | null;
  q_failureCode: string | null;
  q_failureMessage: string | null;
  q_id: number;
  q_replyToMessageId: number | null;
  q_status: string | null;
  q_subject: string | null;
  q_updatedAt: string | Date | null;
  r_aiAnalysis: unknown;
  r_aiAssisted: boolean | null;
  r_bodyText: string | null;
  r_category: string | null;
  r_channel: string | null;
  r_createdAt: string | Date | null;
  r_deliveredAt: string | Date | null;
  r_direction: string | null;
  r_failureCode: string | null;
  r_failureMessage: string | null;
  r_id: number | null;
  r_replyToMessageId: number | null;
  r_status: string | null;
  r_subject: string | null;
  r_updatedAt: string | Date | null;
};

function validId(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function iso(value: string | Date | null) {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function selectedMessage(row: QuestionRow, prefix: "q" | "r") {
  const id = row[`${prefix}_id`];
  if (id === null) return null;
  const message: CustomerQuestionContextMessage = {
    aiAnalysis: row[`${prefix}_aiAnalysis`],
    aiAssisted: Boolean(row[`${prefix}_aiAssisted`]),
    bodyText: row[`${prefix}_bodyText`] || "",
    category: row[`${prefix}_category`] || undefined,
    channel: row[`${prefix}_channel`] || undefined,
    createdAt: iso(row[`${prefix}_createdAt`]),
    deliveredAt: iso(row[`${prefix}_deliveredAt`]),
    direction: row[`${prefix}_direction`] || undefined,
    failureCode: row[`${prefix}_failureCode`] || undefined,
    failureMessage: row[`${prefix}_failureMessage`] || undefined,
    id,
    replyToMessageId: row[`${prefix}_replyToMessageId`] || undefined,
    status: row[`${prefix}_status`] || undefined,
    subject: row[`${prefix}_subject`] || "",
    updatedAt: iso(row[`${prefix}_updatedAt`]),
  };
  return message;
}

function contextFromRows(rows: QuestionRow[]): CustomerQuestionContext {
  const selected = rows
    .map((row) => ({
      isUnresolved: row.isUnresolved,
      thread: {
        question: selectedMessage(row, "q")!,
        reply: selectedMessage(row, "r"),
      } satisfies CustomerQuestionContextThread,
    }))
    .sort(
      (left, right) =>
        String(right.thread.question.createdAt || "").localeCompare(
          String(left.thread.question.createdAt || ""),
        ) || right.thread.question.id - left.thread.question.id,
    );
  const threads = selected.map(({ thread }) => thread);
  const latest = threads[0] || null;
  const unresolved =
    selected.find(({ isUnresolved }) => isUnresolved)?.thread || null;
  return {
    latest,
    status: unresolved ? "pending" : latest ? "resolved" : "none",
    threads,
    unresolved,
  };
}

function validateIds(leadId: number, targetQuestionIds: number[]) {
  if (!validId(leadId)) throw new Error("INVALID_CASE_ID");
  if (!Array.isArray(targetQuestionIds)) throw new Error("INVALID_QUESTION_IDS");
  if (targetQuestionIds.length > maxRequestedQuestionIds) {
    throw new Error("TOO_MANY_QUESTION_IDS");
  }
  const ids = [...new Set(targetQuestionIds)];
  if (ids.some((id) => !validId(id))) throw new Error("INVALID_QUESTION_ID");
  return ids;
}

/**
 * Loads only the question threads needed by the workspace. The two canonical
 * rows (latest and latest unresolved) are selected over the complete lead
 * message set in SQL; requested reply-link targets are bounded to 25.
 */
export async function loadCaseQuestionContext(
  payload: Pick<Payload, "db">,
  user: AdminReadUser,
  leadId: number,
  targetQuestionIds: number[] = [],
): Promise<CustomerQuestionContext> {
  const requestedIds = validateIds(leadId, targetQuestionIds);
  return withAdminReadConnection(payload, user, async (connection) => {
    const result = await connection.query<QuestionRow>(
      `WITH questions AS (
         SELECT m.id, m.created_at
           FROM messages m
          WHERE m.lead_id = $1
            AND m.direction = 'inbound'
            AND m.category = 'customer_question'
       ),
       latest_question AS (
         SELECT id
           FROM questions
          ORDER BY created_at DESC, id DESC
          LIMIT 1
       ),
       unresolved_question AS (
         SELECT q.id
           FROM questions q
          WHERE NOT EXISTS (
            SELECT 1
              FROM messages r
             WHERE r.lead_id = $1
               AND r.direction = 'outbound'
               AND r.reply_to_message_id = q.id
               AND r.status <> 'cancelled'
               AND r.status = 'delivered'
          )
          ORDER BY q.created_at DESC, q.id DESC
          LIMIT 1
       ),
       selected_questions AS (
         SELECT id, bool_or(is_unresolved) AS is_unresolved
           FROM (
             SELECT id, FALSE AS is_unresolved FROM latest_question
             UNION ALL
             SELECT id, TRUE AS is_unresolved FROM unresolved_question
             UNION ALL
             SELECT id, FALSE AS is_unresolved
               FROM questions
              WHERE id = ANY($2::integer[])
           ) candidates(id, is_unresolved)
          GROUP BY id
       )
       SELECT
         selected.is_unresolved AS "isUnresolved",
         q.id AS "q_id",
         q.ai_analysis AS "q_aiAnalysis",
         q.ai_assisted AS "q_aiAssisted",
         q.body_text AS "q_bodyText",
         q.category AS "q_category",
         q.channel AS "q_channel",
         q.created_at AS "q_createdAt",
         q.delivered_at AS "q_deliveredAt",
         q.direction AS "q_direction",
         q.failure_code AS "q_failureCode",
         q.failure_message AS "q_failureMessage",
         q.reply_to_message_id AS "q_replyToMessageId",
         q.status AS "q_status",
         q.subject AS "q_subject",
         q.updated_at AS "q_updatedAt",
         r.id AS "r_id",
         r.ai_analysis AS "r_aiAnalysis",
         r.ai_assisted AS "r_aiAssisted",
         r.body_text AS "r_bodyText",
         r.category AS "r_category",
         r.channel AS "r_channel",
         r.created_at AS "r_createdAt",
         r.delivered_at AS "r_deliveredAt",
         r.direction AS "r_direction",
         r.failure_code AS "r_failureCode",
         r.failure_message AS "r_failureMessage",
         r.reply_to_message_id AS "r_replyToMessageId",
         r.status AS "r_status",
         r.subject AS "r_subject",
         r.updated_at AS "r_updatedAt"
         FROM selected_questions selected
         JOIN messages q ON q.id = selected.id AND q.lead_id = $1
         LEFT JOIN LATERAL (
           SELECT reply.*
             FROM messages reply
            WHERE reply.lead_id = $1
              AND reply.direction = 'outbound'
              AND reply.reply_to_message_id = q.id
              AND reply.status <> 'cancelled'
            ORDER BY reply.created_at DESC, reply.id DESC
            LIMIT 1
         ) r ON TRUE
        ORDER BY q.created_at DESC, q.id DESC`,
      [leadId, requestedIds],
    );
    return contextFromRows(result.rows);
  });
}
