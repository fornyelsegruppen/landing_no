import {
  canonicalWorkQueueUrl,
  parseCanonicalWorkQueueQuery,
  type CanonicalWorkQueueQuery,
} from "./work-queue-contract";

export const adminNextPreviewWorkQueueEntry =
  "/admin-next-preview/work?view=today&queue=all&limit=25" as const;

const previewWorkQueuePath = "/admin-next-preview/work";
const queueDetailHash = "#work-queue-detail";
const caseReferencePattern = /^TF-([1-9]\d*)$/u;
const caseIdPattern = /^case:([1-9]\d*)$/u;

function canonicalPreviewQueueHref(
  query: CanonicalWorkQueueQuery,
  selectedCaseId: string | null,
) {
  const canonical = new URL(
    canonicalWorkQueueUrl(query),
    "https://admin.invalid",
  );
  canonical.pathname = previewWorkQueuePath;
  if (selectedCaseId) canonical.searchParams.set("selected", selectedCaseId);
  return `${canonical.pathname}${canonical.search}${selectedCaseId ? queueDetailHash : ""}`;
}

function numericCaseReference(value: string) {
  return caseReferencePattern.exec(value)?.[1] ?? null;
}

export function safeAdminNextWorkQueueReturnTo(
  value: string | null | undefined,
  expectedCaseReference?: string,
) {
  if (
    !value ||
    value.length > 2_048 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value, "https://admin.invalid");
  } catch {
    return null;
  }
  if (
    url.origin !== "https://admin.invalid" ||
    url.pathname !== previewWorkQueuePath ||
    (url.hash !== "" && url.hash !== queueDetailHash)
  ) {
    return null;
  }

  const selectedValues = url.searchParams.getAll("selected");
  if (selectedValues.length > 1) return null;
  const selectedCaseId = selectedValues[0] || null;
  if (selectedCaseId && !caseIdPattern.test(selectedCaseId)) return null;

  if (expectedCaseReference && selectedCaseId) {
    const expectedId = numericCaseReference(expectedCaseReference);
    if (!expectedId || selectedCaseId !== `case:${expectedId}`) return null;
  }

  const queryParams = new URLSearchParams(url.searchParams);
  queryParams.delete("selected");
  const parsed = parseCanonicalWorkQueueQuery(queryParams);
  if (!parsed.ok) return null;
  return canonicalPreviewQueueHref(parsed.value, selectedCaseId);
}

export function adminNextPreviewCaseWorkspaceHref(input: {
  caseReference: string;
  returnTo: string;
}) {
  if (!numericCaseReference(input.caseReference)) {
    throw new TypeError("Preview case workspace requires a canonical reference");
  }
  const returnTo = safeAdminNextWorkQueueReturnTo(
    input.returnTo,
    input.caseReference,
  );
  if (!returnTo) {
    throw new TypeError("Preview case workspace return path is not allowed");
  }
  const params = new URLSearchParams({ returnTo });
  return `/admin-next-preview/cases/${encodeURIComponent(input.caseReference)}?${params.toString()}`;
}
