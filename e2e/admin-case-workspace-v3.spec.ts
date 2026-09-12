import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const caseId = process.env.E2E_ADMIN_CASE_ID;
const documentHref = process.env.E2E_ADMIN_CASE_DOCUMENT_HREF;
const documentAccessibleName = process.env.E2E_ADMIN_CASE_DOCUMENT_NAME;
const documentPage = process.env.E2E_ADMIN_CASE_DOCUMENT_PAGE;
const olderMessageId = process.env.E2E_ADMIN_CASE_OLDER_MESSAGE_ID;
const olderMessagePage = process.env.E2E_ADMIN_CASE_OLDER_MESSAGE_PAGE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const requiredFixtureVariables = [
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_ADMIN_CASE_ID",
  "E2E_ADMIN_CASE_DOCUMENT_HREF",
  "E2E_ADMIN_CASE_DOCUMENT_NAME",
  "E2E_ADMIN_CASE_OLDER_MESSAGE_ID",
  "E2E_ADMIN_CASE_OLDER_MESSAGE_PAGE",
] as const;

function baseURLHost() {
  try {
    return new URL(baseURL).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const host = baseURLHost();
const isLocalHost = host === "localhost" || host === "127.0.0.1";
const isProductionHost =
  host === "takfornyelse.no" || host?.endsWith(".takfornyelse.no") === true;
const externalBaseURLNeedsOptIn =
  Boolean(host) &&
  !isLocalHost &&
  process.env.E2E_ADMIN_CASE_ALLOW_NONPROD !== "1";
const missingFixtureVariables = requiredFixtureVariables.filter(
  (name) => !process.env[name],
);
const fixtureReady =
  missingFixtureVariables.length === 0 &&
  !isProductionHost &&
  !externalBaseURLNeedsOptIn;

const skipReason = isProductionHost
  ? "Skipped: Admin Case Workspace E2E refuses production hosts"
  : externalBaseURLNeedsOptIn
    ? "Skipped: set E2E_ADMIN_CASE_ALLOW_NONPROD=1 for an explicitly approved non-production base URL"
    : missingFixtureVariables.length
      ? `Skipped: synthetic Admin Case Workspace fixture is not configured; set ${missingFixtureVariables.join(", ")}`
      : "";

const viewportCases = [
  { height: 800, width: 360 },
  { height: 812, width: 375 },
  { height: 1024, width: 768 },
  { height: 800, width: 1280 },
] as const;

async function signInAndOpenCase(page: Page) {
  if (!adminEmail || !adminPassword || !caseId) {
    throw new Error("Admin case fixture credentials and case ID are required");
  }

  const response = await page.request.post("/api/users/login", {
    data: { email: adminEmail, password: adminPassword },
    headers: { origin: new URL(baseURL).origin },
  });
  expect(response.ok()).toBe(true);
  await page.goto(`/admin-v2/cases/${encodeURIComponent(caseId)}`);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("[data-case-primary-action]")).toHaveCount(1);
}

async function assertWorkspaceGeometry(page: Page) {
  const geometry = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const stageRects = Array.from(
      document.querySelectorAll<HTMLElement>("[data-process-stage]"),
    )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const primaryTitle = document.getElementById("next-action-title");
    const primaryTitleRect = primaryTitle?.getBoundingClientRect();
    const overlappingStages: Array<[number, number]> = [];
    for (let first = 0; first < stageRects.length; first += 1) {
      for (let second = first + 1; second < stageRects.length; second += 1) {
        const a = stageRects[first];
        const b = stageRects[second];
        if (
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top
        ) {
          overlappingStages.push([first, second]);
        }
      }
    }
    return {
      bodyOverflow: document.body.scrollWidth - viewportWidth,
      documentOverflow: document.documentElement.scrollWidth - viewportWidth,
      overlappingStages,
      primaryTitleInViewport:
        Boolean(primaryTitleRect) &&
        primaryTitleRect!.width > 0 &&
        primaryTitleRect!.left >= -1 &&
        primaryTitleRect!.right <= viewportWidth + 1,
      viewportWidth,
    };
  });

  expect(geometry.viewportWidth).toBeGreaterThan(0);
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.bodyOverflow).toBeLessThanOrEqual(1);
  expect(geometry.overlappingStages).toEqual([]);
  expect(geometry.primaryTitleInViewport).toBe(true);
}

async function openPrimaryAction(page: Page) {
  const shortcut = page.locator("[data-case-primary-shortcut]:visible");
  await expect(shortcut).toHaveCount(1);
  await shortcut.click();
  await expect(page.locator("#next-action-title")).toBeVisible();
}

async function openInspectorFromFirstInspectableStage(page: Page) {
  const stage = page
    .locator("[data-process-stage]")
    .filter({ has: page.locator("button[aria-expanded]") })
    .first();
  await expect(stage).toBeVisible();

  const stageToggle = stage.locator("button[aria-expanded]").first();
  await stageToggle.click();
  await expect(stageToggle).toHaveAttribute("aria-expanded", "true");

  const stagePanel = stage.locator('[id^="case-process-panel-"]').first();
  const inspectorTrigger = stagePanel.locator("button").last();
  await expect(inspectorTrigger).toBeVisible();
  await inspectorTrigger.click();

  const inspector = page.locator("[data-case-inspector]");
  await expect(inspector).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.activeElement?.closest("[data-case-inspector]") !== null,
      ),
    )
    .toBe(true);

  return inspectorTrigger;
}

test.describe("Admin Case Workspace V3 browser acceptance", () => {
  test.skip(!fixtureReady, skipReason);
  test.describe.configure({ mode: "serial" });

  test("keeps one primary action and clean geometry at 360/375/768/1280", async ({
    page,
  }) => {
    await signInAndOpenCase(page);

    for (const viewport of viewportCases) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        await page.setViewportSize(viewport);
        await page.goto(`/admin-v2/cases/${encodeURIComponent(caseId!)}`);
        await expect(page.locator("[data-case-primary-action]")).toHaveCount(1);
        await expect(page.locator("#next-action-title")).toHaveCount(1);
        await openPrimaryAction(page);
        await assertWorkspaceGeometry(page);
      });
    }
  });

  test("traps inspector focus, closes on Escape, and returns focus to its trigger", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signInAndOpenCase(page);

    const inspectorTrigger = await openInspectorFromFirstInspectableStage(page);
    await page.keyboard.press("Escape");

    await expect(page.locator("[data-case-inspector]")).toHaveCount(0);
    await expect(inspectorTrigger).toBeFocused();
  });

  test("keeps the configured document deep-link exact", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAndOpenCase(page);

    if (!documentHref || !documentAccessibleName) {
      throw new Error("Document link fixture variables are required");
    }
    if (documentPage) {
      if (
        !Number.isSafeInteger(Number(documentPage)) ||
        Number(documentPage) < 1
      )
        throw new Error("Document page must be a positive integer");
      await page.goto(
        `/admin-v2/cases/${encodeURIComponent(caseId!)}?documentPage=${encodeURIComponent(documentPage)}`,
      );
    }

    const documentLinks = page.locator("a");
    await expect
      .poll(() =>
        documentLinks.evaluateAll(
          (links, expectedHref) =>
            links
              .filter((link) => link.getAttribute("href") === expectedHref)
              .map(
                (link) =>
                  link.getAttribute("aria-label") || link.textContent?.trim(),
              ),
          documentHref,
        ),
      )
      .toContain(documentAccessibleName);

    const exactLink = page.getByRole("link", {
      exact: true,
      name: documentAccessibleName,
    });
    await expect(exactLink).toHaveAttribute("href", documentHref);
  });

  test("reveals the configured older message when its deep-link is opened", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signInAndOpenCase(page);

    if (
      !olderMessageId ||
      !olderMessagePage ||
      !Number.isSafeInteger(Number(olderMessagePage)) ||
      Number(olderMessagePage) <= 1
    ) {
      throw new Error(
        "Older message fixture must identify a message on a later page (page > 1)",
      );
    }

    const escapedOlderMessageId = olderMessageId
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"');
    const olderMessage = page.locator(
      `[id="message-${escapedOlderMessageId}"]`,
    );
    // This must exercise server pagination, not an already-loaded hidden row.
    await expect(olderMessage).toHaveCount(0);
    const disclosure = olderMessage.locator("xpath=ancestor::details[1]");

    await page.goto(
      `/admin-v2/cases/${encodeURIComponent(caseId!)}?messagePage=${encodeURIComponent(olderMessagePage)}#message-${encodeURIComponent(olderMessageId)}`,
    );
    // A sparse final page can contain only a recent row and no disclosure.
    // When a disclosure exists, the hash navigation must open it.
    if (await disclosure.count())
      await expect(disclosure).toHaveAttribute("open", "");
    await expect(olderMessage).toBeVisible();
  });
});
