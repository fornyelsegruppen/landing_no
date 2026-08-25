import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const workerEmail = process.env.E2E_WORKER_EMAIL;
const workerPassword = process.env.E2E_WORKER_PASSWORD;
const hasSyntheticAccounts = Boolean(adminEmail && adminPassword && workerEmail && workerPassword);

test.describe("authenticated internal portals", () => {
  test.skip(!hasSyntheticAccounts, "Synthetic E2E credentials are not configured");

  test("administrator can use the custom dashboard and switch its language", async ({ page }) => {
    const loginResponse = await page.request.post("/api/users/login", {
      data: { email: adminEmail, password: adminPassword },
      headers: { origin: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").origin },
    });
    expect(loginResponse.ok()).toBe(true);

    await page.goto("/admin-v2");
    const language = page.locator("header select").first();
    await language.selectOption("en");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText("New enquiries", { exact: true })).toBeVisible();
    await expect(page.getByText("The panel language does not change customer copy", { exact: false })).toBeVisible();

    await language.selectOption("lt");
    await expect(page.getByRole("heading", { level: 1, name: "Apžvalga" })).toBeVisible();
    await expect(page.getByText("Naujos užklausos", { exact: true })).toBeVisible();
    await page.locator("header select").first().selectOption("en");
  });

  test("worker sees only the assigned-work portal", async ({ page }) => {
    const loginResponse = await page.request.post("/api/users/login", {
      data: { email: workerEmail, password: workerPassword },
      headers: { origin: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").origin },
    });
    expect(loginResponse.ok()).toBe(true);

    await page.goto("/user");
    await expect(page.getByRole("heading", { level: 1, name: /QA Worker/ })).toBeVisible();
    await expect(page.getByText("You only see work assigned to your account", { exact: false })).toBeVisible();

    await page.goto("/admin-v2");
    await expect(page).toHaveURL(/\/user(?:$|\?)/);
    await expect(page.getByText("New enquiries", { exact: true })).toHaveCount(0);
  });
});
