import type { BlogEditorForm } from "./blog-editor-state";

export type { BlogEditorForm } from "./blog-editor-state";

export type BlogEditorAction =
  | "approve"
  | "publish"
  | "regenerate"
  | "reject"
  | "save"
  | "schedule"
  | "stock-image";

export function blogEditorActionRequest(
  action: BlogEditorAction,
  form: BlogEditorForm,
  options: { expectedUpdatedAt?: string } = {},
) {
  const { query, scheduledAt, regenerationInstructions } = form;
  const trimmedQuery = query.trim();
  const expectedUpdatedAt = options.expectedUpdatedAt?.trim();
  const request = {
    action,
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  };

  if (action === "save")
    return {
      ...request,
      titleNo: form.titleNo,
      excerptNo: form.excerptNo,
      contentNo: form.contentNo,
      seoTitleNo: form.seoTitleNo,
      seoDescriptionNo: form.seoDescriptionNo,
      primaryKeyword: form.primaryKeyword,
    };
  if (action === "stock-image")
    return { ...request, ...(trimmedQuery ? { query: trimmedQuery } : {}) };
  if (action === "schedule")
    return {
      ...request,
      ...(scheduledAt
        ? { scheduledAt: new Date(scheduledAt).toISOString() }
        : {}),
    };
  if (action === "approve")
    return {
      ...request,
      ...(form.reviewerName.trim()
        ? { reviewerName: form.reviewerName.trim() }
        : {}),
    };
  if (action === "regenerate")
    return {
      ...request,
      ...(regenerationInstructions.trim()
        ? { regenerationInstructions: regenerationInstructions.trim() }
        : {}),
    };
  return request;
}
