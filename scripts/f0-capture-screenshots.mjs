import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.F0_CAPTURE_BASE_URL ?? "http://127.0.0.1:3100";
const outputDirectory = new URL(
  "../docs/implementation/evidence/admin-unified-f0-current-ui/",
  import.meta.url,
);

const captures = [
  ["admin-next-fixture", 1440, 900, "admin-next-today-1440.png"],
  ["admin-next-fixture", 1024, 900, "admin-next-today-1024.png"],
  ["admin-next-fixture", 768, 1024, "admin-next-today-768.png"],
  ["admin-next-fixture", 375, 812, "admin-next-today-375.png"],
  ["admin-next-case-fixture", 1440, 900, "admin-next-case-1440.png"],
  ["admin-next-case-fixture", 375, 812, "admin-next-case-375.png"],
  ["admin-next-r4-fixture", 1440, 900, "admin-next-r4-1440.png"],
  ["admin-next-r4-fixture", 375, 812, "admin-next-r4-375.png"],
  [
    "admin-next-document-preflight-fixture",
    1440,
    900,
    "admin-next-document-preflight-1440.png",
  ],
  [
    "admin-next-document-preflight-fixture",
    375,
    812,
    "admin-next-document-preflight-375.png",
  ],
  ["admin-next-field-visit-fixture", 1440, 900, "admin-next-field-visit-1440.png"],
  ["admin-next-field-visit-fixture", 375, 812, "admin-next-field-visit-375.png"],
];

const browser = await chromium.launch({ headless: true });

try {
  for (const [route, width, height, fileName] of captures) {
    const page = await browser.newPage({ viewport: { width, height } });
    const response = await page.goto(`${baseUrl}/${route}`, { waitUntil: "networkidle" });

    if (!response?.ok()) {
      throw new Error(`${route} returned ${response?.status() ?? "no response"}`);
    }

    await page.waitForTimeout(250);
    await page.evaluate(() => {
      for (const portal of document.querySelectorAll("nextjs-portal")) {
        portal.remove();
      }
    });
    await page.screenshot({
      path: fileURLToPath(new URL(fileName, outputDirectory)),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
