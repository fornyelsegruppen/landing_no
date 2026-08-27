import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { ManualContactEmailForm } from "@/components/customer/manual-contact-email-form";
import { resolveManualContactRecoveryToken } from "@/lib/manual-contact/recovery";
import { getPayload } from "@/lib/payload";
import "../../globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kontroller kontaktinformasjon | Takfornyelse",
  robots: { index: false, follow: false },
};

export default async function ManualContactPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await getPayload();
  const recovery = await resolveManualContactRecoveryToken(payload, token);
  if (!recovery) notFound();
  const firstName = recovery.lead.name.trim().split(/\s+/)[0] || "kunde";

  return (
    <html className={manrope.variable} lang="no">
      <body className="bg-background text-foreground min-h-svh font-sans antialiased">
        <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16">
          <section className="rounded-3xl border border-white/10 bg-[#12151c] p-6 shadow-2xl sm:p-8">
            <p className="text-accent text-xs font-bold tracking-[.18em] uppercase">
              Takfornyelse · sikker kundeside
            </p>
            <h1 className="mt-3 text-3xl font-black">
              Kontroller e-postadressen
            </h1>
            <p className="mt-4 leading-7 text-white/75">
              Hei {firstName}. Vi vil være sikre på at informasjonen om saken
              din kommer frem. Skriv inn riktig e-postadresse nedenfor, så
              sender vi den aktuelle informasjonen på nytt.
            </p>
            <ManualContactEmailForm token={token} />
            <footer className="mt-6 border-t border-white/10 pt-5 text-sm text-white/60">
              <p>Takfornyelse · +47 47 73 58 88 · post@takfornyelse.as</p>
            </footer>
          </section>
        </main>
      </body>
    </html>
  );
}
