import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { normalizedNeonEndpointId } from "./preview-database-guard.mjs";

const [environmentFile, variableName = "DATABASE_URL", expectedNeonProjectId] =
  process.argv.slice(2);
if (!environmentFile) {
  throw new TypeError(
    "Usage: node scripts/database-endpoint-fingerprint.mjs <env-file> [variable]",
  );
}

const fileEnvironment = parseEnv(await readFile(environmentFile, "utf8"));
const databaseUrl = fileEnvironment[variableName]?.trim();
if (!databaseUrl) {
  throw new TypeError(`${variableName} is missing from the environment file`);
}
if (
  expectedNeonProjectId &&
  fileEnvironment.NEON_PROJECT_ID?.trim() !== expectedNeonProjectId
) {
  throw new TypeError(
    "NEON_PROJECT_ID does not match the approved Preview resource",
  );
}

console.log(
  createHash("sha256")
    .update(normalizedNeonEndpointId(databaseUrl))
    .digest("hex"),
);
