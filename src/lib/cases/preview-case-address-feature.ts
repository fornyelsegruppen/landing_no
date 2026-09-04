export type PreviewCaseAddressEnvironment = Record<
  string,
  string | undefined
>;

export function isPreviewCaseAddressCommandEnabled(
  environment: PreviewCaseAddressEnvironment = process.env,
) {
  return (
    environment.VERCEL_ENV === "preview" &&
    environment.FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND === "true"
  );
}
