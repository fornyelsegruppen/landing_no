import {
  createLocalReq,
  restoreVersionOperation,
  type Document,
  type Payload,
} from "payload";

type RestorePostVersionAsDraftInput = {
  payload: Payload;
  postID: number | string;
  user: Document;
  versionID: string;
};

/**
 * Server-only contract for a future authenticated AdminV2 restore action.
 *
 * Payload's installed Local API wrapper drops the `draft` argument before it
 * reaches `restoreVersionOperation`. This helper uses Payload's exported
 * operation and local-request builder directly, preserves access control, and
 * rejects a version that does not belong to the requested post.
 */
export async function restorePostVersionAsDraft({
  payload,
  postID,
  user,
  versionID,
}: RestorePostVersionAsDraftInput) {
  const collection = payload.collections.posts;
  if (!collection) throw new TypeError("Posts collection is unavailable");

  const matchingVersion = await payload.findVersions({
    collection: "posts",
    overrideAccess: false,
    user,
    limit: 1,
    pagination: false,
    where: {
      and: [
        { id: { equals: versionID } },
        { parent: { equals: postID } },
      ],
    },
  });
  if (matchingVersion.docs.length !== 1) {
    throw new TypeError("Version does not belong to the requested post");
  }

  const req = await createLocalReq({ overrideAccess: false, user }, payload);
  return restoreVersionOperation({
    collection,
    draft: true,
    id: versionID,
    overrideAccess: false,
    payload,
    req,
  });
}
