import type { Payload, Where } from "payload";
import type {
  AdminNextCaseCommunication,
  AdminNextCaseCommunicationPage,
} from "@/lib/admin-next/case-workspace-contract";

export const ADMIN_NEXT_COMMUNICATION_PAGE_SIZE = 25;

type CommunicationCursor = {
  createdAt: string;
  id: number;
};

type RecordLike = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function relationId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return numberValue((value as RecordLike).id);
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordLike)
    : undefined;
}

function encodeCursor(cursor: CommunicationCursor) {
  return `${Date.parse(cursor.createdAt).toString(36)}.${cursor.id.toString(36)}`;
}

export function parseAdminNextCommunicationCursor(
  value: string | null | undefined,
): CommunicationCursor | null {
  if (!value) return null;
  const match = value.match(/^([0-9a-z]+)\.([0-9a-z]+)$/u);
  if (!match) return null;
  const milliseconds = Number.parseInt(match[1], 36);
  const id = Number.parseInt(match[2], 36);
  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 0 ||
    !Number.isSafeInteger(id) ||
    id < 1
  ) {
    return null;
  }
  const createdAt = new Date(milliseconds).toISOString();
  return { createdAt, id };
}

function baseWhere(leadId: number): Where {
  return {
    and: [
      { lead: { equals: leadId } },
      {
        // Cancelled AI drafts were never customer communication. Every other
        // inbound, outbound, queued, failed and draft message remains visible.
        or: [
          { category: { not_equals: "ai_reply" } },
          { status: { not_equals: "cancelled" } },
        ],
      },
    ],
  };
}

function pageWhere(leadId: number, cursor: CommunicationCursor | null): Where {
  const base = baseWhere(leadId);
  if (!cursor) return base;
  return {
    and: [
      base,
      {
        or: [
          { createdAt: { less_than: cursor.createdAt } },
          {
            and: [
              { createdAt: { equals: cursor.createdAt } },
              { id: { less_than: cursor.id } },
            ],
          },
        ],
      },
    ],
  };
}

function attachment(value: unknown) {
  const id = relationId(value);
  if (!id) return null;
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as RecordLike)
      : undefined;
  return {
    id: `document-${id}`,
    filename: stringValue(record?.filename) || `#${id}`,
    href: `/api/admin/media/${id}`,
  };
}

function projectCommunication(
  value: unknown,
  leadId: number,
): AdminNextCaseCommunication | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as RecordLike;
  const id = numberValue(record.id);
  if (!id) return null;
  const createdAt = stringValue(record.createdAt);
  const updatedAt = stringValue(record.updatedAt);
  const sentAt = stringValue(record.sentAt);
  const deliveredAt = stringValue(record.deliveredAt);
  const approvedAt = stringValue(record.approvedAt);
  const queuedAt = stringValue(record.queuedAt);
  const replyToMessageId = relationId(record.replyToMessage);
  const analysis = recordValue(record.aiAnalysis);
  const manualRecovery = recordValue(analysis?.manualRecovery);
  const recipient = stringValue(analysis?.deliveryRecipient);
  const provider = stringValue(record.provider);
  const failureCode = stringValue(record.failureCode);
  const failureMessage = stringValue(record.failureMessage);
  const projectedManualRecovery = manualRecovery
    ? {
        ...(stringValue(manualRecovery.channel)
          ? { channel: stringValue(manualRecovery.channel) }
          : {}),
        ...(stringValue(manualRecovery.status)
          ? { status: stringValue(manualRecovery.status) }
          : {}),
        ...(stringValue(manualRecovery.preparedAt)
          ? { preparedAt: stringValue(manualRecovery.preparedAt) }
          : {}),
        ...(stringValue(manualRecovery.contactedAt)
          ? { contactedAt: stringValue(manualRecovery.contactedAt) }
          : {}),
        ...(stringValue(manualRecovery.resentAt)
          ? { resentAt: stringValue(manualRecovery.resentAt) }
          : {}),
      }
    : undefined;
  const delivery =
    approvedAt ||
    queuedAt ||
    recipient ||
    provider ||
    failureCode ||
    failureMessage ||
    projectedManualRecovery
      ? {
          ...(approvedAt ? { approvedAt } : {}),
          ...(queuedAt ? { queuedAt } : {}),
          ...(recipient ? { recipient } : {}),
          ...(provider ? { provider } : {}),
          ...(failureCode ? { failureCode } : {}),
          ...(failureMessage ? { failureMessage } : {}),
          ...(projectedManualRecovery
            ? { manualRecovery: projectedManualRecovery }
            : {}),
        }
      : undefined;
  return {
    id: `message-${id}`,
    direction: record.direction === "inbound" ? "inbound" : "outbound",
    channel: stringValue(record.channel) || "—",
    category: stringValue(record.category) || "—",
    status: stringValue(record.status) || "—",
    subject: stringValue(record.subject) || `#${id}`,
    bodyText: stringValue(record.bodyText) || "",
    at: deliveredAt || sentAt || updatedAt || createdAt || "—",
    ...(sentAt ? { sentAt } : {}),
    ...(deliveredAt ? { deliveredAt } : {}),
    ...(replyToMessageId ? { replyToMessageId } : {}),
    ...(delivery ? { delivery } : {}),
    attachments: Array.isArray(record.attachments)
      ? record.attachments
          .map(attachment)
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [],
    fallbackHref: `/admin-v2/cases/${leadId}#message-${id}`,
  };
}

/**
 * Cursor pagination prevents newly arrived messages from shifting or
 * duplicating older rows while an operator works through a long case record.
 */
export async function loadAdminNextCaseCommunicationPage(
  payload: Pick<Payload, "count" | "find">,
  leadId: number,
  cursorValue?: string | null,
): Promise<AdminNextCaseCommunicationPage> {
  const cursor = parseAdminNextCommunicationCursor(cursorValue);
  if (cursorValue && !cursor) throw new Error("INVALID_COMMUNICATION_CURSOR");

  const [result, total] = await Promise.all([
    payload.find({
      collection: "messages",
      depth: 1,
      limit: ADMIN_NEXT_COMMUNICATION_PAGE_SIZE,
      overrideAccess: true,
      sort: ["-createdAt", "-id"],
      where: pageWhere(leadId, cursor),
    }),
    payload.count({
      collection: "messages",
      overrideAccess: true,
      where: baseWhere(leadId),
    }),
  ]);
  const items = result.docs
    .map((item) => projectCommunication(item, leadId))
    .filter((item): item is AdminNextCaseCommunication => Boolean(item));
  const windowTotal =
    typeof result.totalDocs === "number" ? result.totalDocs : items.length;
  const remainingCount = Math.max(0, windowTotal - result.docs.length);
  const last = result.docs.at(-1) as RecordLike | undefined;
  const lastCreatedAt = stringValue(last?.createdAt);
  const lastId = numberValue(last?.id);
  const nextCursor =
    remainingCount > 0 && lastCreatedAt && lastId
      ? encodeCursor({ createdAt: lastCreatedAt, id: lastId })
      : null;

  return {
    items,
    pageInfo: {
      totalCount: total.totalDocs,
      remainingCount,
      nextCursor,
      loadMoreHref: `/api/admin-next/cases/${leadId}/communications`,
    },
  };
}
