import { createHash } from "node:crypto";
import { publicPostContentFields } from "./editorial-policy";

const relations = new Set(["heroImage", "relatedPosts", "relatedServices"]);
function normalize(value: unknown): unknown {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v)]),
    );
  return value;
}
function relation(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(relation);
  if (value && typeof value === "object" && "id" in value) return value.id;
  return value;
}

// A server-side snapshot token guards even two writes with the same millisecond
// timestamp. It is not accepted as a client assertion of human approval.
export function postRevision(post: object) {
  const data = post as Record<string, unknown>;
  const fields = [
    ...publicPostContentFields,
    "updatedAt",
    "_status",
    "editorialStatus",
    "reviewerName",
    "reviewedAt",
    "scheduledAt",
    "qualityScore",
    "qualityChecks",
  ];
  return createHash("sha256")
    .update(
      JSON.stringify(
        fields.map((key) => [
          key,
          normalize(relations.has(key) ? relation(data[key]) : data[key]),
        ]),
      ),
    )
    .digest("hex");
}
