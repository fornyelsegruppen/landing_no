import { defineConfig } from "@playwright/test";

/** Run against a local dev server started with ADMIN_NEXT_VISUAL_FIXTURE=true. */
export default defineConfig({
  testDir: ".",
  testMatch: "roof-fusion-drawing.spec.ts",
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
