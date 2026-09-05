import { expect, test, type Page } from "@playwright/test";
import {
  buildRoofFusionWorkbenchDraftV1,
  parseRoofFusionWorkbenchDraftV1,
  type RoofFusionWorkbenchDraftV1,
} from "../src/lib/roof-fusion/workbench-draft-contract-v1";
import { invokeWorkbenchHeightAdapterV1 } from "../src/lib/roof-fusion/workbench-height-adapter-v1";
import { projectRoofFusionWorkbenchDetailedResultV1 } from "../src/lib/roof-fusion/workbench-detailed-result-v1";

test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
test.skip(
  process.env.RF_BROWSER_FIXTURE !== "true",
  "Requires the explicitly enabled local visual fixture.",
);

type Point = readonly [number, number];
const canvasSelector = "[data-roof-fusion-canvas]";

async function screenPoint(page: Page, [x, y]: Point) {
  return page.locator(canvasSelector).evaluate(
    (svg, point) => {
      const matrix = (svg as SVGSVGElement).getScreenCTM();
      if (!matrix) throw new Error("Canvas transform is unavailable");
      const result = new DOMPoint(
        (point[0] + 9) / 30,
        (21 - point[1]) / 30,
      ).matrixTransform(matrix);
      return { x: result.x, y: result.y };
    },
    [x, y],
  );
}

async function clickPoint(page: Page, point: Point, offset = { x: 0, y: 0 }) {
  await page
    .locator("[data-roof-fusion-canvas-shell]")
    .scrollIntoViewIfNeeded();
  const screen = await screenPoint(page, point);
  await page.mouse.click(screen.x + offset.x, screen.y + offset.y);
}

async function drawLine(
  page: Page,
  kind: "ridge" | "valley",
  from: Point,
  to: Point,
  number: number,
  endOffset = { x: 0, y: 0 },
) {
  const button = page.locator(`[data-roof-fusion-line-mode="${kind}"]`);
  // A real operator clicks “Dar vienas / Dar viena” each time, even when active.
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await clickPoint(page, from);
  await expect(
    page.locator("[data-roof-fusion-pending-line-point]"),
  ).toHaveCount(1);
  await clickPoint(page, to, endOffset);
  await expect(page.locator("[data-roof-fusion-line-kind]")).toHaveCount(
    number,
  );
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

for (const drawingOrder of [
  "carrier-first",
  "branch-first carrier-later",
] as const) {
  test(`two ridges and two valleys (${drawingOrder}) share a real browser junction through save, calculate and edit`, async ({
    page,
  }, testInfo) => {
    let latest: RoofFusionWorkbenchDraftV1 | null = null;
    let calculation: ReturnType<typeof invokeWorkbenchHeightAdapterV1> | null =
      null;
    await page.route(
      "**/api/admin/roof-fusion/workbench-draft**",
      async (route) => {
        if (route.request().method() === "POST") {
          latest = parseRoofFusionWorkbenchDraftV1(
            route.request().postDataJSON().draft,
          );
          await route.fulfill({
            json: { status: "applied", confirmation: { status: "applied" } },
          });
        } else {
          await route.fulfill(
            latest
              ? { json: { draft: latest } }
              : { status: 404, json: { code: "DRAFT_NOT_FOUND" } },
          );
        }
      },
    );
    await page.route(
      "**/api/admin/roof-fusion/workbench-height-adapter",
      async (route) => {
        const body = route.request().postDataJSON();
        if (!latest || body.draftHash !== latest.draftHash)
          throw new Error("Calculation did not use the saved draft");
        // Real production geometry/height adapter; only account/database IO is substituted.
        calculation = invokeWorkbenchHeightAdapterV1({
          ...body,
          draft: latest,
          requestedAt: "2026-09-05T12:01:00.000Z",
          generatedAt: "2026-09-05T12:01:00.000Z",
        });
        await route.fulfill({
          json: {
            draftHash: latest.draftHash,
            status: calculation.summary.status,
            pricingReady: false,
            summary: calculation.summary,
            metrics: {
              horizontalAreaSquareMeters:
                calculation.snapshot.totals.grossHorizontalArea.min,
              totalSurfaceAreaSquareMeters:
                calculation.snapshot.totals.grossSurfaceArea.min,
              footprintPerimeterMeters:
                calculation.snapshot.totals.footprintPerimeter.min,
            },
            detailedResult: projectRoofFusionWorkbenchDetailedResultV1(
              calculation.snapshot,
            ),
          },
        });
      },
    );

    await page.goto("/admin-next-rf-drawing-fixture");
    await expect(page.locator("[data-roof-fusion-workbench]")).toBeVisible();
    await page
      .locator('[data-roof-fusion-edit-mode-option="skeleton"]')
      .click();
    await page.getByText("Talpinti stogą", { exact: true }).click();
    if (drawingOrder === "carrier-first") {
      await drawLine(page, "ridge", [9, 0], [9, 12], 1);
      await drawLine(page, "ridge", [0, 3], [9, 3], 2);
    } else {
      // r25 operator order: a branch ends just before a carrier drawn afterwards.
      await drawLine(page, "ridge", [0, 3], [8.94, 3], 1);
      await expect(
        page.locator("[data-roof-fusion-dangling-endpoint]"),
      ).toHaveCount(1);
      await page.locator('[data-roof-fusion-line-mode="ridge"]').click();
      await clickPoint(page, [9, 0]);
      const carrierEnd = await screenPoint(page, [9, 12]);
      await page.mouse.move(carrierEnd.x, carrierEnd.y);
      await expect(
        page.locator("[data-roof-fusion-connection-preview]"),
      ).toHaveCount(1);
      const previewScreenshot = testInfo.outputPath(
        "carrier-later-magnet-preview.png",
      );
      await page
        .locator("[data-roof-fusion-canvas-shell]")
        .screenshot({ path: previewScreenshot });
      await testInfo.attach("carrier-later-magnet-preview", {
        path: previewScreenshot,
        contentType: "image/png",
      });
      await page.mouse.click(carrierEnd.x, carrierEnd.y);
      await expect(page.locator("[data-roof-fusion-line-kind]")).toHaveCount(2);
      await expect(
        page.locator("[data-roof-fusion-dangling-endpoint]"),
      ).toHaveCount(0);
      // Adding a carrier and attracting an existing tip is one undoable edit.
      await page.locator("[data-roof-fusion-undo-last-line]").click();
      await expect(page.locator("[data-roof-fusion-line-kind]")).toHaveCount(1);
      await expect(
        page.locator("[data-roof-fusion-dangling-endpoint]"),
      ).toHaveCount(1);
      await drawLine(page, "ridge", [9, 0], [9, 12], 2);
      await expect(
        page.locator("[data-roof-fusion-dangling-endpoint]"),
      ).toHaveCount(0);
    }
    // Starting exactly over existing endpoint markers tests native SVG hit testing.
    await drawLine(page, "valley", [9, 3], [6, 0], 3);
    // Pan on empty canvas while the persistent drawing tool is still selected.
    const empty = await screenPoint(page, [-3, 6]);
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.down();
    await page.mouse.move(empty.x + 12, empty.y + 8, { steps: 5 });
    await page.mouse.up();
    await expect(
      page.locator("[data-roof-fusion-pending-line-point]"),
    ).toHaveCount(0);
    const scaleBefore = await page
      .locator(canvasSelector)
      .getAttribute("data-roof-fusion-viewport-scale");
    await page
      .getByRole("button", { name: "Didinti vaizdą", exact: true })
      .click();
    await expect(page.locator(canvasSelector)).not.toHaveAttribute(
      "data-roof-fusion-viewport-scale",
      scaleBefore!,
    );
    // 6 CSS px away must prefer the existing exact junction over a new projection.
    await drawLine(page, "valley", [6, 6], [9, 3], 4, { x: 6, y: 2 });
    const connectedScreenshot = testInfo.outputPath(
      "two-ridges-two-valleys.png",
    );
    await page
      .locator("[data-roof-fusion-canvas-shell]")
      .screenshot({ path: connectedScreenshot });
    await testInfo.attach("two-ridges-two-valleys", {
      path: connectedScreenshot,
      contentType: "image/png",
    });
    await page.locator('[data-roof-fusion-primary-action="calculate"]').click();
    await expect(page.locator("[data-roof-fusion-workbench]")).toHaveAttribute(
      "data-roof-fusion-stage",
      "review",
    );
    expect(calculation).not.toBeNull();
    const result = calculation as unknown as ReturnType<
      typeof invokeWorkbenchHeightAdapterV1
    >;
    expect(result.summary.status).toBe("review_required");
    expect(result.snapshot.geometry.surfaces).toHaveLength(5);
    expect(result.snapshot.totals.grossHorizontalArea.min).toBeCloseTo(108, 1);
    expect(result.snapshot.totals.grossSurfaceArea.min).toBeCloseTo(
      108 * Math.sqrt(1.25),
      1,
    );
    expect(result.summary.blockers.join(" ")).not.toContain(
      "SKELETON_DANGLING_ENDPOINT",
    );

    // A valid historical draft can contain the current UI's manual-line IDs.
    // Rehydrate those IDs to verify append cannot reuse a saved line's React key.
    const historical = latest as unknown as RoofFusionWorkbenchDraftV1;
    latest = buildRoofFusionWorkbenchDraftV1({
      ...historical,
      geometry: {
        ...historical.geometry,
        skeletonEdges: historical.geometry.skeletonEdges.map((edge, index) => ({
          ...edge,
          edgeId: `manual-line-${index + 1}`,
        })),
      },
    });
    await page.reload();
    await page.locator("[data-roof-fusion-resume-restored-draft]").click();
    await page
      .locator('[data-roof-fusion-edit-mode-option="skeleton"]')
      .click();
    await expect(
      page.locator('[data-roof-fusion-line-kind="ridge"]'),
    ).toHaveCount(2);
    await expect(
      page.locator('[data-roof-fusion-line-kind="valley"]'),
    ).toHaveCount(2);
    const originalIds = await page
      .locator("[data-roof-fusion-line-hit-target]")
      .evaluateAll((elements) =>
        elements.map((element) =>
          element.getAttribute("data-roof-fusion-line-hit-target"),
        ),
      );
    expect(originalIds).toEqual([
      "manual-line-1",
      "manual-line-2",
      "manual-line-3",
      "manual-line-4",
    ]);
    await drawLine(page, "valley", [9, 3], [12, 6], 5);
    const appendedIds = await page
      .locator("[data-roof-fusion-line-hit-target]")
      .evaluateAll((elements) =>
        elements.map((element) =>
          element.getAttribute("data-roof-fusion-line-hit-target"),
        ),
      );
    expect(new Set(appendedIds).size).toBe(5);
    expect(appendedIds.slice(0, 4)).toEqual(originalIds);
    await page.locator("[data-roof-fusion-undo-last-line]").click();
    await expect(page.locator("[data-roof-fusion-line-kind]")).toHaveCount(4);
    const valleyButton = page.locator('[data-roof-fusion-line-mode="valley"]');
    await valleyButton.click();
    await clickPoint(page, [9, 3]);
    await expect(
      page.locator("[data-roof-fusion-pending-line-point]"),
    ).toHaveCount(1);
    // Escape cancels the unfinished line; activating the same tool starts cleanly.
    await page.keyboard.press("Escape");
    await expect(
      page.locator("[data-roof-fusion-pending-line-point]"),
    ).toHaveCount(0);
    await expect(valleyButton).toHaveAttribute("aria-pressed", "false");
    await valleyButton.click();
    await clickPoint(page, [9, 3]);
    await valleyButton.click();
    await expect(
      page.locator("[data-roof-fusion-pending-line-point]"),
    ).toHaveCount(0);
    await expect(valleyButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-roof-fusion-line-kind]")).toHaveCount(4);
    await page.locator("[data-roof-fusion-edit-points]").click();
    await page
      .locator("[data-roof-fusion-canvas-shell]")
      .scrollIntoViewIfNeeded();
    const shared = await screenPoint(page, [9, 3]);
    await page.mouse.move(shared.x, shared.y);
    await page.mouse.down();
    await page.mouse.move(shared.x, shared.y - 8, { steps: 5 });
    await page.mouse.up();
    // All three explicitly connected branch endpoints must still share one node.
    const lines = await page
      .locator("[data-roof-fusion-line-kind]")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          id: element.getAttribute("data-roof-fusion-line-kind"),
          x1: element.getAttribute("x1"),
          y1: element.getAttribute("y1"),
          x2: element.getAttribute("x2"),
          y2: element.getAttribute("y2"),
        })),
      );
    const branch = lines[drawingOrder === "carrier-first" ? 1 : 0];
    expect([branch.x2, branch.y2]).toEqual([lines[2].x1, lines[2].y1]);
    // Canonical serialization may reverse an edge; connection must survive either orientation.
    expect([
      [lines[3].x1, lines[3].y1],
      [lines[3].x2, lines[3].y2],
    ]).toContainEqual([branch.x2, branch.y2]);
    expect(Number(branch.y2)).not.toBeCloseTo(0.6, 4);
    await page.locator('[data-roof-fusion-primary-action="calculate"]').click();
    await expect(page.locator("[data-roof-fusion-workbench]")).toHaveAttribute(
      "data-roof-fusion-stage",
      "review",
    );
    const editedResult = calculation as unknown as ReturnType<
      typeof invokeWorkbenchHeightAdapterV1
    >;
    expect(editedResult.summary.status).toBe("review_required");
    expect(editedResult.snapshot.geometry.surfaces).toHaveLength(5);
    expect(editedResult.summary.blockers.join(" ")).not.toContain(
      "SKELETON_DANGLING_ENDPOINT",
    );
  });
}
