import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildServerFontConfig,
  configureServerFonts,
} from "./server-fontconfig";

describe("server font configuration", () => {
  it("aliases Arial and generic sans-serif to the bundled Unicode font", () => {
    const config = buildServerFontConfig("/var/task/fonts");
    expect(config).toContain("Liberation Sans");
    expect(config).toContain("<family>Arial</family>");
    expect(config).toContain("<family>sans-serif</family>");
  });

  it("creates a Linux fontconfig file only when both required fonts exist", () => {
    const root = mkdtempSync(path.join(tmpdir(), "takfornyelse-font-test-"));
    const fontDirectory = path.join(
      root,
      "node_modules",
      "pdfjs-dist",
      "standard_fonts",
    );
    mkdirSync(fontDirectory, { recursive: true });
    writeFileSync(
      path.join(fontDirectory, "LiberationSans-Regular.ttf"),
      "font",
    );
    writeFileSync(path.join(fontDirectory, "LiberationSans-Bold.ttf"), "font");

    expect(
      configureServerFonts({
        platform: "linux",
        projectRoot: root,
        temporaryDirectory: root,
      }),
    ).toBe(true);
    expect(process.env.FONTCONFIG_FILE).toBe(
      path.join(root, "takfornyelse-fonts.conf"),
    );
  });
});
