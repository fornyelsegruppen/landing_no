import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.F1_CAPTURE_BASE_URL ?? "http://127.0.0.1:3100";
const outputDirectory = new URL("../docs/implementation/evidence/admin-unified-f1/", import.meta.url);
const captures = [
  ["admin-next-fixture", 1440, 900, "unified-today-1440.png"],
  ["admin-next-fixture", 375, 812, "unified-today-375.png"],
  ["admin-next-system-fixture", 1440, 1000, "component-catalog-1440.png"],
  ["admin-next-system-fixture", 375, 812, "component-catalog-375.png"],
];

await mkdir(fileURLToPath(outputDirectory), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [route, width, height, fileName] of captures) {
    const page = await browser.newPage({ viewport: { width, height } });
    const response = await page.goto(`${baseUrl}/${route}`, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`${route} returned ${response?.status() ?? "no response"}`);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove()));
    await page.screenshot({ path: fileURLToPath(new URL(fileName, outputDirectory)), fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
