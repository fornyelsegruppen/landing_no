/** Refuse destructive adapter startup before any database connection. */
export function assertPayloadDatabaseStartupSafe(
  environment: Record<string, string | undefined> = process.env,
) {
  if (
    environment.NODE_ENV === "production" &&
    environment.PAYLOAD_DROP_DATABASE === "true"
  ) {
    throw new Error("PAYLOAD_DROP_DATABASE must not be enabled in production");
  }
}
