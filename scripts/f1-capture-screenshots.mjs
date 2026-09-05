import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.F1_CAPTURE_BASE_URL ?? "http://localhost:3100";
const outputDirectory = new URL(
  "../docs/implementation/evidence/admin-unified-f1/",
  import.meta.url,
);
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
];
const surfaces = [
  { route: "admin-next-fixture", name: "unified-today" },
  { route: "admin-next-case-fixture", name: "unified-case" },
  { route: "admin-next-system-fixture", name: "component-catalog" },
];
const mobileUtilityLabels = [
  "SEO studija",
  "Operacijos",
  "Archyvas",
  "Komanda ir teisės",
  "Nustatymai",
];

function failGate(capture, gate, detail) {
  throw new Error(
    `${capture.name} ${capture.width}x${capture.height} failed ${gate}: ${detail}`,
  );
}

async function inspectLayout(page, capture) {
  const result = await page.evaluate(() => {
    const rendered = (element) => {
      const closedDetails = element.closest("details:not([open])");
      if (closedDetails && element.tagName !== "SUMMARY") return false;
      let ancestor = element;
      while (ancestor instanceof HTMLElement) {
        const ancestorStyle = window.getComputedStyle(ancestor);
        if (ancestorStyle.display === "none" || ancestorStyle.visibility === "hidden") return false;
        ancestor = ancestor.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const intersects = (left, right) =>
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
    const header = document.querySelector("[data-admin-shell-header]");
    const main = document.querySelector("#admin-main-content");
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
    const stageCards = Array.from(
      document.querySelectorAll("[data-case-stage-card]"),
    ).filter(rendered);
    const stageCardRects = stageCards.map((element) => ({
      label: element.textContent?.replace(/\s+/gu, " ").trim() || "stage",
      rect: element.getBoundingClientRect().toJSON(),
    }));
    const caseStageOverlaps = [];
    for (let leftIndex = 0; leftIndex < stageCardRects.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < stageCardRects.length; rightIndex += 1) {
        if (intersects(stageCardRects[leftIndex].rect, stageCardRects[rightIndex].rect)) {
          caseStageOverlaps.push(`${stageCardRects[leftIndex].label} ↔ ${stageCardRects[rightIndex].label}`);
        }
      }
    }

    return {
      documentOverflowPx: Math.max(
        0,
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
      headerControlCount: controls.length,
      headerOverlaps,
      caseStageCount: stageCards.length,
      caseStageOverlaps,
      currentStepCount: Array.from(document.querySelectorAll('[aria-current="step"]')).filter(rendered).length,
      mainPaddingBottomPx: main
        ? Number.parseFloat(window.getComputedStyle(main).paddingBottom)
        : 0,
      mobileNavigationHeightPx: mobileNavigationRect?.height ?? 0,
      mobileNavigationOverflowPx: mobileNavigationRect
        ? Math.max(
            0,
            mobileNavigation.scrollWidth - mobileNavigation.clientWidth,
          )
        : 0,
    };
  });

  if (result.documentOverflowPx > 1) {
    failGate(capture, "document-overflow", `${result.documentOverflowPx}px`);
  }
  if (result.headerOverlaps.length) {
    failGate(capture, "header-overlap", result.headerOverlaps.join(", "));
  }
  const expectedCaseStageCount = capture.width < 640 ? 1 : 6;
  if (capture.name === "unified-case" && result.caseStageCount !== expectedCaseStageCount) {
    failGate(capture, "case-stage-presence", `expected ${expectedCaseStageCount}, received ${result.caseStageCount}`);
  }
  if (capture.name === "unified-case" && result.caseStageOverlaps.length) {
    failGate(capture, "case-stage-overlap", result.caseStageOverlaps.join(", "));
  }
  if (capture.name === "unified-case" && result.currentStepCount !== 1) {
    failGate(capture, "case-current-step", `expected 1, received ${result.currentStepCount}`);
  }
  if (result.mobileNavigationOverflowPx > 1) {
    failGate(
      capture,
      "mobile-navigation-overflow",
      `${result.mobileNavigationOverflowPx}px`,
    );
  }
  if (
    capture.width < 1024 &&
    result.mainPaddingBottomPx < result.mobileNavigationHeightPx + 8
  ) {
    failGate(
      capture,
      "mobile-navigation-reservation",
      `main padding ${result.mainPaddingBottomPx}px, nav ${result.mobileNavigationHeightPx}px`,
    );
  }
  if (capture.width >= 1024 && result.mobileNavigationHeightPx !== 0) {
    failGate(
      capture,
      "desktop-navigation-visibility",
      `mobile nav height ${result.mobileNavigationHeightPx}px`,
    );
  }

  return result;
}

async function assertFocusedControlsClearMobileNavigation(page, capture) {
  if (capture.width >= 1024) return;
  const controls = page.locator(
    "main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex='-1'])",
  );
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    await control.focus();
    const focusClearance = await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      if (!navigation) return null;
      const navigationStyle = window.getComputedStyle(navigation);
      if (navigationStyle.display === "none") return null;
      return {
        navigationHeight: navigation.getBoundingClientRect().height,
        scrollMarginBottom: Number.parseFloat(
          window.getComputedStyle(element).scrollMarginBottom,
        ),
      };
    });
    if (
      focusClearance &&
      focusClearance.scrollMarginBottom < focusClearance.navigationHeight + 8
    ) {
      failGate(
        capture,
        "focused-control-clearance",
        `scroll margin ${focusClearance.scrollMarginBottom}px, nav ${focusClearance.navigationHeight}px`,
      );
    }
    await control.evaluate((element) =>
      element.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" }),
    );
    await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      if (!navigation || window.getComputedStyle(navigation).display === "none") return;
      const controlRect = element.getBoundingClientRect();
      const navigationRect = navigation.getBoundingClientRect();
      if (controlRect.bottom > navigationRect.top - 8) {
        window.scrollBy({ behavior: "instant", top: controlRect.bottom - navigationRect.top + 8 });
      }
    });
    await page.waitForTimeout(25);
    const overlap = await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      if (!navigation) return null;
      const navigationStyle = window.getComputedStyle(navigation);
      if (navigationStyle.display === "none") return null;
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
            control: element.getAttribute("aria-label") || element.textContent,
            controlBottom: controlRect.bottom,
            navigationTop: navigationRect.top,
          }
        : null;
    });
    if (overlap) {
      failGate(capture, "focused-control-occlusion", JSON.stringify(overlap));
    }
  }
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
}

async function assertMobileUtilityAccess(page, capture) {
  if (capture.width >= 1024) return;
  const trigger = page.getByRole("button", { name: "Daugiau", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Daugiau darbo sričių",
    exact: true,
  });
  await dialog.waitFor({ state: "visible" });
  for (const label of mobileUtilityLabels) {
    await dialog.getByRole("link", { name: label, exact: true }).waitFor({
      state: "visible",
    });
  }
  const overlapsNavigation = await dialog.evaluate((element) => {
    const navigation = document.querySelector("[data-admin-mobile-navigation]");
    if (!navigation) return false;
    const dialogRect = element.getBoundingClientRect();
    const navigationRect = navigation.getBoundingClientRect();
    return dialogRect.bottom > navigationRect.top + 1;
  });
  if (overlapsNavigation) {
    failGate(capture, "mobile-utility-overlap", "drawer overlaps bottom nav");
  }
  if (capture.name === "unified-today") {
    await page.screenshot({
      path: fileURLToPath(
        new URL(`mobile-more-${capture.width}.png`, outputDirectory),
      ),
    });
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  if (
    !(await trigger.evaluate((element) => document.activeElement === element))
  ) {
    failGate(capture, "mobile-utility-focus-return", "focus did not return");
  }
}

await mkdir(fileURLToPath(outputDirectory), { recursive: true });
const browser = await chromium.launch({ headless: true });
const gateResults = [];
try {
  for (const surface of surfaces) {
    for (const viewport of viewports) {
      const capture = { ...surface, ...viewport };
      const page = await browser.newPage({ viewport });
      const response = await page.goto(`${baseUrl}/${surface.route}`, {
        waitUntil: "networkidle",
      });
      if (!response?.ok()) {
        failGate(
          capture,
          "route",
          `returned ${response?.status() ?? "no response"}`,
        );
      }
      await page.evaluate(() =>
        document
          .querySelectorAll("nextjs-portal")
          .forEach((portal) => portal.remove()),
      );
      const layout = await inspectLayout(page, capture);
      await assertFocusedControlsClearMobileNavigation(page, capture);
      await assertMobileUtilityAccess(page, capture);
      await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
      await page.screenshot({
        path: fileURLToPath(
          new URL(`${surface.name}-${viewport.width}.png`, outputDirectory),
        ),
        fullPage: true,
      });
      gateResults.push({
        height: viewport.height,
        name: surface.name,
        ...layout,
        width: viewport.width,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  fileURLToPath(new URL("layout-gate-results.json", outputDirectory)),
  `${JSON.stringify({ baseUrl, captures: gateResults }, null, 2)}\n`,
  "utf8",
);
