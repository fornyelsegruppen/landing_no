import type { Metadata } from "next";
import { Fragment } from "react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getSiteContent } from "@/lib/cms-content";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const content = await getSiteContent();
  const loc = locale as "no" | "en";
  const title = content.settings.privacy.title[loc];
  return {
    title,
    description: title,
    alternates: {
      canonical: `${siteConfig.url}/${locale}/personvern`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${siteConfig.url}/${l}/personvern`]),
      ),
    },
    robots: { index: true, follow: true },
  };
}

function renderMarkdownLite(body: string) {
  return body.split(/\n\n+/).map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("## ")) {
      const [heading, ...paragraphLines] = trimmed.split("\n");
      return (
        <Fragment key={i}>
          <h2 className="mt-8 text-xl font-semibold tracking-tight">
            {heading.replace(/^##\s+/, "")}
          </h2>
          {paragraphLines.length > 0 ? (
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {paragraphLines.join("\n").trim()}
            </p>
          ) : null}
        </Fragment>
      );
    }
    if (trimmed.startsWith("- ")) {
      const items = trimmed.split("\n").filter((l) => l.startsWith("- "));
      return (
        <ul
          key={i}
          className="text-muted-foreground mt-3 list-disc space-y-1 pl-5"
        >
          {items.map((item, j) => (
            <li key={j}>{item.replace(/^-\s+/, "")}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="text-muted-foreground mt-3 leading-relaxed">
        {trimmed}
      </p>
    );
  });
}

function withMarketingDisclosure(body: string, locale: "no" | "en") {
  const trackingConfigured = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ||
    process.env.NEXT_PUBLIC_META_PIXEL_ID,
  );
  if (
    !trackingConfigured ||
    /Google Analytics|Google Ads|Meta Pixel/i.test(body)
  )
    return body;

  const outdated =
    locale === "no"
      ? "Vi bruker ikke markedsføringscookies eller sporingsverktøy på nettsiden."
      : "We do not use marketing cookies or tracking tools on the website.";
  const disclosure =
    locale === "no"
      ? `## Annonsemåling og informasjonskapsler
Hvis du samtykker i informasjonskapselbanneret, bruker vi Google Analytics, Google Ads og Meta Pixel til å måle sidevisninger, henvendelser og klikk på telefon- og e-postlenker. Vi sender ikke navn, telefonnummer, e-postadresse, adresse, melding eller bilder til disse analyse- og annonsetjenestene. Markedsføringssporing aktiveres ikke hvis du avslår. Du kan når som helst endre valget via «Informasjonskapsler» nederst på nettsiden.`
      : `## Advertising measurement and cookies
If you consent in the cookie banner, we use Google Analytics, Google Ads and Meta Pixel to measure page views, enquiries, and clicks on phone and email links. We do not send names, phone numbers, email addresses, addresses, messages, or photos to these analytics and advertising services. Marketing tracking is not activated if you decline. You can change your choice at any time through “Cookie settings” in the website footer.`;

  return `${body.replace(outdated, "").trim()}\n\n${disclosure}`;
}

function withAiDisclosure(body: string, locale: "no" | "en") {
  if (/AI-assistert behandling|AI-assisted processing/i.test(body)) return body;
  const disclosure = locale === "no"
    ? `## AI-assistert behandling av henvendelser
Vi kan bruke en konfigurert AI-leverandør til å lage en intern oppsummering, mangelliste og et forslag til svar. Navn, telefon, e-post og full adresse sendes ikke i standardprompten, og fritekst reduseres og renses før behandling. AI-utkast sendes ikke automatisk til kunden; en administrator må kontrollere og godkjenne innholdet. AI bestemmer ikke pris, garanti, oppstart eller bindende tilbud. Opplysninger lagres og slettes etter våre vanlige regler for henvendelser. Produksjonsbruk forutsetter godkjent databehandleravtale.`
    : `## AI-assisted processing of enquiries
We may use a configured AI provider to prepare an internal summary, missing-information list, and reply suggestion. Names, phone numbers, email addresses, and full addresses are not included in the standard prompt, and free text is reduced and cleaned before processing. AI drafts are not sent automatically; an administrator must review and approve them. AI does not decide prices, warranties, start dates, or binding offers. Information follows our normal enquiry retention rules. Production use requires an approved data-processing agreement.`;
  return `${body.trim()}\n\n${disclosure}`;
}

function withOperationalDisclosure(body: string, locale: "no" | "en") {
  if (/Tilbud, måling og oppdragsoppfølging|Quotes, measurement and job follow-up/i.test(body)) return body;
  const disclosure = locale === "no"
    ? `## Tilbud, måling og oppdragsoppfølging
Når du ber om tilbud, kan adressen brukes til adresseoppslag og et kontrollert takarealestimat fra godkjente kart- eller bildekilder. Estimat, antakelser, kilde og usikkerhet lagres sammen med tilbudsgrunnlaget. Pris beregnes av faste, versjonerte regler; AI bestemmer ikke pris. Administrator må godkjenne tilbud og endringsavtaler før utsending. Ved elektronisk godkjenning lagres dokumentversjon, hash, tidspunkt og pseudonymiserte sikkerhetsbevis. Etter avtaleinngåelse kan vi sende nødvendige planleggingsbekreftelser, påminnelser og ferdigdokumentasjon i valgt kanal. Signerte dokumenter og nødvendig arbeidsdokumentasjon slettes ikke sammen med en ordinær, utløpt henvendelse når vi fortsatt har avtale-, reklamasjons- eller lovpålagt oppbevaringsgrunnlag.`
    : `## Quotes, measurement and job follow-up
When you request a quote, the address may be used for address lookup and a controlled roof-area estimate from approved map or imagery sources. The estimate, assumptions, source and uncertainty are stored with the quote basis. Prices are calculated by fixed, versioned rules; AI does not decide prices. An administrator must approve quotes and change agreements before they are sent. Electronic acceptance stores the document version, hash, time and pseudonymised security evidence. After an agreement is made, we may send necessary scheduling confirmations, reminders and completion documentation through the selected channel. Signed documents and necessary work documentation are not deleted with an ordinary expired enquiry while a contract, complaint or statutory retention basis still applies.`;
  return `${body.trim()}\n\n${disclosure}`;
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as "no" | "en";
  const content = await getSiteContent();
  const privacy = content.settings.privacy;
  const privacyBody = withOperationalDisclosure(withAiDisclosure(withMarketingDisclosure(privacy.body[loc], loc), loc), loc);

  return (
    <section className="section-pad">
      <div className="container-narrow max-w-3xl">
        <p className="eyebrow">
          <Link href="/" className="hover:text-accent">
            {loc === "no" ? "Forside" : "Home"}
          </Link>
        </p>
        <h1 className="heading-display mt-3 text-balance">
          {privacy.title[loc]}
        </h1>
        <div className="mt-8">{renderMarkdownLite(privacyBody)}</div>
      </div>
    </section>
  );
}
