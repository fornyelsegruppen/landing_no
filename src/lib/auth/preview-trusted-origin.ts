export const adminNextUatOrigin =
  "https://takfornyelse-admin-next-uat.vercel.app";

export function resolveAdminNextPreviewTrustedOrigin(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return environment.VERCEL_ENV === "preview" ? adminNextUatOrigin : "";
}
