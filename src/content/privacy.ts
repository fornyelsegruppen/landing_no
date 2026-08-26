/**
 * Default privacy policy copy (NO/EN). CMS Site Settings can override.
 * This is a starting template — the client should review with their lawyer.
 */
export const privacyFallback = {
  title: {
    no: "Personvernerklæring",
    en: "Privacy policy",
  },
  body: {
    no: `Sist oppdatert: august 2026

## 1. Behandlingsansvarlig
Fornyelse Gruppen AS (org.nr. 916 693 168), som driver Takfornyelse, er behandlingsansvarlig for personopplysninger som samles inn via denne nettsiden.

## 2. Hvilke opplysninger vi samler inn
Når du sender inn forespørsel via kontaktskjemaet, kan vi lagre:
- navn, telefonnummer, e-post og adresse
- postnummer og omtrentlig takareal
- meldingstekst og type forespørsel
- bilder du laster opp (valgfritt)
- tilbuds-, kontrakts- og samtykkeversjoner
- signaturbevis, dokumenthash, tidspunkt og pseudonymiserte sikkerhetsopplysninger når du signerer elektronisk

Selve signaturtegningen brukes til å lage den signerte PDF-kopien. Systemet lagrer dokument- og signaturhash samt nødvendig bevis, og sender ikke disse opplysningene til annonsetjenester.

Hvis du samtykker i informasjonskapselbanneret, bruker vi Google Ads og Meta Pixel til å måle sidevisninger, henvendelser og klikk på telefon- og e-postlenker. Vi sender ikke navn, telefonnummer, e-postadresse, adresse, melding eller bilder til disse annonsetjenestene. Markedsføringssporing aktiveres ikke hvis du avslår.

## 3. Formål og rettslig grunnlag
Opplysningene brukes for å besvare forespørselen din, forberede og inngå en eventuell avtale, gjennomføre arbeidet, fakturere, dokumentere kommunikasjon og ivareta rettskrav. Behandling som er nødvendig for forespørselen og avtalen bygger normalt på GDPR art. 6 (1) b. Sikkerhet, misbruksforebygging og nødvendig dokumentasjon kan bygge på berettiget interesse etter art. 6 (1) f, og lovpålagt regnskapsføring på art. 6 (1) c. Samtykke brukes separat for valgfrie markedsførings- og analyseformål.

## 4. Lagringstid
Henvendelser og tilhørende bilder slettes automatisk etter den lagringstiden som er satt i våre systemer (som standard 24 måneder), med mindre vi har en pågående dialog eller lovpålagt oppbevaringsplikt. Aksepterte tilbud, signerte kontrakter, regnskapsgrunnlag og tilhørende bevis oppbevares separat så lenge det er nødvendig for å oppfylle avtalen, håndtere rettskrav og følge lovpålagte krav.

## 5. Deling med underleverandører
Vi bruker driftsleverandører for hosting, e-postutsendelse og fillagring (f.eks. Vercel og Resend). Disse behandler data på våre vegne etter databehandleravtale. Når du samtykker til annonsemåling, kan tekniske bruksdata deles med Google og Meta etter deres personvernvilkår.

## 6. Dine rettigheter
Du har rett til innsyn, retting, sletting, begrensning, dataportabilitet og å trekke tilbake samtykke. Du kan når som helst endre valget via «Informasjonskapsler» nederst på nettsiden. Kontakt oss på e-postadressen oppgitt på nettsiden.

## 7. Klage
Du kan klage til Datatilsynet (datatilsynet.no) dersom du mener vi behandler opplysninger i strid med regelverket.`,
    en: `Last updated: August 2026

## 1. Controller
Fornyelse Gruppen AS (org. no. 916 693 168), which operates Takfornyelse, is the controller for personal data collected via this website.

## 2. What we collect
When you submit an enquiry via the contact form, we may store:
- name, phone number, email and address
- postal code and approximate roof size
- message text and enquiry type
- photos you upload (optional)
- quote, contract and consent versions
- signature evidence, document hashes, timestamps and pseudonymised security data when you sign electronically

The signature drawing is used to create the signed PDF copy. The system retains the document and signature hashes and necessary evidence, and does not send this information to advertising services.

If you consent in the cookie banner, we use Google Ads and Meta Pixel to measure page views, enquiries, and clicks on phone and email links. We do not send names, phone numbers, email addresses, addresses, messages, or photos to these advertising services. Marketing tracking is not activated if you decline.

## 3. Purpose and legal basis
Data is used to answer your enquiry, prepare and enter into an agreement, carry out the work, invoice, document communications and handle legal claims. Processing needed for the enquiry and contract normally relies on GDPR Art. 6 (1) b. Security, abuse prevention and necessary documentation may rely on legitimate interests under Art. 6 (1) f, and statutory accounting on Art. 6 (1) c. Consent is used separately for optional marketing and analytics purposes.

## 4. Retention
Enquiries and related photos are deleted automatically after the configured period (24 months by default), unless there is an ongoing dialogue or legal retention duty. Accepted quotes, signed contracts, accounting material and related evidence are retained separately for as long as needed to perform the agreement, handle legal claims and meet statutory duties.

## 5. Subprocessors
We use hosting, email and file-storage providers (e.g. Vercel and Resend) that process data on our behalf under data processing agreements. If you consent to advertising measurement, technical usage data may be shared with Google and Meta under their privacy terms.

## 6. Your rights
You have the right of access, rectification, erasure, restriction, data portability and to withdraw consent. You can change your choice at any time through “Cookie settings” in the website footer. Contact us via the email address on the website.

## 7. Complaints
You may lodge a complaint with the Norwegian Data Protection Authority (datatilsynet.no).`,
  },
  linkLabel: {
    no: "Personvern",
    en: "Privacy",
  },
  consentLabel: {
    no: "Jeg bekrefter at opplysningene er riktige og at jeg har lest personvernerklæringen.",
    en: "I confirm that the information is correct and that I have read the privacy policy.",
  },
} as const;

export function privacyAcknowledgement(locale: "no" | "en", configured?: string | null) {
  const candidate = configured?.trim();
  if (!candidate) return privacyFallback.consentLabel[locale];
  const legacyConsent = locale === "no"
    ? /jeg\s+godtar\s+at.+(?:lagrer|behandler)/i.test(candidate)
    : /i\s+(?:agree|consent)\s+that.+(?:store|process)/i.test(candidate);
  return legacyConsent ? privacyFallback.consentLabel[locale] : candidate;
}
