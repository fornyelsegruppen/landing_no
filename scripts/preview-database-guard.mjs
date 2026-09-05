import { createHash } from "node:crypto";

export function normalizedNeonEndpointId(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Refusing Preview migration with an invalid DATABASE_URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(
      "Refusing Preview migration because DATABASE_URL is not PostgreSQL.",
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith(".neon.tech")) {
    throw new Error(
      "Refusing Preview migration because DATABASE_URL is not a Neon endpoint.",
    );
  }
  const endpointId = hostname.split(".")[0]?.replace(/-pooler$/, "") || "";
  if (!/^ep-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(endpointId)) {
    throw new Error(
      "Refusing Preview migration because the Neon endpoint ID is invalid.",
    );
  }
  return endpointId;
}

export function assertPreviewMigrationDatabase(environment = process.env) {
  if (environment.VERCEL_ENV !== "preview") return null;
  if (environment.DATABASE_URL_MIGRATE?.trim()) {
    throw new Error(
      "Refusing Preview migration while DATABASE_URL_MIGRATE overrides the deployment database branch.",
    );
  }
  const previewRuntimeUrl = environment.DATABASE_URL?.trim() || "";
  if (!previewRuntimeUrl) {
    throw new Error(
      "Refusing Preview migration without the deployment DATABASE_URL.",
    );
  }
  const protectedBaseFingerprint =
    environment.PREVIEW_BASE_DATABASE_ENDPOINT_SHA256?.trim().toLowerCase() ||
    "";
  if (!/^[a-f0-9]{64}$/.test(protectedBaseFingerprint)) {
    throw new Error(
      "Refusing Preview migration without a valid protected-base database endpoint fingerprint.",
    );
  }
  const expectedProjectId =
    environment.PREVIEW_EXPECTED_NEON_PROJECT_ID?.trim() || "";
  const actualProjectId = environment.NEON_PROJECT_ID?.trim() || "";
  if (!expectedProjectId || actualProjectId !== expectedProjectId) {
    throw new Error(
      "Refusing Preview migration because the Neon project identity does not match the approved resource.",
    );
  }
  const previewFingerprint = createHash("sha256")
    .update(normalizedNeonEndpointId(previewRuntimeUrl))
    .digest("hex");
  if (previewFingerprint === protectedBaseFingerprint) {
    throw new Error(
      "Refusing Preview migration because the deployment database is the protected base branch.",
    );
  }
  return previewFingerprint;
}
