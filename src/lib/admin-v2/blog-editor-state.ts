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
  regenerationInstructions: string;
};

export type BlogEditorInitialValues = Omit<
  BlogEditorForm,
  "scheduledAt" | "query" | "regenerationInstructions"
> & { scheduledAt?: string };

export type BlogEditorSavedFields = Pick<
  BlogEditorForm,
  | "titleNo"
  | "excerptNo"
  | "contentNo"
  | "seoTitleNo"
  | "seoDescriptionNo"
  | "primaryKeyword"
>;

export function initialBlogEditorForm(
  values: BlogEditorInitialValues,
): BlogEditorForm {
  return {
    ...values,
    scheduledAt: values.scheduledAt || "",
    query: "",
    regenerationInstructions: "",
  };
}

export function savedBlogEditorFields(
  form: BlogEditorForm,
): BlogEditorSavedFields {
  const {
    titleNo,
    excerptNo,
    contentNo,
    seoTitleNo,
    seoDescriptionNo,
    primaryKeyword,
  } = form;
  return {
    titleNo,
    excerptNo,
    contentNo,
    seoTitleNo,
    seoDescriptionNo,
    primaryKeyword,
  };
}

export function blogEditorIsDirty(
  form: BlogEditorForm,
  saved: BlogEditorSavedFields,
) {
  return Object.entries(saved).some(
    ([key, value]) => form[key as keyof BlogEditorSavedFields] !== value,
  );
}

export function reconcileCleanBlogEditorForm(
  current: BlogEditorForm,
  incoming: BlogEditorInitialValues,
) {
  return {
    ...initialBlogEditorForm(incoming),
    // These two fields are action-local and never represent saved article text.
    query: current.query,
    regenerationInstructions: current.regenerationInstructions,
  };
}

export function blogEditorActionIsBlocked(input: {
  action:
    | "approve"
    | "publish"
    | "unpublish"
    | "regenerate"
    | "reject"
    | "save"
    | "schedule"
    | "stock-image";
  dirty: boolean;
  serverUpdatedWhileDirty: boolean;
}) {
  if (input.serverUpdatedWhileDirty) return true;
  return input.action !== "save" && input.dirty;
}
