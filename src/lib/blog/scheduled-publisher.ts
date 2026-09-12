import { postRevision } from "./post-revision";
import type { Payload } from "payload";
import { assertPostPublishable } from "./editorial-policy";
import { withSeoTransaction } from "./post-write-transaction";

export async function publishDueBlogPosts(payload: Payload, now = new Date()) {
  const due = await payload.find({
    collection: "posts",
    draft: true,
    depth: 0,
    limit: 10,
    sort: "scheduledAt",
    overrideAccess: true,
    where: {
      and: [
        { _status: { equals: "draft" } },
        { editorialStatus: { equals: "scheduled" } },
        { scheduledAt: { less_than_equal: now.toISOString() } },
      ],
    },
  });
  const published: Array<number | string> = [];
  const attention: Array<number | string> = [];
  const skipped: Array<number | string> = [];
  const deadline = Date.now() + 45_000;
  for (const candidate of due.docs) {
    if (Date.now() >= deadline) break;
    try {
      const outcome = await withSeoTransaction(payload, async (req) => {
        const current = await payload.findByID({
          collection: "posts",
          id: candidate.id,
          draft: true,
          depth: 0,
          overrideAccess: true,
          req,
        });
        if (
          current._status !== "draft" ||
          current.editorialStatus !== "scheduled" ||
          !current.scheduledAt ||
          new Date(current.scheduledAt) > now
        )
          return "skipped";
        try {
          assertPostPublishable(current);
        } catch {
          await payload.update({
            collection: "posts",
            id: current.id,
            req,
            draft: true,
            overrideAccess: true,
            data: {
              editorialStatus: "human_review",
              scheduledAt: null,
              reviewerName: null,
              reviewedAt: null,
            },
          });
          return "attention";
        }
        const result = await payload.update({
          collection: "posts",
          id: current.id,
          draft: false,
          overrideAccess: true,
          req,
          context: {
            expectedBlogUpdatedAt: current.updatedAt,
            expectedBlogRevision: postRevision(current),
          },
          data: {
            _status: "published",
            authorName: current.authorName?.trim() || "Takfornyelse",
          },
        });
        if (
          result._status !== "published" ||
          result.editorialStatus !== "published"
        )
          throw new TypeError("Publication was not committed");
        return "published";
      });
      (outcome === "published"
        ? published
        : outcome === "attention"
          ? attention
          : skipped
      ).push(candidate.id);
    } catch {
      attention.push(candidate.id);
    }
  }
  return { published, attention, skipped };
}
