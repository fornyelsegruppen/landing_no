import { createHash } from "node:crypto";

export type PreviewDatabaseTarget =
  | {
      status: "configured";
      endpointFingerprint: string;
      projectFingerprint: string;
      source: "DATABASE_URL";
    }
  | { status: "invalid" | "missing" };

export function databaseEndpointFingerprint(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new TypeError("Database URL is not PostgreSQL");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith(".neon.tech")) {
    throw new TypeError("Database URL is not a Neon endpoint");
  }
  const endpointId = hostname.split(".")[0]?.replace(/-pooler$/, "") || "";
  if (!/^ep-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(endpointId)) {
    throw new TypeError("Database URL has an invalid Neon endpoint ID");
  }
  return createHash("sha256").update(endpointId).digest("hex").slice(0, 16);
}

export function previewDatabaseTarget(
  environment: {
    DATABASE_URL?: string;
    NEON_PROJECT_ID?: string;
    VERCEL_ENV?: string;
  } = {
    DATABASE_URL: process.env.DATABASE_URL,
    NEON_PROJECT_ID: process.env.NEON_PROJECT_ID,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
): PreviewDatabaseTarget | null {
  if (environment.VERCEL_ENV !== "preview") return null;
  const databaseUrl = environment.DATABASE_URL?.trim();
  const projectId = environment.NEON_PROJECT_ID?.trim();
  if (!databaseUrl || !projectId) return { status: "missing" };
  try {
    return {
      status: "configured",
      endpointFingerprint: databaseEndpointFingerprint(databaseUrl),
      projectFingerprint: createHash("sha256")
        .update(projectId)
        .digest("hex")
        .slice(0, 16),
      source: "DATABASE_URL",
    };
  } catch {
    return { status: "invalid" };
  }
}
