import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.F2_CASE_CAPTURE_BASE_URL ?? "http://localhost:3100";
const outputDirectory = new URL(
  "../docs/implementation/evidence/admin-unified-f2-case-workspace-golden/",
  import.meta.url,
);
const route = "/admin-next-case-golden-fixture";
const stateIds = [
  "executable_measurement_review",
  "waiting_customer",
  "overdue_unassigned",
  "blocked_work_recovery",
  "capability_read_only",
  "target_unavailable",
  "completed_no_action",
];
const executableStateIds = new Set([
  "executable_measurement_review",
  "overdue_unassigned",
  "blocked_work_recovery",
]);
const representativeStateIds = new Set([
  "executable_measurement_review",
  "waiting_customer",
  "blocked_work_recovery",
  "completed_no_action",
]);
const zoomStateIds = new Set([
  "executable_measurement_review",
  "blocked_work_recovery",
  "completed_no_action",
]);
const viewportByWidth = new Map([
  [375, { width: 375, height: 812 }],
  [768, { width: 768, height: 1024 }],
  [1024, { width: 1024, height: 900 }],
  [1440, { width: 1440, height: 1000 }],
]);

function failGate(capture, gate, detail) {
  throw new Error(
    `${capture.stateId} ${capture.width}x${capture.height} failed ${gate}: ${detail}`,
  );
}

function capturesFor(stateId) {
  const widths = representativeStateIds.has(stateId)
    ? [375, 768, 1024, 1440]
    : [375, 1440];
  return widths.map((width) => ({
    ...viewportByWidth.get(width),
    stateId,
  }));
}

async function inspectWorkspace(page, capture) {
  if (capture.width < 640) {
    await page.waitForTimeout(300);
    const disclosure = page.locator(
      'section[aria-labelledby="case-progress-title"] details',
    );
    await disclosure.locator("summary").click();
    if (!(await disclosure.evaluate((element) => element.open))) {
      failGate(capture, "mobile-stage-disclosure", "did not open");
    }
  }

  const result = await page.evaluate(
    ({ stateId }) => {
      const rendered = (element) => {
        let current = element;
        while (current instanceof HTMLElement) {
          const style = window.getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden") {
            return false;
          }
          current = current.parentElement;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const intersects = (left, right) =>
        Math.min(left.right, right.right) - Math.max(left.left, right.left) >
          1 &&
        Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
      const header = document.querySelector("[data-admin-shell-header]");
      const main = document.querySelector("#admin-main-content");
      const mobileNavigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      const progress = document.querySelector(
        'section[aria-labelledby="case-progress-title"]',
      );
      const stageLists = progress
        ? Array.from(progress.querySelectorAll("ol")).filter(rendered)
        : [];
      const stageItems = stageLists.flatMap((list) =>
        Array.from(list.children).filter(rendered),
      );
      const stageRects = stageItems.map((element) => ({
        label: element.textContent?.replace(/\s+/gu, " ").trim() || "stage",
        rect: element.getBoundingClientRect().toJSON(),
        textClipped:
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1,
      }));
      const stageOverlaps = [];
      for (let left = 0; left < stageRects.length; left += 1) {
        for (let right = left + 1; right < stageRects.length; right += 1) {
          if (intersects(stageRects[left].rect, stageRects[right].rect)) {
            stageOverlaps.push(
              `${stageRects[left].label} ↔ ${stageRects[right].label}`,
            );
          }
        }
      }
      const headerControls = header
        ? Array.from(
            header.querySelectorAll("a, button, input, select"),
          ).filter(rendered)
        : [];
      const headerControlRects = headerControls.map((element) => ({
        label:
          element.getAttribute("aria-label") ||
          element.textContent?.replace(/\s+/gu, " ").trim() ||
          element.tagName,
        rect: element.getBoundingClientRect().toJSON(),
      }));
      const headerOverlaps = [];
      for (let left = 0; left < headerControlRects.length; left += 1) {
        for (
          let right = left + 1;
          right < headerControlRects.length;
          right += 1
        ) {
          if (
            intersects(
              headerControlRects[left].rect,
              headerControlRects[right].rect,
            )
          ) {
            headerOverlaps.push(
              `${headerControlRects[left].label} ↔ ${headerControlRects[right].label}`,
            );
          }
        }
      }
      const primaryRegion = document.querySelector(
        'section[aria-labelledby="case-next-action-title"]',
      );
      const caseHeader = document.querySelector(
        "[data-admin-next-section='cases'] > header",
      );
      const caseHeaderGrid = caseHeader?.firstElementChild;
      const caseTitle = caseHeader?.querySelector("h1");
      const primaryLinks = primaryRegion
        ? Array.from(primaryRegion.querySelectorAll("a[href]")).filter(rendered)
        : [];
      const primaryLink = primaryLinks[0];
      const auditStates = Array.from(
        document.querySelectorAll("[data-audit-history-state]"),
      ).filter(rendered);
      const allAuditStates = Array.from(
        document.querySelectorAll("[data-audit-history-state]"),
      );
      const contextNavigation = document.querySelector(
        "[data-case-context-nav]",
      );
      const contextLinks = contextNavigation
        ? Array.from(
            contextNavigation.querySelectorAll("[data-case-context-link]"),
          )
        : [];
      const contextTargets = Array.from(
        document.querySelectorAll("[data-case-context-target]"),
      );
      const historyRail = document.querySelector("[data-case-history-rail]");
      const historySummary = document.querySelector(
        "[data-case-history-state-summary]",
      );
      const historyContent = document.querySelector(
        "[data-case-history-content]",
      );
      const navigationRect =
        mobileNavigation && rendered(mobileNavigation)
          ? mobileNavigation.getBoundingClientRect()
          : null;
      const bodyText = document.body.innerText;
      const currentStageLabels = stageItems.filter((element) =>
        /dabar/iu.test(element.textContent || ""),
      ).length;
      const completeStageLabels = stageItems.filter((element) =>
        /baigta/iu.test(element.textContent || ""),
      ).length;

      return {
        auditStateCount: auditStates.length,
        auditStates: auditStates.map((element) => ({
          state: element.getAttribute("data-audit-history-state"),
          text: element.textContent?.replace(/\s+/gu, " ").trim() || "",
        })),
        blockerCount: bodyText.match(/WORK_ORDER_BLOCKED/gu)?.length || 0,
        caseHeaderColumnCount: caseHeaderGrid
          ? window
              .getComputedStyle(caseHeaderGrid)
              .gridTemplateColumns.split(" ")
              .filter(Boolean).length
          : 0,
        caseTitleClipped: caseTitle
          ? caseTitle.scrollWidth > caseTitle.clientWidth + 1
          : true,
        completeStageLabels,
        contextCurrentCount: contextLinks.filter(
          (element) => element.getAttribute("aria-current") === "location",
        ).length,
        contextHrefs: contextLinks.map((element) =>
          element.getAttribute("href"),
        ),
        contextLinkCount: contextLinks.length,
        contextNavigationOverflowPx: contextNavigation
          ? Math.max(
              0,
              contextNavigation.scrollWidth - contextNavigation.clientWidth,
            )
          : 0,
        contextTargetIds: contextTargets.map((element) => element.id),
        currentAriaCount: Array.from(
          document.querySelectorAll('[aria-current="step"]'),
        ).filter(rendered).length,
        currentStageLabels,
        documentOverflowPx: Math.max(
          0,
          document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
        headerOverlaps,
        historyContentVisible: historyContent
          ? rendered(historyContent)
          : false,
        historyRailOpen:
          historyRail instanceof HTMLDetailsElement && historyRail.open,
        historyStateSummary: historySummary?.getAttribute(
          "data-case-history-state-summary",
        ),
        historySummaryVisible: historySummary
          ? rendered(historySummary)
          : false,
        mainPaddingBottomPx: main
          ? Number.parseFloat(window.getComputedStyle(main).paddingBottom)
          : 0,
        mobileNavigationHeightPx: navigationRect?.height || 0,
        mobileNavigationOverflowPx: mobileNavigation
          ? Math.max(
              0,
              mobileNavigation.scrollWidth - mobileNavigation.clientWidth,
            )
          : 0,
        primaryActionClass: primaryLink?.classList.contains("an-cta") || false,
        primaryHref: primaryLink?.getAttribute("href") || null,
        primaryLinkCount: primaryLinks.length,
        stageCount: stageItems.length,
        stageOverlaps,
        stageTextClipped: stageRects
          .filter(({ textClipped }) => textClipped)
          .map(({ label }) => label),
        stateId,
        totalAuditStateCount: allAuditStates.length,
      };
    },
    { stateId: capture.stateId },
  );

  if (result.documentOverflowPx > 1) {
    failGate(capture, "document-overflow", `${result.documentOverflowPx}px`);
  }
  if (
    result.contextLinkCount !== 3 ||
    result.contextCurrentCount !== 1 ||
    JSON.stringify(result.contextHrefs) !==
      JSON.stringify(["#case-summary", "#case-evidence", "#case-history"]) ||
    JSON.stringify(result.contextTargetIds) !==
      JSON.stringify(["case-summary", "case-evidence", "case-history"])
  ) {
    failGate(
      capture,
      "context-navigation-contract",
      JSON.stringify({
        current: result.contextCurrentCount,
        hrefs: result.contextHrefs,
        links: result.contextLinkCount,
        targets: result.contextTargetIds,
      }),
    );
  }
  if (result.contextNavigationOverflowPx > 1) {
    failGate(
      capture,
      "context-navigation-overflow",
      `${result.contextNavigationOverflowPx}px`,
    );
  }
  if (result.headerOverlaps.length) {
    failGate(capture, "header-overlap", result.headerOverlaps.join(", "));
  }
  if (
    capture.width === 1024 &&
    (result.caseHeaderColumnCount !== 1 || result.caseTitleClipped)
  ) {
    failGate(
      capture,
      "tablet-case-header",
      `columns=${result.caseHeaderColumnCount}, titleClipped=${result.caseTitleClipped}`,
    );
  }
  if (capture.width === 1440 && result.caseHeaderColumnCount !== 2) {
    failGate(
      capture,
      "wide-case-header",
      `columns=${result.caseHeaderColumnCount}`,
    );
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
      `${result.mobileNavigationHeightPx}px`,
    );
  }
  if (result.stageCount !== 6) {
    failGate(capture, "six-stage-contract", `found ${result.stageCount}`);
  }
  if (result.stageOverlaps.length) {
    failGate(capture, "stage-overlap", result.stageOverlaps.join(", "));
  }
  if (result.stageTextClipped.length) {
    failGate(
      capture,
      "stage-text-clipping",
      result.stageTextClipped.join(", "),
    );
  }
  if (result.currentAriaCount > 1 || result.currentStageLabels > 1) {
    failGate(
      capture,
      "single-current-stage",
      `aria=${result.currentAriaCount}, labels=${result.currentStageLabels}`,
    );
  }
  if (
    capture.stateId === "completed_no_action" &&
    (result.currentStageLabels !== 0 || result.completeStageLabels !== 6)
  ) {
    failGate(
      capture,
      "terminal-stage-contract",
      `current=${result.currentStageLabels}, complete=${result.completeStageLabels}`,
    );
  }
  if (
    capture.stateId !== "completed_no_action" &&
    result.currentStageLabels !== 1
  ) {
    failGate(
      capture,
      "current-stage-contract",
      `found ${result.currentStageLabels}`,
    );
  }
  if (result.primaryLinkCount !== 1) {
    failGate(
      capture,
      "single-primary-or-fallback",
      `found ${result.primaryLinkCount}`,
    );
  }
  const expectsAction = executableStateIds.has(capture.stateId);
  if (result.primaryActionClass !== expectsAction) {
    failGate(
      capture,
      "action-mode",
      `expected ${expectsAction ? "primary" : "neutral fallback"}`,
    );
  }
  if (!expectsAction && result.primaryHref !== "/admin-v2/cases") {
    failGate(capture, "neutral-fallback-target", result.primaryHref || "none");
  }
  const expectedBlockers = capture.stateId === "blocked_work_recovery" ? 1 : 0;
  if (result.blockerCount !== expectedBlockers) {
    failGate(
      capture,
      "single-blocker",
      `expected ${expectedBlockers}, found ${result.blockerCount}`,
    );
  }
  if (
    result.auditStateCount !== 1 ||
    result.totalAuditStateCount !== 1 ||
    result.auditStates.some(({ text }) => text.length === 0)
  ) {
    failGate(
      capture,
      "non-empty-audit-state",
      JSON.stringify(result.auditStates),
    );
  }
  if (!result.historyRailOpen || !result.historyContentVisible) {
    failGate(
      capture,
      "history-initial-visibility",
      `open=${result.historyRailOpen}, visible=${result.historyContentVisible}`,
    );
  }
  if (capture.width < 1280 && !result.historySummaryVisible) {
    failGate(capture, "history-disclosure", "summary is not visible");
  }
  if (capture.width >= 1280 && result.historySummaryVisible) {
    failGate(capture, "wide-history-rail", "summary must be hidden at xl");
  }

  return result;
}

async function assertFocusClearance(page, capture) {
  if (capture.width >= 1024) return 0;
  const controls = page.locator(
    "main a[href], main button:not([disabled]), main summary, main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex='-1'])",
  );
  const count = await controls.count();
  let focusedCount = 0;
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    focusedCount += 1;
    await control.focus();
    if (
      !(await control.evaluate((element) => document.activeElement === element))
    ) {
      failGate(
        capture,
        "focus-entry",
        `control ${index} did not receive focus`,
      );
    }
    await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      const navigationVisible =
        navigation && window.getComputedStyle(navigation).display !== "none";
      const controlRect = element.getBoundingClientRect();
      const availableBottom = navigationVisible
        ? navigation.getBoundingClientRect().top - 8
        : window.innerHeight - 8;
      const safeTop = Math.max(8, (availableBottom - controlRect.height) / 2);
      window.scrollBy({
        behavior: "instant",
        left: 0,
        top: controlRect.top - safeTop,
      });
    });
    await page.waitForTimeout(10);
    const clipping = await control.evaluate((element) => {
      const navigation = document.querySelector(
        "[data-admin-mobile-navigation]",
      );
      const navigationVisible =
        navigation && window.getComputedStyle(navigation).display !== "none";
      const rect = element.getBoundingClientRect();
      const viewportBottom = navigationVisible
        ? navigation.getBoundingClientRect().top - 8
        : window.innerHeight - 8;
      return rect.top < 0 || rect.bottom > viewportBottom
        ? {
            bottom: rect.bottom,
            label:
              element.getAttribute("aria-label") ||
              element.textContent?.replace(/\s+/gu, " ").trim() ||
              element.tagName,
            top: rect.top,
            viewportBottom,
          }
        : null;
    });
    if (clipping) {
      failGate(capture, "focus-clipping", JSON.stringify(clipping));
    }
  }
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
  return focusedCount;
}

async function assertContextNavigationKeyboard(page, capture) {
  const navigationOrder = ["case-evidence", "case-history", "case-summary"];
  for (const targetId of navigationOrder) {
    const link = page.locator(`[data-case-context-link="${targetId}"]`);
    await link.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (expectedTargetId) =>
        window.location.hash === `#${expectedTargetId}` &&
        document.activeElement?.id === expectedTargetId &&
        document
          .querySelector(`[data-case-context-link="${expectedTargetId}"]`)
          ?.getAttribute("aria-current") === "location",
      targetId,
    );
    const currentCount = await page
      .locator('[data-case-context-link][aria-current="location"]')
      .count();
    if (currentCount !== 1) {
      failGate(
        capture,
        "context-navigation-active",
        `${targetId} left ${currentCount} active links`,
      );
    }
  }
  return navigationOrder.length;
}

async function assertHistoryDisclosure(page, capture) {
  const rail = page.locator("[data-case-history-rail]");
  const summary = rail.locator("summary");
  const content = rail.locator("[data-case-history-content]");
  if (capture.width >= 1280) {
    if (!(await rail.evaluate((element) => element.open))) {
      failGate(capture, "wide-history-open", "xl rail is closed");
    }
    if (!(await content.isVisible()) || (await summary.isVisible())) {
      failGate(
        capture,
        "wide-history-presentation",
        "content must be visible and disclosure summary hidden",
      );
    }
    return false;
  }

  await summary.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector("[data-case-history-rail]")?.open === false,
  );
  if (!(await summary.isVisible()) || (await content.isVisible())) {
    failGate(
      capture,
      "history-collapse",
      "collapsed rail must retain its status summary and hide its body",
    );
  }
  const summaryText = (await summary.textContent())
    ?.replace(/\s+/gu, " ")
    .trim();
  if (!summaryText) {
    failGate(capture, "history-state-summary", "collapsed summary is empty");
  }
  if ((await page.locator("[data-audit-history-state]").count()) !== 1) {
    failGate(
      capture,
      "history-single-content",
      "audit state was duplicated while collapsed",
    );
  }

  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector("[data-case-history-rail]")?.open === true,
  );
  if (!(await content.isVisible())) {
    failGate(capture, "history-reopen", "audit content did not return");
  }
  return true;
}

async function assertZoomOverflow(page, capture) {
  if (
    !zoomStateIds.has(capture.stateId) ||
    ![1024, 1440].includes(capture.width)
  ) {
    return null;
  }
  const zoomViewport = {
    height: Math.max(400, Math.floor(capture.height / 2)),
    width: Math.floor(capture.width / 2),
  };
  await page.setViewportSize(zoomViewport);
  await page.waitForTimeout(100);
  const result = await page.evaluate(
    ({ zoomViewport }) => {
      window.scrollTo({ left: 0, top: 0 });
      const navigation = document.querySelector("[data-case-context-nav]");
      const workspace = document.querySelector(
        "[data-admin-next-section='cases']",
      );
      const links = navigation
        ? Array.from(navigation.querySelectorAll("[data-case-context-link]"))
        : [];
      return {
        documentOverflowPx: Math.max(
          0,
          document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
        linkClipping: links
          .filter(
            (element) =>
              element.scrollWidth > element.clientWidth + 1 ||
              element.scrollHeight > element.clientHeight + 1,
          )
          .map((element) => element.textContent?.trim() || "link"),
        navigationOverflowPx: navigation
          ? Math.max(0, navigation.scrollWidth - navigation.clientWidth)
          : 0,
        simulatedCssViewport: zoomViewport,
        workspaceOverflowPx: workspace
          ? Math.max(0, workspace.scrollWidth - workspace.clientWidth)
          : 0,
      };
    },
    { zoomViewport },
  );

  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.waitForTimeout(50);

  if (
    result.documentOverflowPx > 1 ||
    result.navigationOverflowPx > 1 ||
    result.workspaceOverflowPx > 1 ||
    result.linkClipping.length > 0
  ) {
    failGate(capture, "200-percent-zoom-overflow", JSON.stringify(result));
  }
  return result;
}

await mkdir(fileURLToPath(outputDirectory), { recursive: true });
const browser = await chromium.launch({ headless: true });
const captures = [];
try {
  const allowlistPage = await browser.newPage({
    viewport: viewportByWidth.get(375),
  });
  const rejected = await allowlistPage.goto(
    `${baseUrl}${route}?state=not-allowlisted&lang=lt`,
    { waitUntil: "networkidle" },
  );
  if (rejected?.status() !== 404) {
    throw new Error(
      `fixture allowlist failed: invalid state returned ${rejected?.status()}`,
    );
  }
  await allowlistPage.close();

  for (const stateId of stateIds) {
    for (const capture of capturesFor(stateId)) {
      const page = await browser.newPage({
        viewport: { width: capture.width, height: capture.height },
      });
      const response = await page.goto(
        `${baseUrl}${route}?state=${encodeURIComponent(stateId)}&lang=lt`,
        { waitUntil: "networkidle" },
      );
      if (!response?.ok()) {
        failGate(capture, "route", `returned ${response?.status()}`);
      }
      await page.evaluate(() =>
        document
          .querySelectorAll("nextjs-portal")
          .forEach((portal) => portal.remove()),
      );
      const workspace = await inspectWorkspace(page, capture);
      const contextKeyboardActivationCount =
        await assertContextNavigationKeyboard(page, capture);
      const historyDisclosureToggled = await assertHistoryDisclosure(
        page,
        capture,
      );
      const focusedControlCount = await assertFocusClearance(page, capture);
      const zoom = await assertZoomOverflow(page, capture);
      await page.evaluate(() => {
        document
          .querySelectorAll("nextjs-portal")
          .forEach((portal) => portal.remove());
        document.documentElement.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        window.scrollTo(0, 0);
      });
      await page.waitForFunction(() => window.scrollY === 0);
      await page.screenshot({
        fullPage: true,
        path: fileURLToPath(
          new URL(`${stateId}-${capture.width}.png`, outputDirectory),
        ),
      });
      captures.push({
        ...workspace,
        contextKeyboardActivationCount,
        focusedControlCount,
        height: capture.height,
        historyDisclosureToggled,
        width: capture.width,
        zoom,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  fileURLToPath(new URL("layout-gate-results.json", outputDirectory)),
  `${JSON.stringify(
    {
      baseUrl,
      captureCount: captures.length,
      captures,
      fixtureRoute: route,
      invalidStateReturned404: true,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
