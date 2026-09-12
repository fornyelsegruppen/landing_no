import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3217";
const target = new URL(baseURL);
if (
  target.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.port !== "3217" ||
  target.pathname !== "/" ||
  target.search ||
  target.hash ||
  target.username ||
  target.password
) {
  throw new Error("ONE UI browser acceptance requires the frozen local3217 runtime");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "admin-case-workspace-v3.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // No webServer: never launch/restart Next or initialize another database.
});
