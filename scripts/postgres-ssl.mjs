/**
 * Local PostgreSQL containers normally do not expose TLS, while hosted
 * PostgreSQL providers do. An explicit sslmode=disable or PGSSLMODE=disable is
 * therefore the only way to turn TLS off; hosted connections keep the existing
 * encrypted compatibility setting.
 * @param {string} databaseUrl
 * @param {Readonly<Record<string, string | undefined>>} environment
 */
export function postgresSslOptions(databaseUrl, environment = process.env) {
  const environmentMode = environment.PGSSLMODE?.trim().toLowerCase();
  let urlMode;
  try {
    urlMode = new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase();
  } catch {
    urlMode = undefined;
  }

  return environmentMode === "disable" || urlMode === "disable"
    ? false
    : { rejectUnauthorized: false };
}
