export const PREVIEW_E2E_ISOLATED_DB_FINGERPRINT =
  "ancient-band-aujp1u5u";

/**
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
export function assertE2EAccountSeedEnvironment(environment = process.env) {
  if (environment.E2E_SEED_ALLOWED !== "true") {
    throw new Error(
      "Refusing to seed browser-test accounts without E2E_SEED_ALLOWED=true",
    );
  }
  const databaseUrl = environment.DATABASE_URL?.trim();
  let actualHost;
  try {
    if (!databaseUrl) throw new Error("missing database URL");
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      throw new Error("not PostgreSQL");
    }
    actualHost = parsed.hostname;
  } catch {
    throw new Error("Preview E2E account seeding requires a PostgreSQL URL");
  }

  const localCiDatabase =
    environment.CI === "true" &&
    (actualHost === "127.0.0.1" || actualHost === "localhost");
  if (localCiDatabase) return { databaseHost: actualHost };

  if (environment.VERCEL_ENV !== "preview") {
    throw new Error("Refusing to seed browser-test accounts outside Preview");
  }

  const expectedHost = environment.PREVIEW_E2E_EXPECTED_DB_HOST?.trim();
  if (!expectedHost) {
    throw new Error(
      "Preview E2E account seeding requires an exact database host",
    );
  }

  if (
    actualHost !== expectedHost ||
    !actualHost.includes(PREVIEW_E2E_ISOLATED_DB_FINGERPRINT)
  ) {
    throw new Error(
      "Refusing to seed accounts outside the approved isolated Preview database",
    );
  }

  return { databaseHost: actualHost };
}
