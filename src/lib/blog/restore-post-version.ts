import {
  restoreVersionOperation,
  type Payload,
  type PayloadRequest,
} from "payload";

type RestorePostVersionAsDraftInput = {
  payload: Payload;
  req: PayloadRequest;
  versionID: string;
};

/**
 * Server-only contract for an authenticated restore endpoint.
 *
 * Payload's installed Local API wrapper drops the `draft` argument before it
 * reaches `restoreVersionOperation`. The REST endpoint receives the normal
 * authenticated Payload request, and this helper preserves that request while
 * explicitly restoring only a draft. `restoreVersionOperation` then performs
 * the collection update-access check against the version's actual parent.
 */
export async function restorePostVersionAsDraft({
  payload,
  req,
  versionID,
}: RestorePostVersionAsDraftInput) {
  const collection = payload.collections.posts;
  if (!collection) throw new TypeError("Posts collection is unavailable");

  // Resolve through the public local API before restoring. This avoids ever
  // passing an arbitrary parent ID into the operation; the operation itself
  // verifies update access against the selected version's real parent.
  const matchingVersion = await payload.findVersions({
    collection: "posts",
    overrideAccess: false,
    user: req.user,
    limit: 1,
    pagination: false,
    where: { id: { equals: versionID } },
  });
  if (matchingVersion.docs.length !== 1) {
    throw new TypeError("Post version is unavailable");
  }

  return restoreVersionOperation({
    collection,
    draft: true,
    id: versionID,
    overrideAccess: false,
    req,
  });
}
