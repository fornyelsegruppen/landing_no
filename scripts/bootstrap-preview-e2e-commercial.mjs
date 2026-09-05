import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const jiti = require("jiti")(import.meta.url, {
  esmResolve: true,
  interopDefault: true,
  tsconfigPaths: path.resolve(scriptDirectory, "../tsconfig.json"),
});

const commercial = await jiti.import(
  path.resolve(
    scriptDirectory,
    "../src/lib/platform/preview-e2e-commercial-config.ts",
  ),
);
commercial.assertPreviewE2ECommercialBootstrapEnvironment(process.env);

const action = process.env.PREVIEW_E2E_BOOTSTRAP_ACTION || "status";
if (!["apply", "rollback", "status"].includes(action)) {
  throw new Error("PREVIEW_E2E_BOOTSTRAP_ACTION must be apply, rollback, or status");
}
const administratorEmail = process.env.E2E_ADMIN_EMAIL?.trim().toLowerCase();
if (!administratorEmail?.endsWith("@example.invalid")) {
  throw new Error("E2E_ADMIN_EMAIL must use example.invalid");
}

process.env.NODE_ENV = "production";
process.env.FEATURE_ROOF_FUSION_V1 = "true";
const configModule = await jiti.import(
  path.resolve(scriptDirectory, "../src/payload.config.ts"),
);
const config = configModule.default ?? configModule;
const { getPayload } = await import("payload");
const payload = await getPayload({ config });

try {
  const administrators = await payload.find({
    collection: "users",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { email: { equals: administratorEmail } },
        { role: { equals: "admin" } },
        { active: { equals: true } },
      ],
    },
  });
  const administrator = administrators.docs[0];
  if (!administrator) throw new Error("Active synthetic E2E administrator not found");

  if (action === "apply") {
    const result = await commercial.ensurePreviewE2ECommercialConfig({
      payload,
      administrator,
      environment: process.env,
    });
    console.log(JSON.stringify(result));
  } else if (action === "rollback") {
    const result = await commercial.retirePreviewE2ECommercialConfig({
      payload,
      administrator,
      environment: process.env,
    });
    console.log(JSON.stringify(result));
  } else {
    const [terms, rules] = await Promise.all([
      payload.find({
        collection: "contract-terms",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { version: { equals: commercial.previewE2ETerms.version } },
      }),
      payload.find({
        collection: "price-rules",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          reference: { equals: commercial.previewE2EPriceRule.reference },
        },
      }),
    ]);
    console.log(
      JSON.stringify({
        status: "read_only",
        terms: terms.docs[0]
          ? { id: terms.docs[0].id, status: terms.docs[0].status }
          : null,
        priceRule: rules.docs[0]
          ? { id: rules.docs[0].id, status: rules.docs[0].status }
          : null,
      }),
    );
  }
} finally {
  await Promise.race([
    payload.db.destroy(),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

// Payload can retain logger or adapter handles after every awaited database
// operation. Match the existing E2E account bootstrap and terminate cleanly.
process.exit(0);
