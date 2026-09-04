import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_NEXT_COMMUNICATION_PAGE_SIZE,
  loadAdminNextCaseCommunicationPage,
  parseAdminNextCommunicationCursor,
} from "@/lib/admin-next/case-communication-read";

function message(id: number, createdAt = "2026-09-04T10:00:00.000Z") {
  return {
    id,
    attachments: [],
    bodyText: `Body ${id}`,
    category: "customer_question",
    channel: "email",
    createdAt,
    direction: id % 2 ? "inbound" : "outbound",
    status: "delivered",
    subject: `Message ${id}`,
    updatedAt: createdAt,
  };
}

describe("Admin Next case communication pagination", () => {
  it("returns the newest bounded page with exact totals and an older cursor", async () => {
    const docs = Array.from(
      { length: ADMIN_NEXT_COMMUNICATION_PAGE_SIZE },
      (_, index) => message(50 - index),
    );
    docs[0] = {
      ...docs[0],
      attachments: [
        {
          id: 701,
          filename: "signed-contract.pdf",
        },
      ],
      replyToMessage: { id: 49 },
      approvedAt: "2026-09-04T09:57:00.000Z",
      queuedAt: "2026-09-04T09:58:00.000Z",
      provider: "resend",
      aiAnalysis: {
        deliveryRecipient: "customer@example.no",
        manualRecovery: {
          channel: "phone",
          status: "contacted",
          contactedAt: "2026-09-04T10:01:00.000Z",
        },
      },
      sentAt: "2026-09-04T09:59:00.000Z",
    } as never;
    const find = vi.fn().mockResolvedValue({ docs, totalDocs: 26 });
    const count = vi.fn().mockResolvedValue({ totalDocs: 26 });

    const page = await loadAdminNextCaseCommunicationPage(
      { count, find } as never,
      13,
    );

    expect(page.items).toHaveLength(25);
    expect(page.items[0]).toMatchObject({
      id: "message-50",
      replyToMessageId: 49,
      attachments: [
        {
          id: "document-701",
          filename: "signed-contract.pdf",
          href: "/api/admin/media/701",
        },
      ],
      fallbackHref: "/admin-v2/cases/13#message-50",
      delivery: {
        approvedAt: "2026-09-04T09:57:00.000Z",
        queuedAt: "2026-09-04T09:58:00.000Z",
        recipient: "customer@example.no",
        provider: "resend",
        manualRecovery: {
          channel: "phone",
          status: "contacted",
          contactedAt: "2026-09-04T10:01:00.000Z",
        },
      },
    });
    expect(page.pageInfo).toMatchObject({
      totalCount: 26,
      remainingCount: 1,
      loadMoreHref: "/api/admin-next/cases/13/communications",
    });
    expect(parseAdminNextCommunicationCursor(page.pageInfo.nextCursor)).toEqual(
      {
        createdAt: "2026-09-04T10:00:00.000Z",
        id: 26,
      },
    );
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "messages",
        depth: 1,
        limit: 25,
        sort: ["-createdAt", "-id"],
        where: {
          and: [
            { lead: { equals: 13 } },
            {
              or: [
                { category: { not_equals: "ai_reply" } },
                { status: { not_equals: "cancelled" } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("uses timestamp plus id so equal-time messages do not shift between pages", async () => {
    const cursor = `${Date.parse("2026-09-04T10:00:00.000Z").toString(36)}.${(26).toString(36)}`;
    const find = vi
      .fn()
      .mockResolvedValue({ docs: [message(25)], totalDocs: 1 });
    const count = vi.fn().mockResolvedValue({ totalDocs: 26 });

    const page = await loadAdminNextCaseCommunicationPage(
      { count, find } as never,
      13,
      cursor,
    );

    expect(page.items.map(({ id }) => id)).toEqual(["message-25"]);
    expect(page.pageInfo).toEqual({
      totalCount: 26,
      remainingCount: 0,
      nextCursor: null,
      loadMoreHref: "/api/admin-next/cases/13/communications",
    });
    expect(find.mock.calls[0]?.[0].where).toEqual({
      and: [
        {
          and: [
            { lead: { equals: 13 } },
            {
              or: [
                { category: { not_equals: "ai_reply" } },
                { status: { not_equals: "cancelled" } },
              ],
            },
          ],
        },
        {
          or: [
            { createdAt: { less_than: "2026-09-04T10:00:00.000Z" } },
            {
              and: [
                { createdAt: { equals: "2026-09-04T10:00:00.000Z" } },
                { id: { less_than: 26 } },
              ],
            },
          ],
        },
      ],
    });
  });

  it("rejects malformed cursors before reading canonical data", async () => {
    const find = vi.fn();
    const count = vi.fn();

    await expect(
      loadAdminNextCaseCommunicationPage(
        { count, find } as never,
        13,
        "not-a-cursor",
      ),
    ).rejects.toThrow("INVALID_COMMUNICATION_CURSOR");
    expect(find).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});
