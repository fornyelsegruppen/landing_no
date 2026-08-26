import type { Where } from "payload";

export type PublicPostState = {
  _status?: "draft" | "published" | null;
  editorialStatus?:
    | "draft"
    | "ai_qa"
    | "human_review"
    | "rejected"
    | "approved"
    | "scheduled"
    | "published"
    | null;
};

export function publishedPostWhere(slug?: string): Where {
  const conditions: Where[] = [
    { _status: { equals: "published" } },
    { editorialStatus: { equals: "published" } },
  ];

  if (slug) conditions.unshift({ slug: { equals: slug } });

  return { and: conditions };
}

export function isPubliclyPublishedPost(post: PublicPostState): boolean {
  return (
    post._status === "published" && post.editorialStatus === "published"
  );
}
