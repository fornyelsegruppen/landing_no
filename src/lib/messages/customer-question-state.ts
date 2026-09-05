import type { Payload } from "payload";

export type CustomerQuestionMessageLike = {
  aiAnalysis?: unknown;
  aiAssisted?: boolean | null;
  bodyText?: string | null;
  category?: string | null;
  channel?: string | null;
  createdAt?: string | null;
  deliveredAt?: string | null;
  direction?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  id: number;
  replyToMessage?: number | { id?: number | null } | null;
  replyToMessageId?: number | null;
  status?: string | null;
  subject?: string | null;
  updatedAt?: string | null;
};

export type CustomerQuestionContextMessage = {
  aiAnalysis?: unknown;
  aiAssisted: boolean;
  bodyText: string;
  category?: string;
  channel?: string;
  createdAt?: string;
  deliveredAt?: string;
  direction?: string;
  failureCode?: string;
  failureMessage?: string;
  id: number;
  replyToMessageId?: number;
  status?: string;
  subject: string;
  updatedAt?: string;
};

export type CustomerQuestionContextThread = {
  question: CustomerQuestionContextMessage;
  reply: CustomerQuestionContextMessage | null;
};

export type CustomerQuestionContext = {
  latest: CustomerQuestionContextThread | null;
  status: CustomerQuestionStateStatus;
  threads: CustomerQuestionContextThread[];
  unresolved: CustomerQuestionContextThread | null;
};

export type CustomerQuestionReplyStage =
  "prepare" | "review" | "queued" | "sent" | "delivered" | "delivery_failed";

export type CustomerQuestionStateStatus = "none" | "pending" | "resolved";

function relationId(message: CustomerQuestionMessageLike) {
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

function customerQuestions<T extends CustomerQuestionMessageLike>(
  messages: T[],
) {
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

function repliesForQuestion<T extends CustomerQuestionMessageLike>(
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
  reply?: Pick<CustomerQuestionMessageLike, "failureCode" | "status"> | null,
): CustomerQuestionReplyStage {
  if (!reply || reply.status === "cancelled") return "prepare";
  if (reply.status === "draft") return "review";
  if (["failed", "attention"].includes(reply.status || "")) {
    return "delivery_failed";
  }
  if (reply.status === "queued" && reply.failureCode) {
    return "delivery_failed";
  }
  if (reply.status === "sent") return "sent";
  if (reply.status === "delivered") return "delivered";
  return "queued";
}

export function customerQuestionDocumentReferences(
  question: Pick<CustomerQuestionMessageLike, "aiAnalysis">,
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

export function selectUnresolvedCustomerQuestion<
  T extends CustomerQuestionMessageLike,
>(messages: T[]) {
  const questions = customerQuestions(messages);

  // Operators must work the oldest unanswered customer question first so an
  // earlier request cannot be hidden indefinitely by newer follow-ups.
  for (const question of [...questions].reverse()) {
    const replies = repliesForQuestion(messages, question.id);
    const delivered = replies.some((reply) => reply.status === "delivered");
    if (!delivered) return { question, reply: replies[0] || null };
  }

  return null;
}

export function selectLatestCustomerQuestion<
  T extends CustomerQuestionMessageLike,
>(messages: T[]) {
  const question = customerQuestions(messages)[0];
  if (!question) return null;
  return {
    question,
    reply: repliesForQuestion(messages, question.id)[0] || null,
  };
}

export function customerQuestionThreads<T extends CustomerQuestionMessageLike>(
  messages: T[],
) {
  return customerQuestions(messages).map((question) => ({
    question,
    reply: repliesForQuestion(messages, question.id)[0] || null,
  }));
}

export function customerQuestionState<T extends CustomerQuestionMessageLike>(
  messages: T[],
) {
  const unresolved = selectUnresolvedCustomerQuestion(messages);
  const latest = selectLatestCustomerQuestion(messages);
  const threads = customerQuestionThreads(messages);
  const status: CustomerQuestionStateStatus = unresolved
    ? "pending"
    : latest
      ? "resolved"
      : "none";
  return { latest, status, threads, unresolved };
}

function optionalString(value?: string | null) {
  return typeof value === "string" && value.length ? value : undefined;
}

function contextMessage(
  message: CustomerQuestionMessageLike,
): CustomerQuestionContextMessage {
  return {
    aiAnalysis: message.aiAnalysis,
    aiAssisted: Boolean(message.aiAssisted),
    bodyText: message.bodyText || "",
    category: optionalString(message.category),
    channel: optionalString(message.channel),
    createdAt: optionalString(message.createdAt),
    deliveredAt: optionalString(message.deliveredAt),
    direction: optionalString(message.direction),
    failureCode: optionalString(message.failureCode),
    failureMessage: optionalString(message.failureMessage),
    id: message.id,
    replyToMessageId: relationId(message) || undefined,
    status: optionalString(message.status),
    subject: message.subject || "",
    updatedAt: optionalString(message.updatedAt),
  };
}

function contextThread<T extends CustomerQuestionMessageLike>(thread: {
  question: T;
  reply: T | null;
}): CustomerQuestionContextThread {
  return {
    question: contextMessage(thread.question),
    reply: thread.reply ? contextMessage(thread.reply) : null,
  };
}

export function customerQuestionContext<T extends CustomerQuestionMessageLike>(
  messages: T[],
): CustomerQuestionContext {
  const state = customerQuestionState(messages);
  return {
    latest: state.latest ? contextThread(state.latest) : null,
    status: state.status,
    threads: state.threads.map(contextThread),
    unresolved: state.unresolved ? contextThread(state.unresolved) : null,
  };
}

export type CustomerQuestionDraftAccess = {
  isActiveQuestionReply: boolean;
  readOnly: boolean;
  replyTarget: CustomerQuestionContextMessage | null;
};

export function customerQuestionDraftAccess(
  context: CustomerQuestionContext,
  draft: Pick<
    CustomerQuestionMessageLike,
    "direction" | "replyToMessage" | "replyToMessageId" | "status"
  >,
): CustomerQuestionDraftAccess {
  const replyTargetId = relationId({ id: 0, ...draft });
  const replyTarget = replyTargetId
    ? context.threads.find((thread) => thread.question.id === replyTargetId)
        ?.question || null
    : null;
  const activeQuestionId = context.unresolved?.question.id;
  const isOutboundDraft =
    draft.direction === "outbound" && draft.status === "draft";
  const isActiveQuestionReply = Boolean(
    activeQuestionId && replyTargetId === activeQuestionId,
  );
  return {
    isActiveQuestionReply,
    readOnly: Boolean(
      isOutboundDraft && activeQuestionId && !isActiveQuestionReply,
    ),
    replyTarget,
  };
}

export async function loadCustomerQuestionState(
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
  const questionDocs = questions.docs as CustomerQuestionMessageLike[];
  if (!questionDocs.length) {
    return customerQuestionState(questionDocs);
  }

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
  return customerQuestionState([
    ...questionDocs,
    ...(replies.docs as CustomerQuestionMessageLike[]),
  ]);
}

export async function loadCustomerQuestionContext(
  payload: Payload,
  leadId: number,
): Promise<CustomerQuestionContext> {
  const state = await loadCustomerQuestionState(payload, leadId);
  return {
    latest: state.latest ? contextThread(state.latest) : null,
    status: state.status,
    threads: state.threads.map(contextThread),
    unresolved: state.unresolved ? contextThread(state.unresolved) : null,
  };
}

export async function loadUnresolvedCustomerQuestion(
  payload: Payload,
  leadId: number,
) {
  return (await loadCustomerQuestionState(payload, leadId)).unresolved;
}
