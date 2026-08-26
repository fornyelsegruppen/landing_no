import { configureServerFonts } from "./lib/server-fontconfig";

if (!configureServerFonts()) {
  console.error(
    "Takfornyelse PDF font files are unavailable; visual PDF generation will fail closed.",
  );
}
