// Isolated local-only browser fixture. Never use this script for deployment.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cpSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import {
  fixtureMetadataPatch,
  localReviewFlags,
} from "./seo-local-fixture-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewCanary = process.argv[2] === "start-review-canary";
const mode = reviewCanary ? "start" : process.argv[2];
const database = "seo_automation_browser_20260912";
const databaseUrl = `postgresql://phase2b_qa@127.0.0.1:55432/${database}`;
const port = "3217";

// Fixed disposable local fixture credentials, deliberately not real secrets.
// Read here for the local UI; never copy them into production or callback logs.
const fixtureAccount = {
  email: "seo-browser-admin@example.invalid",
  password: "Synthetic-local-browser-only-20260912",
};

if (
  ![
    "seed",
    "repair-fixtures",
    "add-unique-fixture",
    "api-e2e",
    "build",
    "dev",
    "start",
  ].includes(mode)
) {
  console.log(
    "Usage: node scripts/seo-local-browser.mjs seed|repair-fixtures|add-unique-fixture|build|dev|start|start-review-canary",
  );
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
  ...localReviewFlags(reviewCanary),
  PUBLIC_HOST_REDIRECTS_ENABLED: "false",
});
process.env = environment;
process.chdir(root);

if (mode === "api-e2e") {
  const require = createRequire(import.meta.url);
  const jiti = require("jiti")(import.meta.url, {
    alias: { "@": path.join(root, "src") },
  });
  const { validGeneratedArticle } = await jiti.import(
    path.join(root, "src/lib/blog/test-fixtures.ts"),
  );
  const { runLocalBlogApiE2E } = await import("./seo-local-api-e2e.mjs");
  await runLocalBlogApiE2E({
    account: fixtureAccount,
    article: validGeneratedArticle(),
  });
  process.exit(process.exitCode || 0);
}

if (!["seed", "repair-fixtures", "add-unique-fixture"].includes(mode)) {
  if (reviewCanary)
    console.log(
      "LOCAL review-canary UI flags enabled for the fixed synthetic database only. AI remains OFF, no cron credential or executor is configured.",
    );
  const standalone = path.join(root, ".next", "standalone");
  if (mode === "start") {
    if (!existsSync(path.join(standalone, "server.js"))) {
      throw new Error(
        "Run the isolated local build before starting its standalone server.",
      );
    }
    // Only generated build output is populated. No source or shared data is
    // moved/deleted. Next's standalone server needs its own static/public files.
    for (const relative of ["public", ".next/static"]) {
      const destination = path.resolve(standalone, relative);
      if (!destination.startsWith(`${standalone}${path.sep}`))
        throw new Error("Unexpected standalone asset destination");
      cpSync(path.join(root, relative), destination, { recursive: true });
    }
    environment.HOSTNAME = "127.0.0.1";
    environment.PORT = port;
  }
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
    mode === "start"
      ? [path.join(standalone, "server.js")]
      : [path.join(root, "node_modules/next/dist/bin/next"), ...args],
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
    if (!found.rowCount && mode !== "seed")
      throw new Error(
        "Seed the fixed local fixture database before repairing fixtures",
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
    if (!users.docs.length && mode !== "seed")
      throw new Error(
        "The isolated fixture administrator is missing; repair does not create accounts",
      );
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
    if (mode === "repair-fixtures" || mode === "add-unique-fixture") {
      const { postRevision } = await jiti.import(
        path.join(root, "src/lib/blog/post-revision.ts"),
      );
      for (const slug of mode === "repair-fixtures"
        ? ["seo-local-draft", "seo-local-published-with-draft"]
        : []) {
        const found = await payload.find({
          collection: "posts",
          draft: true,
          overrideAccess: true,
          depth: 0,
          limit: 1,
          where: { slug: { equals: slug } },
        });
        const post = found.docs[0];
        if (!post)
          throw new Error(
            "A named local fixture is missing; no content replacement is permitted",
          );
        const patch = fixtureMetadataPatch(post, article);
        if (Object.keys(patch).length) {
          const repaired = await payload.update({
            collection: "posts",
            id: post.id,
            draft: true,
            overrideAccess: true,
            context: {
              expectedBlogUpdatedAt: post.updatedAt,
              expectedBlogRevision: postRevision(post),
            },
            data: patch,
          });
          for (const key of [
            "titleNo",
            "contentNo",
            "titleEn",
            "contentEn",
            "slug",
            "authorName",
          ]) {
            if (repaired[key] !== post[key])
              throw new Error(
                "Fixture repair unexpectedly changed protected content",
              );
          }
        }
      }
      // A separate complete fixture avoids changing either operator-edited title
      // merely to eliminate their synthetic topic overlap. Never overwrite it.
      const completeSlug =
        mode === "add-unique-fixture"
          ? "seo-local-unique-approval"
          : "seo-local-approval";
      const complete = await payload.find({
        collection: "posts",
        draft: true,
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: { slug: { equals: completeSlug } },
      });
      let approvalPost = complete.docs[0];
      if (approvalPost && approvalPost.authorName !== "Synthetic local fixture")
        throw new Error(
          "The fixture slug belongs to a different author; no update is permitted",
        );
      if (!complete.docs.length) {
        approvalPost = await payload.create({
          collection: "posts",
          draft: true,
          overrideAccess: true,
          data: {
            slug: completeSlug,
            titleNo:
              mode === "add-unique-fixture"
                ? "Syntetisk test – trygg planlegging av takvask"
                : "Syntetisk test – hva påvirker prisen på takvask?",
            contentNo: article.content,
            excerptNo: article.excerpt,
            seoTitleNo: article.seoTitle,
            seoDescriptionNo: article.seoDescription,
            primaryKeyword: article.primaryKeyword,
            sources: article.sources,
            authorName: "Synthetic local fixture",
            ...fixtureMetadataPatch(
              {
                slug: "seo-local-draft",
                authorName: "Synthetic local fixture",
              },
              article,
            ),
            aiAssisted: true,
            editorialStatus: "human_review",
            _status: "draft",
          },
        });
      }
      const { evaluateEditedBlogDraft } = await jiti.import(
        path.join(root, "src/lib/blog/edited-draft-quality.ts"),
      );
      const otherPosts = await payload.find({
        collection: "posts",
        depth: 0,
        limit: 500,
        pagination: false,
        overrideAccess: true,
        where: { id: { not_equals: approvalPost.id } },
      });
      const preflight = evaluateEditedBlogDraft({
        post: approvalPost,
        edits: approvalPost,
        existing: otherPosts.docs.map((post) => ({
          title: post.titleNo,
          primaryKeyword: post.primaryKeyword,
        })),
      });
      console.log(
        JSON.stringify({
          approvalFixtureId: approvalPost.id,
          qualityWouldPass: preflight.passed,
          score: preflight.score,
          issueCodes: preflight.issues.map((issue) => issue.code),
        }),
      );
      console.log(
        "Requested local fixture is ready without replacing saved text. Complete approval fixture remains review-required; no approval, publication or provider call was performed.",
      );
    } else {
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
            ...fixtureMetadataPatch(
              { slug, authorName: "Synthetic local fixture" },
              article,
            ),
            aiAssisted: false,
            editorialStatus: "human_review",
            _status: "draft",
          },
        });
        if (state === "published-with-draft") {
          const { evaluateEditedBlogDraft } = await jiti.import(
            path.join(root, "src/lib/blog/edited-draft-quality.ts"),
          );
          const quality = evaluateEditedBlogDraft({
            post: created,
            edits: created,
          });
          if (!quality.passed)
            throw new Error(
              "Synthetic published fixture must pass current quality rules before setup publication",
            );
          await payload.update({
            collection: "posts",
            id: created.id,
            draft: true,
            overrideAccess: true,
            context: { trustedBlogQualityRevalidation: true },
            data: { qualityChecks: quality, qualityScore: quality.score },
          });
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
    }
  } finally {
    await payload.destroy();
  }
  process.exit(0);
}
