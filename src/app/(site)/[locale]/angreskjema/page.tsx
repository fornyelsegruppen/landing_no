import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";
import { withdrawalFormCopy } from "@/content/withdrawal";
import { PrintWithdrawalFormButton } from "@/components/legal/print-withdrawal-form-button";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const loc = locale as "no" | "en";
  const copy = withdrawalFormCopy[loc];
  return {
    title: copy.title,
    description: copy.intro,
    alternates: {
      canonical: `${siteConfig.url}/${loc}/angreskjema`,
      languages: Object.fromEntries(
        routing.locales.map((language) => [language, `${siteConfig.url}/${language}/angreskjema`]),
      ),
    },
    robots: { index: true, follow: true },
  };
}

function FormLine({ label }: { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      <span>{label}</span>
      <span aria-hidden="true" className="block min-h-11 border-b border-white/45" />
    </label>
  );
}

export default async function WithdrawalFormPage({ params }: Props) {
  const { locale } = await params;
  const loc = locale as "no" | "en";
  setRequestLocale(loc);
  const copy = withdrawalFormCopy[loc];

  return (
    <section className="section-pad print:bg-white print:py-0 print:text-black">
      <div className="container-narrow max-w-3xl">
        <div className="print:hidden">
          <p className="eyebrow">
            <Link className="hover:text-accent" href="/">{copy.home}</Link>
          </p>
        </div>
        <article className="mt-4 rounded-3xl border border-white/15 bg-background-elevated/75 p-6 sm:p-10 print:mt-0 print:rounded-none print:border-0 print:bg-white print:p-0">
          <p className="eyebrow print:text-black">{copy.eyebrow}</p>
          <h1 className="heading-display mt-3 text-balance text-3xl sm:text-5xl print:text-3xl">{copy.title}</h1>
          <div className="mt-6 rounded-2xl border border-accent/35 bg-accent/10 p-5 print:border-black/30 print:bg-white">
            <h2 className="text-lg font-bold">{copy.statusTitle}</h2>
            <p className="mt-2 leading-7 text-muted-foreground print:text-black">{copy.statusText}</p>
          </div>
          <p className="mt-5 leading-7 text-muted-foreground print:text-black">{copy.intro}</p>
          <p className="mt-3 leading-7 text-muted-foreground print:text-black">{copy.deadline}</p>

          <div className="mt-8 rounded-2xl border border-white/15 p-5 print:border-black/30">
            <h2 className="text-lg font-bold">{loc === "no" ? "Til" : "To"}</h2>
            <address className="mt-3 not-italic leading-7 text-muted-foreground print:text-black">
              {siteConfig.parentOrg} / {siteConfig.name}<br />
              {siteConfig.address.street}, {siteConfig.address.postal} {siteConfig.address.city}<br />
              {siteConfig.email}<br />
              {siteConfig.phone}
            </address>
          </div>

          <p className="mt-8 font-semibold">{copy.declaration}</p>
          <div className="mt-6 grid gap-7">
            <FormLine label={copy.fields.reference} />
            <FormLine label={copy.fields.service} />
            <FormLine label={copy.fields.agreementDate} />
            <FormLine label={copy.fields.customerName} />
            <FormLine label={copy.fields.customerAddress} />
            <FormLine label={copy.fields.date} />
            <FormLine label={copy.fields.signature} />
          </div>

          <div className="mt-10 border-t border-white/15 pt-6 print:border-black/30">
            <h2 className="text-xl font-bold">{copy.sendTitle}</h2>
            <p className="mt-3 leading-7 text-muted-foreground print:text-black">{copy.sendText}</p>
            <a className="mt-3 inline-flex font-bold text-accent underline print:text-black" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
          </div>
        </article>
        <div className="mt-6 flex justify-end print:hidden">
          <PrintWithdrawalFormButton label={copy.print} />
        </div>
      </div>
    </section>
  );
}
