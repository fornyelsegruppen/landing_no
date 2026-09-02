export type BlogEditorAction =
  | "approve"
  | "publish"
  | "regenerate"
  | "reject"
  | "save"
  | "schedule"
  | "stock-image";

export type BlogEditorForm = {
  titleNo: string;
  excerptNo: string;
  contentNo: string;
  seoTitleNo: string;
  seoDescriptionNo: string;
  primaryKeyword: string;
  reviewerName: string;
  scheduledAt: string;
  query: string;
};

export function blogEditorActionRequest(
  action: BlogEditorAction,
  form: BlogEditorForm,
) {
  const { query, scheduledAt, ...content } = form;
  const trimmedQuery = query.trim();

  return {
    action,
    ...content,
    ...(trimmedQuery ? { query: trimmedQuery } : {}),
    ...(scheduledAt
      ? { scheduledAt: new Date(scheduledAt).toISOString() }
      : {}),
  };
}
