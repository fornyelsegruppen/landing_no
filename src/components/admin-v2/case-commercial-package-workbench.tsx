import { CommercialQuoteEditor } from "./commercial-quote-editor";
import type { CaseCommercialPackageWorkbenchModel } from "@/lib/admin-v2/case-commercial-package-workbench-model";

export function CaseCommercialPackageWorkbench({
  value,
}: {
  value: CaseCommercialPackageWorkbenchModel;
}) {
  if (value.status !== "ready") return null;

  return <CommercialQuoteEditor {...value.editor} />;
}
