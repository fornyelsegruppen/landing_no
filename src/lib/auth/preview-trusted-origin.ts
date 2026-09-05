export const adminNextUatOrigin =
  "https://takfornyelse-admin-next-uat.vercel.app";

export const roofFusionPreviewOrigin =
  "https://takfornyelse-rf-preview.vercel.app";

export const adminNextPreviewTrustedOrigins = [
  adminNextUatOrigin,
  roofFusionPreviewOrigin,
] as const;

export function resolveAdminNextPreviewTrustedOrigins(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return environment.VERCEL_ENV === "preview"
    ? [...adminNextPreviewTrustedOrigins]
    : [];
}
