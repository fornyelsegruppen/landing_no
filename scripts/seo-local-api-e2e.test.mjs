import { test } from "node:test";
import assert from "node:assert/strict";
import { runLocalBlogApiE2E } from "./seo-local-api-e2e.mjs";

test("API harness rejects a remote database before any network request", async () => {
  const prior = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = "postgresql://example.invalid/not-local";
    await assert.rejects(runLocalBlogApiE2E({}), /AssertionError/);
  } finally {
    if (prior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prior;
  }
});
test("API harness rejects a non-local configured origin before login", async () => {
  const database = process.env.DATABASE_URL;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.DATABASE_URL =
      "postgresql://phase2b_qa@127.0.0.1:55432/seo_automation_browser_20260912";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
    await assert.rejects(runLocalBlogApiE2E({}), /AssertionError/);
  } finally {
    if (database === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = database;
    if (origin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = origin;
  }
});
