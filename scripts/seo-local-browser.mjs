// Isolated local-only browser fixture. Never use this script for deployment.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
const database = "seo_automation_browser_20260912";
const databaseUrl = `postgresql://phase2b_qa@127.0.0.1:55432/${database}`;
const port = "3217";

// Fixed disposable local fixture credentials, deliberately not real secrets.
// Read here for the local UI; never copy them into production or callback logs.
const fixtureAccount = {
  email: "seo-browser-admin@example.invalid",
  password: "Synthetic-local-browser-only-20260912",
};

if (!["seed", "build", "dev", "start"].includes(mode)) {
  console.log("Usage: node scripts/seo-local-browser.mjs seed|build|dev|start");
  process.exit(mode ? 1 : 0);
}
if (
  readdirSync(root).some(
    (file) => file.startsWith(".env") && file !== ".env.example",
  )
) {
  throw new Error(
    "Refusing a local browser fixture in a checkout with .env files. Use a clean dedicated worktree.",
  );
}

// Do not inherit provider credentials, remote DATABASE_URL or NODE_OPTIONS.
const systemKeys = new Set([
  "path",
  "pathext",
  "systemroot",
  "windir",
  "comspec",
  "temp",
  "tmp",
  "userprofile",
  "localappdata",
  "appdata",
  "programfiles",
  "programfiles(x86)",
  "commonprogramfiles",
  "systemdrive",
]);
const environment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    systemKeys.has(key.toLowerCase()),
  ),
);
Object.assign(environment, {
  NODE_ENV: ["build", "start"].includes(mode) ? "production" : "development",
  DATABASE_URL: databaseUrl,
  PAYLOAD_SECRET: "synthetic-local-browser-signing-only-20260912",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  NEXT_TELEMETRY_DISABLED: "1",
  PAYLOAD_TELEMETRY_DISABLED: "true",
  FEATURE_AI_DRAFTS: "false",
  FEATURE_SEO_SCHEDULER: "false",
  FEATURE_SEO_AUTO_PUBLISH: "false",
  PUBLIC_HOST_REDIRECTS_ENABLED: "false",
});
process.env = environment;
process.chdir(root);

if (mode !== "seed") {
  const args =
    mode === "build"
      ? ["build", "--webpack"]
      : [
          mode,
          "--hostname",
          "127.0.0.1",
          "--port",
          port,
          ...(mode === "dev" ? ["--webpack"] : []),
        ];
  const child = spawn(
    process.execPath,
    [path.join(root, "node_modules/next/dist/bin/next"), ...args],
    { cwd: root, env: environment, stdio: "inherit", windowsHide: true },
  );
  child.on("error", () => {
    console.error("Local Next process could not start.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} else {
  const require = createRequire(import.meta.url);
  const { Client } = require("pg");
  const client = new Client({
    connectionString: "postgresql://phase2b_qa@127.0.0.1:55432/postgres",
  });
  await client.connect();
  try {
    const found = await client.query(
      "select 1 from pg_database where datname=$1",
      [database],
    );
    if (!found.rowCount)
      await client.query('create database "seo_automation_browser_20260912"');
  } finally {
    await client.end();
  }

  // Full app schema is pushed only into the fixed disposable local database.
  const jiti = require("jiti")(import.meta.url, {
    esmResolve: true,
    interopDefault: true,
    tsconfigPaths: path.join(root, "tsconfig.json"),
  });
  const imported = await jiti.import(path.join(root, "src/payload.config.ts"));
  const { getPayload } = await import("payload");
  const payload = await getPayload({ config: imported.default ?? imported });
  try {
    const users = await payload.find({
      collection: "users",
      overrideAccess: true,
      limit: 1,
      where: { email: { equals: fixtureAccount.email } },
    });
    if (!users.docs.length)
      await payload.create({
        collection: "users",
        overrideAccess: true,
        data: {
          ...fixtureAccount,
          displayName: "Synthetic SEO Browser Admin",
          role: "admin",
          active: true,
          interfaceLanguage: "lt",
        },
      });
    const { validGeneratedArticle } = await jiti.import(
      path.join(root, "src/lib/blog/test-fixtures.ts"),
    );
    const article = validGeneratedArticle();
    for (const state of ["draft", "published-with-draft"]) {
      const slug = `seo-local-${state}`;
      const found = await payload.find({
        collection: "posts",
        draft: true,
        overrideAccess: true,
        limit: 1,
        where: { slug: { equals: slug } },
      });
      if (found.docs.length) continue;
      const created = await payload.create({
        collection: "posts",
        draft: true,
        overrideAccess: true,
        data: {
          slug,
          titleNo: `Syntetisk lokal test: ${state}`,
          titleEn: `Synthetic local test: ${state}`,
          contentNo: `## Kun lokal test\n\nDette er syntetisk testinnhold, ikke en publiseringsklar fagartikkel.\n\n${article.content}`,
          contentEn:
            "Synthetic local browser test content. Not a customer article.",
          excerptNo: article.excerpt,
          seoTitleNo: article.seoTitle,
          seoDescriptionNo: article.seoDescription,
          primaryKeyword: article.primaryKeyword,
          sources: article.sources,
          authorName: "Synthetic local fixture",
          aiAssisted: false,
          editorialStatus: "human_review",
          _status: "draft",
        },
      });
      if (state === "published-with-draft") {
        await payload.update({
          collection: "posts",
          id: created.id,
          draft: true,
          overrideAccess: true,
          data: {
            editorialStatus: "approved",
            reviewerName: "Synthetic fixture reviewer",
            reviewedAt: new Date().toISOString(),
          },
        });
        await payload.update({
          collection: "posts",
          id: created.id,
          draft: false,
          overrideAccess: true,
          data: { _status: "published" },
        });
        await payload.update({
          collection: "posts",
          id: created.id,
          draft: true,
          overrideAccess: true,
          data: {
            contentNo: `${created.contentNo}\n\n## Bare i utkastet\n\nDenne teksten finnes bare i det siste lokale utkastet.`,
            _status: "draft",
          },
        });
      }
    }
    console.log(
      `Synthetic browser schema and fixtures ready at http://localhost:${port}/admin-v2/blog (server not started).`,
    );
    console.log(
      "Local admin credentials are in this script only; no provider credentials were loaded.",
    );
  } finally {
    await payload.destroy();
  }
  process.exit(0);
}
