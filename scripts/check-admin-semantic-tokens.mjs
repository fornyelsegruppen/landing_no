import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const baseline = {
  "src/app/(admin-shell)/admin-v2/archive/page.tsx": 1,
  "src/app/(admin-shell)/admin-v2/cases/page.tsx": 5,
  "src/app/(admin-shell)/admin-v2/documents/page.tsx": 3,
  "src/app/(admin-shell)/layout.tsx": 3,
  "src/components/admin-next/admin-next-r4-measurement-review.tsx": 27,
  "src/components/admin-next/admin-next-roof-fusion-legacy-fallback-panel.tsx": 24,
  "src/components/admin-next/admin-next-roof-fusion-persistent-workbench.tsx": 10,
  "src/components/admin-next/admin-next-roof-fusion-uat-control.tsx": 18,
  "src/components/admin-next/admin-next-roof-fusion-unified-workbench.tsx": 130,
  "src/components/admin-next/admin-next-today.tsx": 4,
  "src/components/admin-next/norgeibilder-capture-control.tsx": 3,
  "src/components/admin-v2/cancellation-review-panel.tsx": 1,
  "src/components/admin-v2/case-command-bar.tsx": 1,
  "src/components/admin-v2/case-lifecycle-panel.tsx": 1,
  "src/components/admin-v2/change-agreement-panel.tsx": 2,
  "src/components/admin-v2/commercial-quote-editor.tsx": 6,
  "src/components/admin-v2/company-signature-panel.tsx": 1,
  "src/components/admin-v2/contract-request-review-panel.tsx": 3,
  "src/components/admin-v2/employee-admin.tsx": 6,
  "src/components/admin-v2/manual-contact-recovery-panel.tsx": 2,
  "src/components/admin-v2/measurement-review-panel.tsx": 18,
  "src/components/admin-v2/message-draft-editor.tsx": 2,
  "src/components/admin-v2/work-order-planning-panel.tsx": 8,
};

const roots = ["src/components/admin-next", "src/components/admin-v2", "src/app/(admin-shell)"];
const rawHex = /#[0-9a-f]{3,8}\b/gi;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

const violations = [];
for (const root of roots) {
  for (const file of await sourceFiles(root)) {
    const normalized = file.replaceAll("\\", "/");
    const content = await readFile(file, "utf8");
    const count = content.match(rawHex)?.length || 0;
    const allowed = baseline[normalized] || 0;
    if (count > allowed) violations.push(`${normalized}: ${count} raw HEX values (baseline ${allowed})`);
  }
}

if (violations.length) {
  console.error("New raw HEX values are forbidden in admin domain UI. Use semantic --an-* tokens:\n" + violations.join("\n"));
  process.exit(1);
}

console.log("Admin semantic token gate passed; no raw HEX debt was added.");
