import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { assertE2EAccountSeedEnvironment } from "./seed-e2e-accounts-safety.mjs";

assertE2EAccountSeedEnvironment(process.env);

// One-shot Preview account setup must never invoke the development schema-push
// path. The target schema is migrated separately before this script runs.
process.env.NODE_ENV = "production";

const accounts = [
  {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
    displayName: "QA Administrator",
    phone: "+4790009001",
    role: "admin",
    interfaceLanguage: "en",
  },
  {
    email: process.env.E2E_WORKER_EMAIL,
    password: process.env.E2E_WORKER_PASSWORD,
    displayName: "QA Worker",
    phone: "+4790009002",
    role: "worker",
    interfaceLanguage: "en",
  },
];

for (const account of accounts) {
  if (!account.email?.endsWith("@example.invalid") || !account.password || account.password.length < 12) {
    throw new Error("E2E accounts must use example.invalid email and a 12+ character password");
  }
}

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jiti = require("jiti")(import.meta.url, {
  esmResolve: true,
  interopDefault: true,
  tsconfigPaths: path.resolve(__dirname, "../tsconfig.json"),
});
const configModule = await jiti.import(path.resolve(__dirname, "../src/payload.config.ts"));
const config = configModule.default ?? configModule;
const { getPayload } = await import("payload");
const payload = await getPayload({ config });

try {
  for (const account of accounts) {
    const existing = await payload.find({
      collection: "users",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { email: { equals: account.email } },
    });
    if (existing.totalDocs > 0) continue;
    await payload.create({
      collection: "users",
      overrideAccess: true,
      data: { ...account, active: true },
    });
  }
  console.log("Synthetic E2E admin and worker accounts are ready.");
} finally {
  await Promise.race([
    payload.db.destroy(),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

// Payload can retain logger or adapter handles after a one-shot script. Every
// database write above is awaited; exiting here keeps CI deterministic.
process.exit(0);
