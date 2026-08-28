import type { Payload } from "payload";

type MessageLike = {
  aiAnalysis?: unknown;
  bodyText?: string | null;
  category?: string | null;
  createdAt?: string | null;
  direction?: string | null;
  id: number;
  replyToMessage?: number | { id?: number | null } | null;
  replyToMessageId?: number | null;
  status?: string | null;
  subject?: string | null;
};

export type CustomerQuestionReplyStage =
  "prepare" | "review" | "queued" | "sent" | "delivery_failed";

function relationId(message: MessageLike) {
  if (typeof message.replyToMessageId === "number") {
    return message.replyToMessageId;
  }
  const value = message.replyToMessage;
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof value.id === "number") {
    return value.id;
  }
  return null;
}

function customerQuestions<T extends MessageLike>(messages: T[]) {
  return messages
    .filter(
      (message) =>
        message.direction === "inbound" &&
        message.category === "customer_question",
    )
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
    );
}

function repliesForQuestion<T extends MessageLike>(
  messages: T[],
  questionId: number,
) {
  return messages
    .filter(
      (message) =>
        message.direction === "outbound" &&
        relationId(message) === questionId &&
        message.status !== "cancelled",
    )
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
    );
}

export function customerQuestionReplyStage(
  reply?: Pick<MessageLike, "status"> | null,
): CustomerQuestionReplyStage {
  if (!reply || reply.status === "cancelled") return "prepare";
  if (reply.status === "draft") return "review";
  if (["failed", "attention"].includes(reply.status || "")) {
    return "delivery_failed";
  }
  if (["sent", "delivered"].includes(reply.status || "")) return "sent";
  return "queued";
}

export function customerQuestionDocumentReferences(
  question: Pick<MessageLike, "aiAnalysis">,
) {
  if (!question.aiAnalysis || typeof question.aiAnalysis !== "object") {
    return [];
  }
  const analysis = question.aiAnalysis as Record<string, unknown>;
  return [analysis.quoteReference, analysis.contractReference].filter(
    (value, index, values): value is string =>
      typeof value === "string" &&
      value.trim().length > 0 &&
      values.indexOf(value) === index,
  );
}

export function selectUnresolvedCustomerQuestion<T extends MessageLike>(
  messages: T[],
) {
  const questions = customerQuestions(messages);

  for (const question of questions) {
    const replies = repliesForQuestion(messages, question.id);
    const delivered = replies.some((reply) => reply.status === "delivered");
    if (!delivered) return { question, reply: replies[0] || null };
  }

  return null;
}

export function selectLatestCustomerQuestion<T extends MessageLike>(
  messages: T[],
) {
  const question = customerQuestions(messages)[0];
  if (!question) return null;
  return {
    question,
    reply: repliesForQuestion(messages, question.id)[0] || null,
  };
}

export async function loadUnresolvedCustomerQuestion(
  payload: Payload,
  leadId: number,
) {
  const questions = await payload.find({
    collection: "messages",
    depth: 0,
    overrideAccess: true,
    pagination: false,
    sort: "-createdAt",
    where: {
      and: [
        { lead: { equals: leadId } },
        { direction: { equals: "inbound" } },
        { category: { equals: "customer_question" } },
      ],
    },
  });
  const questionDocs = questions.docs as MessageLike[];
  if (!questionDocs.length) return null;

  const replies = await payload.find({
    collection: "messages",
    depth: 0,
    overrideAccess: true,
    pagination: false,
    sort: "-createdAt",
    where: {
      and: [
        { lead: { equals: leadId } },
        { direction: { equals: "outbound" } },
        {
          replyToMessage: {
            in: questionDocs.map((question) => question.id),
          },
        },
        { status: { not_equals: "cancelled" } },
      ],
    },
  });
  return selectUnresolvedCustomerQuestion([
    ...questionDocs,
    ...(replies.docs as MessageLike[]),
  ]);
}
