import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const workerEmail = process.env.E2E_WORKER_EMAIL;
const workerPassword = process.env.E2E_WORKER_PASSWORD;
const hasSyntheticAccounts = Boolean(adminEmail && adminPassword && workerEmail && workerPassword);

async function expectBasicAccessibility(page: Page) {
  const issues = await page.evaluate(() => {
    const result: string[] = [];
    const name = (element: Element) =>
      element.getAttribute("aria-label")
      || element.getAttribute("title")
      || element.textContent?.trim()
      || element.querySelector("img")?.getAttribute("alt")
      || "";
    for (const element of document.querySelectorAll("a[href], button")) {
      if (!name(element)) result.push(`Unnamed ${element.tagName.toLowerCase()}`);
    }
    for (const element of document.querySelectorAll("input, select, textarea")) {
      const id = element.getAttribute("id");
      const labelled = element.getAttribute("aria-label")
        || element.getAttribute("aria-labelledby")
        || (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
        || element.closest("label");
      if (!labelled) result.push(`Unlabelled ${element.tagName.toLowerCase()}`);
    }
    const duplicateIds = [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    if (duplicateIds.length) result.push(`Duplicate ids: ${[...new Set(duplicateIds)].join(",")}`);
    return result;
  });
  expect(issues).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

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

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expectBasicAccessibility(page);
  });

  test("worker sees only the assigned-work portal", async ({ page }) => {
    const loginResponse = await page.request.post("/api/users/login", {
      data: { email: workerEmail, password: workerPassword },
      headers: { origin: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").origin },
    });
    expect(loginResponse.ok()).toBe(true);

    await page.goto("/user");
    await expect(page.getByRole("heading", { level: 1, name: /QA Worker/ })).toBeVisible();
    await expect(page.getByText("You only see jobs assigned to you.", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expectBasicAccessibility(page);

    await page.goto("/admin-v2");
    await expect(page).toHaveURL(/\/user(?:$|\?)/);
    await expect(page.getByText("New enquiries", { exact: true })).toHaveCount(0);
  });
});
