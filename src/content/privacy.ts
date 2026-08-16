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
    no: `Sist oppdatert: juli 2026

## 1. Behandlingsansvarlig
Takfornyelse AS (org.nr. oppgitt på nettsiden) er behandlingsansvarlig for personopplysninger som samles inn via denne nettsiden.

## 2. Hvilke opplysninger vi samler inn
Når du sender inn forespørsel via kontaktskjemaet, kan vi lagre:
- navn, telefonnummer, e-post og adresse
- postnummer og omtrentlig takareal
- meldingstekst og type forespørsel
- bilder du laster opp (valgfritt)
- kampanjeparametere (UTM), annonseklikk-ID og første landingsside når du sender inn skjemaet

Vi bruker ikke markedsføringscookies eller tredjeparts sporingsverktøy uten et eget gyldig samtykke. Kampanjeparametere kan lagres midlertidig i nettleserøkten og sendes først når du selv sender inn skjemaet.

Hvis du godtar valgfri annonsemåling, lastes Google Ads-koden for å måle sidebesøk og innsendte henvendelser. Avslår du, lastes ikke Google-koden. Valget lagres lokalt i nettleseren og kan endres via «Personvernvalg» nederst på nettstedet.

## 3. Formål og rettslig grunnlag
Opplysningene brukes for å besvare henvendelsen din og følge opp tilbud om takarbeid. Rettslig grunnlag er ditt samtykke (GDPR art. 6 (1) a) og/eller berettiget interesse i å følge opp forespørselen (art. 6 (1) f).

## 4. Lagringstid
Henvendelser og tilhørende bilder slettes automatisk etter den lagringstiden som er satt i våre systemer (som standard 24 måneder), med mindre vi har en pågående dialog eller lovpålagt oppbevaringsplikt.

## 5. Deling med underleverandører
Vi bruker driftsleverandører for hosting, e-postutsendelse og fillagring (f.eks. Vercel og Resend). Disse behandler data på våre vegne etter databehandleravtale.

## 6. Dine rettigheter
Du har rett til innsyn, retting, sletting, begrensning, dataportabilitet og å trekke tilbake samtykke. Kontakt oss på e-postadressen oppgitt på nettsiden.

## 7. Klage
Du kan klage til Datatilsynet (datatilsynet.no) dersom du mener vi behandler opplysninger i strid med regelverket.`,
    en: `Last updated: July 2026

## 1. Controller
Takfornyelse AS (org. no. shown on the website) is the controller for personal data collected via this website.

## 2. What we collect
When you submit an enquiry via the contact form, we may store:
- name, phone number, email and address
- postal code and approximate roof size
- message text and enquiry type
- photos you upload (optional)
- campaign parameters (UTM), advertising click ID and first landing page when you submit the form

We do not use marketing cookies or third-party tracking tools without separate valid consent. Campaign parameters may be held temporarily in the browser session and are sent only when you submit the form.

If you accept optional advertising measurement, Google Ads code is loaded to measure page visits and submitted enquiries. If you decline, Google code is not loaded. Your choice is stored locally in the browser and can be changed through “Privacy choices” in the website footer.

## 3. Purpose and legal basis
Data is used to answer your enquiry and follow up on roofing quotes. Legal basis is your consent (GDPR Art. 6 (1) a) and/or legitimate interest in following up the request (Art. 6 (1) f).

## 4. Retention
Enquiries and related photos are deleted automatically after the retention period configured in our systems (24 months by default), unless we have an ongoing dialogue or a legal retention duty.

## 5. Subprocessors
We use hosting, email and file-storage providers (e.g. Vercel and Resend) that process data on our behalf under data processing agreements.

## 6. Your rights
You have the right of access, rectification, erasure, restriction, data portability and to withdraw consent. Contact us via the email address on the website.

## 7. Complaints
You may lodge a complaint with the Norwegian Data Protection Authority (datatilsynet.no).`,
  },
  linkLabel: {
    no: "Personvern",
    en: "Privacy",
  },
  consentLabel: {
    no: "Jeg godtar at Takfornyelse lagrer opplysningene og bildene mine for å behandle henvendelsen. Se personvernerklæringen.",
    en: "I agree that Takfornyelse may store my details and photos to process this enquiry. See the privacy policy.",
  },
} as const;
