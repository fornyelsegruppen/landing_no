import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.F2_CAPTURE_BASE_URL ?? "http://localhost:3100";
const writePng = process.env.F2_CAPTURE_WRITE_PNG !== "false";
const outputDirectory = new URL(
  "../docs/implementation/evidence/admin-unified-f2-work-queue/",
  import.meta.url,
);
const route =
  "/admin-next-work-queue-fixture?view=today&queue=all&limit=25&selected=case%3A1042&lang=lt";
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
];

function failGate(viewport, gate, detail) {
  throw new Error(
    `work-queue ${viewport.width}x${viewport.height} failed ${gate}: ${detail}`,
  );
}

async function inspectLayout(page, viewport) {
  const result = await page.evaluate(() => {
    const rendered = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const intersects = (left, right) =>
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
    const header = document.querySelector("[data-admin-shell-header]");
    const main = document.querySelector("#admin-main-content");
    const master = document.querySelector("[data-work-queue-master]");
    const detail = document.querySelector("[data-work-queue-detail]");
    const queueFilter = document.querySelector("[data-work-queue-view-filter]");
    const mobileNavigation = document.querySelector(
      "[data-admin-mobile-navigation]",
    );
    const controls = header
      ? Array.from(header.querySelectorAll("a, button, input, select")).filter(
          rendered,
        )
      : [];
    const controlRects = controls.map((element) => ({
      label:
        element.getAttribute("aria-label") ||
        element.textContent?.trim() ||
        element.tagName,
      rect: element.getBoundingClientRect().toJSON(),
    }));
    const headerOverlaps = [];
    for (let leftIndex = 0; leftIndex < controlRects.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < controlRects.length;
        rightIndex += 1
      ) {
        if (
          intersects(
            controlRects[leftIndex].rect,
            controlRects[rightIndex].rect,
          )
        ) {
          headerOverlaps.push(
            `${controlRects[leftIndex].label} ↔ ${controlRects[rightIndex].label}`,
          );
        }
      }
    }
    const mobileNavigationRect =
      mobileNavigation && rendered(mobileNavigation)
        ? mobileNavigation.getBoundingClientRect()
        : null;
    const queueFilterRect = queueFilter?.getBoundingClientRect() ?? null;
    const queueChoices = queueFilter
      ? Array.from(queueFilter.querySelectorAll("a")).map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            clipped:
              !queueFilterRect ||
              rect.left < Math.max(0, queueFilterRect.left) - 1 ||
              rect.right >
                Math.min(window.innerWidth, queueFilterRect.right) + 1 ||
              element.scrollWidth > element.clientWidth + 1 ||
              element.scrollHeight > element.clientHeight + 1,
            label: element.textContent?.trim() || "",
            rect: rect.toJSON(),
          };
        })
      : [];
    return {
      detailRect: detail?.getBoundingClientRect().toJSON() ?? null,
      documentOverflowPx: Math.max(
        0,
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
      headerOverlaps,
      mainPaddingBottomPx: main
        ? Number.parseFloat(window.getComputedStyle(main).paddingBottom)
        : 0,
      masterRect: master?.getBoundingClientRect().toJSON() ?? null,
      mobileNavigationHeightPx: mobileNavigationRect?.height ?? 0,
      mobileNavigationOverflowPx: mobileNavigationRect
        ? Math.max(
            0,
            mobileNavigation.scrollWidth - mobileNavigation.clientWidth,
          )
        : 0,
      queueChoices,
      queueFilterOverflowPx: queueFilter
        ? Math.max(0, queueFilter.scrollWidth - queueFilter.clientWidth)
        : 0,
    };
  });

  if (result.documentOverflowPx > 1) {
    failGate(viewport, "document-overflow", `${result.documentOverflowPx}px`);
  }
  if (result.headerOverlaps.length) {
    failGate(viewport, "header-overlap", result.headerOverlaps.join(", "));
  }
  if (result.mobileNavigationOverflowPx > 1) {
    failGate(
      viewport,
      "mobile-navigation-overflow",
      `${result.mobileNavigationOverflowPx}px`,
    );
  }
  if (result.queueChoices.length !== 6) {
    failGate(
      viewport,
      "queue-choice-count",
      `expected 6, found ${result.queueChoices.length}`,
    );
  }
  const clippedQueueChoices = result.queueChoices.filter(
    (choice) => choice.clipped,
  );
  if (clippedQueueChoices.length) {
    failGate(
      viewport,
      "queue-choice-clipping",
      clippedQueueChoices.map((choice) => choice.label).join(", "),
    );
  }
  if (viewport.width < 640 && result.queueFilterOverflowPx > 1) {
    failGate(
      viewport,
      "mobile-queue-filter-overflow",
      `${result.queueFilterOverflowPx}px`,
    );
  }
  if (
    viewport.width < 1024 &&
    result.mainPaddingBottomPx < result.mobileNavigationHeightPx + 8
  ) {
    failGate(
      viewport,
      "mobile-navigation-reservation",
      `main padding ${result.mainPaddingBottomPx}px, nav ${result.mobileNavigationHeightPx}px`,
    );
  }
  if (viewport.width >= 1024 && result.mobileNavigationHeightPx !== 0) {
    failGate(
      viewport,
      "desktop-navigation-visibility",
      `mobile nav height ${result.mobileNavigationHeightPx}px`,
    );
  }
  if (!result.masterRect || !result.detailRect) {
    failGate(viewport, "master-detail-presence", "missing master or detail");
  }
  if (
    viewport.width >= 1280 &&
    result.detailRect.left < result.masterRect.right + 8
  ) {
    failGate(viewport, "wide-master-detail", "panels are not side by side");
  }
  if (
    viewport.width < 1280 &&
    result.detailRect.top < result.masterRect.bottom + 8
  ) {
    failGate(
      viewport,
      "stacked-master-detail",
      "panels overlap or do not stack",
    );
  }
  return result;
}

async function assertInteractionContract(page, viewport) {
  for (const state of ["Laukiama", "Tik skaityti"]) {
    if (!(await page.getByText(state, { exact: true }).first().isVisible())) {
      failGate(viewport, "interaction-state", `${state} is not visible`);
    }
  }
  if (
    await page
      .getByText("Paruošta vykdyti", { exact: true })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    failGate(
      viewport,
      "synthetic-executable-state",
      "shadow-read fixture exposes an executable label",
    );
  }
  const executableInteractions = page.locator(
    '[data-work-queue-interaction="executable"]',
  );
  if ((await executableInteractions.count()) !== 0) {
    failGate(
      viewport,
      "synthetic-executable-interaction",
      `${await executableInteractions.count()}`,
    );
  }
  const actions = page.locator("[data-work-queue-action]");
  if ((await actions.count()) !== 0) {
    failGate(
      viewport,
      "synthetic-action-count",
      `expected 0, found ${await actions.count()}`,
    );
  }
  const sourceLabels = page.getByText(
    "Apsaugota Preview · sintetiniai duomenys",
    { exact: true },
  );
  let sourceLabelVisible = false;
  for (let index = 0; index < (await sourceLabels.count()); index += 1) {
    if (await sourceLabels.nth(index).isVisible()) sourceLabelVisible = true;
  }
  if (!sourceLabelVisible) {
    failGate(viewport, "fixture-source-label", "synthetic badge is missing");
  }
}

async function assertFixturePaginationEndState(page, viewport) {
  const inputCursor = new URL(page.url()).searchParams.get("cursor");
  if (inputCursor) {
    failGate(
      viewport,
      "fixture-pagination-input",
      `expected cursor=null, found ${inputCursor}`,
    );
  }
  const nextPageLinkCount = await page
    .locator("[data-work-queue-next-page]")
    .count();
  if (nextPageLinkCount !== 0) {
    failGate(
      viewport,
      "fixture-pagination-end-state",
      `expected 0 Next links for nextCursor=null, found ${nextPageLinkCount}`,
    );
  }
  return nextPageLinkCount;
}

async function assertUrlPersistenceAndFailClosedSelection(page, viewport) {
  await page.getByRole("link", { name: "Laukia", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("queue") === "waiting");
  const filteredUrl = new URL(page.url());
  if (
    filteredUrl.searchParams.has("cursor") ||
    filteredUrl.searchParams.has("selected")
  ) {
    failGate(
      viewport,
      "filter-reset",
      "cursor or selected survived filter change",
    );
  }
  if ((await page.locator("[data-work-queue-item]").count()) !== 1) {
    failGate(viewport, "waiting-filter", "expected exactly one visible item");
  }

  await page.goto(
    `${baseUrl}/admin-next-work-queue-fixture?view=today&queue=waiting&limit=25&selected=case%3A1042&lang=lt`,
    { waitUntil: "networkidle" },
  );
  if (
    (await page.locator("[data-work-queue-detail-content]").count()) !== 0 ||
    (await page.locator("[data-work-queue-action]").count()) !== 0
  ) {
    failGate(
      viewport,
      "hidden-selection",
      "filtered-out selection exposed detail or action",
    );
  }

  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.locator('select[name="stage"]').selectOption("work");
  await page.getByRole("button", { name: "Taikyti filtrus" }).click();
  await page.waitForURL((url) => url.searchParams.get("stage") === "work");
  const formUrl = new URL(page.url());
  const formKeys = [...formUrl.searchParams.keys()].sort();
  const expectedKeys = ["limit", "queue", "stage", "view"];
  if (JSON.stringify(formKeys) !== JSON.stringify(expectedKeys)) {
    failGate(
      viewport,
      "canonical-filter-fields",
      `found ${formKeys.join(",")}`,
    );
  }
  if (
    formUrl.searchParams.has("cursor") ||
    formUrl.searchParams.has("selected")
  ) {
    failGate(viewport, "form-reset", "cursor or selected survived form submit");
  }

  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
}

async function assertFocusClearance(page, viewport) {
  if (viewport.width >= 1024) return 0;
  const controls = page.locator(
    "main a[href], main button:not([disabled]), main select:not([disabled])",
  );
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    await control.focus();
    await page.waitForTimeout(10);
    const clearance = await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      if (!navigation || window.getComputedStyle(navigation).display === "none")
        return null;
      return {
        navigationHeight: navigation.getBoundingClientRect().height,
        scrollMarginBottom: Number.parseFloat(
          window.getComputedStyle(element).scrollMarginBottom,
        ),
      };
    });
    if (
      clearance &&
      clearance.scrollMarginBottom < clearance.navigationHeight + 8
    ) {
      failGate(
        viewport,
        "focus-clearance",
        `scroll margin ${clearance.scrollMarginBottom}px, nav ${clearance.navigationHeight}px`,
      );
    }
    await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      if (!navigation || window.getComputedStyle(navigation).display === "none")
        return;
      const controlRect = element.getBoundingClientRect();
      const navigationRect = navigation.getBoundingClientRect();
      const safeCenterTop = Math.max(
        16,
        (navigationRect.top - controlRect.height) / 2,
      );
      window.scrollBy({
        behavior: "instant",
        left: 0,
        top: controlRect.top - safeCenterTop,
      });
    });
    await page.waitForTimeout(10);
    const overlap = await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      if (!navigation || window.getComputedStyle(navigation).display === "none")
        return null;
      const controlRect = element.getBoundingClientRect();
      const navigationRect = navigation.getBoundingClientRect();
      const intersects =
        Math.min(controlRect.right, navigationRect.right) -
          Math.max(controlRect.left, navigationRect.left) >
          1 &&
        Math.min(controlRect.bottom, navigationRect.bottom) -
          Math.max(controlRect.top, navigationRect.top) >
          1;
      return intersects
        ? {
            control:
              element.getAttribute("aria-label") || element.textContent?.trim(),
            controlBottom: controlRect.bottom,
            controlTop: controlRect.top,
            maxScrollY:
              document.documentElement.scrollHeight - window.innerHeight,
            navigationTop: navigationRect.top,
            scrollY: window.scrollY,
          }
        : null;
    });
    if (overlap) {
      failGate(viewport, "focus-occlusion", JSON.stringify(overlap));
    }
  }
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
  return count;
}

await mkdir(fileURLToPath(outputDirectory), { recursive: true });
const browser = await chromium.launch({ headless: true });
const captures = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: "networkidle",
    });
    if (!response?.ok()) {
      failGate(viewport, "route", `returned ${response?.status()}`);
    }
    await page.evaluate(() =>
      document
        .querySelectorAll("nextjs-portal")
        .forEach((portal) => portal.remove()),
    );
    const layout = await inspectLayout(page, viewport);
    await assertInteractionContract(page, viewport);
    await assertUrlPersistenceAndFailClosedSelection(page, viewport);
    const fixtureNextPageLinkCount = await assertFixturePaginationEndState(
      page,
      viewport,
    );
    const focusedControlCount = await assertFocusClearance(page, viewport);
    await page.evaluate(() => {
      document
        .querySelectorAll("nextjs-portal")
        .forEach((portal) => portal.remove());
      document.querySelectorAll("*").forEach((element) => {
        if (element.scrollWidth > element.clientWidth) element.scrollLeft = 0;
      });
      window.scrollTo({ left: 0, top: 0 });
    });
    if (writePng) {
      await page.screenshot({
        fullPage: true,
        path: fileURLToPath(
          new URL(`work-queue-${viewport.width}.png`, outputDirectory),
        ),
      });
    }
    captures.push({
      ...layout,
      fixtureNextCursor: null,
      fixtureNextPageLinkCount,
      focusedControlCount,
      height: viewport.height,
      interactionContractPassed: true,
      selectionFailClosedPassed: true,
      syntheticReadOnlyPassed: true,
      urlPersistencePassed: true,
      width: viewport.width,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  fileURLToPath(new URL("layout-gate-results.json", outputDirectory)),
  `${JSON.stringify({ baseUrl, captures, pngWritten: writePng }, null, 2)}\n`,
  "utf8",
);
