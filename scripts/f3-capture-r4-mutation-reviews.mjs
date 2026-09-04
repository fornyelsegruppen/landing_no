import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.F3_R4_CAPTURE_BASE_URL ?? "http://localhost:3100";
const fixtureRoute = "/admin-next-r4-fixture";
const viewport = { height: 1600, width: 1440 };
const outputDirectory = new URL(
  "../docs/implementation/evidence/admin-unified-f3-r4-mutations/",
  import.meta.url,
);

function failGate(state, gate, detail) {
  throw new Error(`${state} failed ${gate}: ${detail}`);
}

async function inspectOpenReview(page, state) {
  const result = await page.evaluate(() => {
    const dialog = document.querySelector(
      '[role="dialog"]:not([aria-labelledby="r4-drawer-title"])',
    );
    const drawer = document.querySelector(
      '[aria-labelledby="r4-drawer-title"]',
    );
    if (!(dialog instanceof HTMLElement)) return null;
    const dialogRect = dialog.getBoundingClientRect();
    const dialogStyle = window.getComputedStyle(dialog);
    const drawerStyle = drawer ? window.getComputedStyle(drawer) : null;
    return {
      dialogHorizontalOverflowPx: Math.max(
        0,
        dialog.scrollWidth - dialog.clientWidth,
      ),
      dialogRect: dialogRect.toJSON(),
      dialogTitle:
        dialog
          .querySelector("h1, h2, [data-radix-dialog-title]")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim() || "",
      dialogWithinViewport:
        dialogRect.left >= 0 &&
        dialogRect.right <= window.innerWidth &&
        dialogRect.top >= 0 &&
        dialogRect.bottom <= window.innerHeight,
      documentHorizontalOverflowPx: Math.max(
        0,
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
      drawerPresent: Boolean(drawer),
      overlayAboveDrawer:
        Number.parseInt(dialogStyle.zIndex || "0", 10) >
        Number.parseInt(drawerStyle?.zIndex || "0", 10),
      primaryButtons: Array.from(dialog.querySelectorAll("button"))
        .filter((button) => !button.disabled)
        .map((button) => button.textContent?.replace(/\s+/gu, " ").trim()),
      reviewState:
        dialog
          .querySelector("[data-address-correction-state]")
          ?.getAttribute("data-address-correction-state") || null,
      typedConfirmationCount: dialog.querySelectorAll(
        "[data-review-typed-confirmation] input",
      ).length,
    };
  });

  if (!result) failGate(state, "dialog", "review dialog is missing");
  if (!result.drawerPresent) {
    failGate(state, "real-r4-context", "R4 drawer is missing behind review");
  }
  if (!result.dialogWithinViewport) {
    failGate(state, "dialog-viewport", JSON.stringify(result.dialogRect));
  }
  if (
    result.dialogHorizontalOverflowPx > 1 ||
    result.documentHorizontalOverflowPx > 1
  ) {
    failGate(state, "horizontal-overflow", JSON.stringify(result));
  }
  if (!result.overlayAboveDrawer) {
    failGate(state, "stacking", "ReviewAndCommit is not above the R4 drawer");
  }
  return result;
}

async function openAddressReview(page) {
  await page
    .getByRole("button", { name: "Taisyti bylos adresą", exact: true })
    .click();
  await page.locator('[name="street"]').fill("Nygata");
  await page.locator('[name="houseNumber"]').fill("8");
  await page.locator('[name="postalCode"]').fill("0184");
  await page.locator('[name="city"]').fill("Oslo");
  await page
    .locator('[name="reasonCode"]')
    .selectOption("customer_confirmation");
  await page
    .getByRole("button", { name: "Peržiūrėti pasekmes", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Patvirtinti adreso koregavimą",
  });
  await dialog.waitFor({ state: "visible" });
  if (
    (await dialog.locator("[data-address-correction-before]").count()) !== 1
  ) {
    failGate("address_review", "before", "before address is missing");
  }
  if ((await dialog.locator("[data-address-correction-after]").count()) !== 1) {
    failGate("address_review", "after", "after address is missing");
  }
  if (
    (await dialog.locator("[data-address-correction-invalidation]").count()) !==
    2
  ) {
    failGate(
      "address_review",
      "invalidation-impact",
      "expected source and draft invalidation",
    );
  }
  const typedInput = dialog.locator("[data-review-typed-confirmation] input");
  await typedInput.focus();
  if (
    !(await typedInput.evaluate(
      (element) => document.activeElement === element,
    ))
  ) {
    failGate(
      "address_review",
      "focus",
      "typed confirmation did not receive focus",
    );
  }
  await dialog.evaluate((element) => {
    element.scrollTop = 0;
  });
}

async function openOfferReview(page) {
  const action = page.locator('[data-rf-offer-bridge="open-review"]');
  await action.waitFor({ state: "visible" });
  await action.click();
  const dialog = page.getByRole("dialog", {
    name: "Peržiūrėti ir įkelti į pasiūlymą",
  });
  await dialog.waitFor({ state: "visible" });
  const text = (await dialog.textContent())?.replace(/\s+/gu, " ") || "";
  for (const expected of [
    "roof-case-1042-r7",
    "Byla r12 · adresas r7",
    "pasiūlymas nepatvirtinamas ir neišsiunčiamas klientui",
  ]) {
    if (!text.includes(expected)) {
      failGate("offer_review", "exact-review-copy", `missing ${expected}`);
    }
  }
  const acknowledgement = dialog.locator('input[type="checkbox"]');
  await acknowledgement.focus();
  if (
    !(await acknowledgement.evaluate(
      (element) => document.activeElement === element,
    ))
  ) {
    failGate("offer_review", "focus", "acknowledgement did not receive focus");
  }
}

await mkdir(fileURLToPath(outputDirectory), { recursive: true });
const browser = await chromium.launch({ headless: true });
const captures = [];
try {
  const allowlistPage = await browser.newPage({ viewport });
  const rejected = await allowlistPage.goto(
    `${baseUrl}${fixtureRoute}?state=not-allowlisted`,
    { waitUntil: "networkidle" },
  );
  if (rejected?.status() !== 404) {
    failGate(
      "allowlist",
      "unknown-state",
      `expected 404, received ${rejected?.status()}`,
    );
  }
  await allowlistPage.close();

  for (const state of ["address_review", "offer_review"]) {
    const page = await browser.newPage({ viewport });
    const mutationRequests = [];
    page.on("request", (request) => {
      if (
        ["PATCH", "POST", "PUT", "DELETE"].includes(request.method()) &&
        request.url().includes("/api/admin/")
      ) {
        mutationRequests.push({ method: request.method(), url: request.url() });
      }
    });
    const response = await page.goto(
      `${baseUrl}${fixtureRoute}?state=${state}`,
      { waitUntil: "networkidle" },
    );
    if (!response?.ok()) {
      failGate(state, "route", `returned ${response?.status()}`);
    }
    await page.evaluate(() =>
      document
        .querySelectorAll("nextjs-portal")
        .forEach((portal) => portal.remove()),
    );
    const renderedState = await page
      .locator("[data-r4-mutation-fixture]")
      .getAttribute("data-r4-mutation-fixture");
    if (renderedState !== state) {
      failGate(state, "state-binding", `rendered ${renderedState}`);
    }

    if (state === "address_review") await openAddressReview(page);
    else await openOfferReview(page);
    const inspection = await inspectOpenReview(page, state);
    if (state === "address_review" && inspection.typedConfirmationCount !== 1) {
      failGate(state, "typed-confirmation", "expected exactly one input");
    }
    if (state === "offer_review" && inspection.typedConfirmationCount !== 0) {
      failGate(
        state,
        "acknowledgement",
        "offer review must use acknowledgement",
      );
    }
    if (mutationRequests.length) {
      failGate(state, "capture-mutation", JSON.stringify(mutationRequests));
    }

    const filename = `${state.replace("_", "-")}-1440.png`;
    await page.screenshot({
      path: fileURLToPath(new URL(filename, outputDirectory)),
    });
    captures.push({
      ...inspection,
      filename,
      mutationRequestCount: mutationRequests.length,
      state,
      viewport,
    });
    await page.close();
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
      fixtureRoute,
      invalidStateReturned404: true,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
