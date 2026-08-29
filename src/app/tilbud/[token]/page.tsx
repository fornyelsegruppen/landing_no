import { Manrope } from "next/font/google";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerQuote } from "@/components/quotes/customer-quote";
import { getPayload } from "@/lib/payload";
import { loadCustomerQuote } from "@/lib/quotes/customer-view";
import { loadCustomerQuestionState } from "@/lib/messages/customer-question-state";
import "../../globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Personlig tilbud | Takfornyelse",
  robots: { index: false, follow: false },
};

export default async function CustomerQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await getPayload();
  const view = await loadCustomerQuote(payload, token, { markViewed: true });
  if (!view) notFound();
  const questionState = await loadCustomerQuestionState(
    payload,
    view.snapshot.quote.leadId,
  );
  return (
    <html className={manrope.variable} lang="no">
      <body className="bg-background text-foreground min-h-svh font-sans antialiased">
        <CustomerQuote
          token={token}
          quoteStatus={view.quoteStatus}
          contractStatus={view.contractStatus}
          contractReference={view.contractReference}
          documentHash={view.documentHash}
          customerName={view.customerName}
          display={view.display}
          supplier={view.snapshot.supplier}
          terms={view.snapshot.terms}
          signedAt={view.signedAt}
          companySignedAt={view.companySignedAt}
          optionKind={view.optionKind}
          measurementEvidenceHref={
            view.snapshot.quote.measurement.mode === "manual_no_visual"
              ? undefined
              : `/api/customer/quote/${encodeURIComponent(token)}/measurement-evidence`
          }
          questionState={questionState.status}
        />
      </body>
    </html>
  );
}
