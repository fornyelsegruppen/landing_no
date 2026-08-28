import type { Payload } from "payload";

type MessageLike = {
  bodyText?: string | null;
  category?: string | null;
  createdAt?: string | null;
  direction?: string | null;
  id: number;
  replyToMessage?: number | { id?: number | null } | null;
  status?: string | null;
  subject?: string | null;
};

function relationId(value: MessageLike["replyToMessage"]) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof value.id === "number") {
    return value.id;
  }
  return null;
}

export function selectUnresolvedCustomerQuestion<T extends MessageLike>(
  messages: T[],
) {
  const questions = messages
    .filter(
      (message) =>
        message.direction === "inbound" &&
        message.category === "customer_question",
    )
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
    );

  for (const question of questions) {
    const replies = messages
      .filter(
        (message) =>
          message.direction === "outbound" &&
          relationId(message.replyToMessage) === question.id &&
          message.status !== "cancelled",
      )
      .sort((left, right) =>
        String(right.createdAt || "").localeCompare(
          String(left.createdAt || ""),
        ),
      );
    const delivered = replies.some((reply) =>
      ["sent", "delivered"].includes(reply.status || ""),
    );
    if (!delivered) return { question, reply: replies[0] || null };
  }

  return null;
}

export async function loadUnresolvedCustomerQuestion(
  payload: Payload,
  leadId: number,
) {
  const result = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 250,
    overrideAccess: true,
    pagination: false,
    sort: "-createdAt",
    where: { lead: { equals: leadId } },
  });
  return selectUnresolvedCustomerQuestion(result.docs as MessageLike[]);
}
