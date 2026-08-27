import { expect, test } from "@playwright/test";

test("Norwegian landing page renders its primary content", async ({ page }) => {
  await page.goto("/no");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Gi taket nytt liv – uten full utskifting",
    }),
  ).toBeVisible();
  await expect(page.getByText("99", { exact: true })).toBeVisible();
  await expect(page.getByText("138", { exact: true })).toBeVisible();
  await expect(page.getByText("337", { exact: true })).toBeVisible();
  await expect(page.getByText("375 000 kr", { exact: true })).toBeVisible();
  await expect(page.getByText("63 188 kr", { exact: true })).toBeVisible();
  await expect(page.getByText("311 813 kr", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "I dette regneeksempelet er takfornying omtrent 83 % rimeligere",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "5,0/5 på Google · 2 omtaler" }),
  ).toHaveAttribute("href", "https://g.page/r/CYa-JdXzZzxbEBM/review");
  const reviewSection = page.locator("#omtaler");
  await expect(reviewSection.getByText("Ola Brage Hansen")).toBeVisible();
  await expect(reviewSection.getByText("Gerda Rekevičiūtė")).toBeVisible();
  await expect(
    reviewSection.getByRole("link", { name: "Se omtalen på Google Maps" }),
  ).toHaveCount(2);
  await expect(page.locator("#kontakt")).toBeAttached();
});

test("customer review page links to the verified Google review form", async ({
  page,
}) => {
  await page.goto("/no/kundeomtaler");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Del din erfaring med Takfornyelse",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Vurder Takfornyelse på Google" }).first(),
  ).toHaveAttribute("href", "https://g.page/r/CYa-JdXzZzxbEBM/review");
  await expect(page.getByText("4.9/5 på Google")).toHaveCount(0);
  await expect(page.getByText("Kunde, Oslo")).toHaveCount(0);
  await expect(page.getByText("Ola Brage Hansen")).toBeVisible();
  await expect(page.getByText("Gerda Rekevičiūtė")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Se omtalen på Google Maps" }),
  ).toHaveCount(2);
});

test("English calculator uses English NOK formatting", async ({ page }) => {
  await page.goto("/en#kalkulator");

  await expect(page.getByText("NOK 375,000", { exact: true })).toBeVisible();
  await expect(page.getByText("NOK 63,188", { exact: true })).toBeVisible();
  await expect(page.getByText("NOK 421.25/m²", { exact: true })).toBeVisible();
});

test("roof guide links visitors to the priority service pages", async ({
  page,
}) => {
  await page.goto("/no/blogg");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Takguide for boligeiere",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Les guiden" })).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: "Les guiden" }).first(),
  ).toHaveAttribute("href", "/no/takvask");
  await expect(page.getByText("Ingen publiserte innlegg ennå.")).toHaveCount(0);
});

test("project gallery presents photos in a clear chronological order", async ({
  page,
}) => {
  await page.goto("/no#referanser");

  const washingProject = page
    .getByRole("article")
    .filter({ hasText: "Prosjekt 1 / 3" });

  await expect(washingProject.getByRole("heading", { level: 4 })).toHaveText([
    "Før- og ettereksempler",
    "Flere bilder",
  ]);
  await expect(washingProject.locator("figure")).toHaveCount(4);
  await expect(
    washingProject.locator("figcaption > p:first-child"),
  ).toHaveText(["Før", "Etter", "Før", "Under arbeid"]);
});

test("public pages keep security headers and usable mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const response = await page.goto("/no");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
});

test("privacy page describes controlled quotes and job follow-up", async ({ page }) => {
  await page.goto("/no/personvern");
  const heading = page.getByRole("heading", {
    level: 2,
    name: "Tilbud, måling og oppdragsoppfølging",
  });
  await expect(heading).toBeVisible();
  await expect(heading.locator("xpath=following-sibling::p[1]")).toContainText(
    "AI bestemmer ikke pris",
  );
});

test("anonymous visitors cannot read the custom admin dashboard", async ({ page }) => {
  await page.goto("/admin-v2");

  await expect(page).toHaveURL(/\/admin\/login\?redirect=(%2F|%252F)admin-v2$/i);
  await expect(page.getByText("New enquiries", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Naujos užklausos", { exact: true })).toHaveCount(0);
});

test("anonymous and cross-site requests cannot cross internal API boundaries", async ({ request }) => {
  const health = await request.get("/api/admin/platform-health");
  expect(health.status()).toBe(401);

  const adminMedia = await request.get("/api/admin/media/999999");
  expect(adminMedia.status()).toBe(401);

  const workerMedia = await request.get("/api/worker/work-orders/999999/media/999999");
  expect(workerMedia.status()).toBe(401);

  const crossSite = await request.post("/api/lead", {
    data: {},
    headers: {
      origin: "https://cross-site.example.invalid",
      "sec-fetch-site": "cross-site",
    },
  });
  expect(crossSite.status()).toBe(403);
  await expect(crossSite.json()).resolves.toEqual({ error: "Cross-site request blocked" });
});
