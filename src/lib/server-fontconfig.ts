import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CONFIG_FILENAME = "takfornyelse-fonts.conf";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildServerFontConfig(fontDirectory: string) {
  return `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${escapeXml(fontDirectory)}</dir>
  <cachedir>/tmp/takfornyelse-font-cache</cachedir>
  <alias>
    <family>Arial</family>
    <prefer><family>Liberation Sans</family></prefer>
  </alias>
  <alias>
    <family>sans-serif</family>
    <prefer><family>Liberation Sans</family></prefer>
  </alias>
</fontconfig>`;
}

export function configureServerFonts(input?: {
  platform?: NodeJS.Platform;
  projectRoot?: string;
  temporaryDirectory?: string;
}) {
  const platform = input?.platform ?? process.platform;
  if (platform !== "linux") return true;

  const projectRoot = input?.projectRoot ?? process.cwd();
  const fontDirectory = path.join(
    projectRoot,
    "node_modules",
    "pdfjs-dist",
    "standard_fonts",
  );
  const regularFont = path.join(fontDirectory, "LiberationSans-Regular.ttf");
  const boldFont = path.join(fontDirectory, "LiberationSans-Bold.ttf");
  if (!existsSync(regularFont) || !existsSync(boldFont)) return false;

  const configPath = path.join(
    input?.temporaryDirectory ?? tmpdir(),
    CONFIG_FILENAME,
  );
  writeFileSync(configPath, buildServerFontConfig(fontDirectory), "utf8");
  process.env.FONTCONFIG_FILE = configPath;
  process.env.FONTCONFIG_PATH = path.dirname(configPath);
  return true;
}
