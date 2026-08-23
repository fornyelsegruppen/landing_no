# Fase 0 – baseline og beslutningsregister

**Status:** Fullført

**Dato:** 23. august 2026

**Branch:** `codex/master-platform-implementation`

**Produksjonsbasis:** `380f64d2d7092cfb0bdf7f681ad6afebe30030c1`

## 1. Resultat

Eksisterende applikasjon, tilgangsmodell, routes, collections, migrasjoner, integrasjoner, kunnskapsgrunnlag og teknisk baseline er kontrollert. Implementeringen kan gå videre uten å endre produksjonen.

Produksjonsavhengige valg som ennå ikke er godkjent er registrert som konfigurasjon og feature-flag-blokkere. De skal ikke erstattes av skjulte antakelser.

## 2. Kode- og driftsbaseline

| Kontroll | Resultat |
|---|---|
| GitHub-produksjonscommit | `380f64d`, verifisert mot GitHub Deployments API |
| Vercel-produksjonsstatus | `success` |
| GitHub backupbranch | `backup/live-before-master-2026-08-23` |
| GitHub backuptag | `backup-live-before-master-2026-08-23` |
| Isolert lokalt katalog | `C:/Dev/takfornyelse-master-implementation` |
| `npm ci --legacy-peer-deps` | Bestått |
| `npm run lint` | Bestått |
| `npm run typecheck` | Bestått |
| `npm run test` | 10 testfiler og 37 tester bestått |
| `npm run build` | Kompilering bestått; lokal page-data-fase blokkert av eksisterende Windows ARM64/libSQL-problem |
| Produksjonsbuild for basiscommit | Bestått på Vercel |

Fullt backup- og restoregrunnlag er dokumentert i [backupmanifestet](../pre-master-backup-2026-08-23.md).

## 3. Nåværende arkitektur

### 3.1 Plattform

- Next.js 15.4.11 og React 19;
- Payload CMS 3.86;
- PostgreSQL/Neon i produksjon og SQLite som lokal standard;
- Vercel-hosting og Vercel Blob;
- Resend for e-post når nøkkel er konfigurert;
- Upstash Redis for distribuert rate limit når konfigurert;
- Vitest, Playwright, ESLint og TypeScript;
- versjonerte Payload-migrasjoner, automatisk kjørt før produksjonsbuild.

### 3.2 Eksisterende collections og global

| Type | Navn |
|---|---|
| Collections | `users`, `media`, `services`, `projects`, `products`, `faq`, `pages`, `posts`, `redirects`, `leads` |
| Global | `site-settings` |

Det finnes ti registrerte produksjonsmigrasjoner fra baseline til korrigert kalkulatorpris.

### 3.3 Eksisterende offentlige og interne routes

- Payload: `/admin` og `/api/[...slug]`;
- offentlig nettsted: lokalisert forside, sider, blogg og kundeomtaler;
- lead: `/api/lead`, opplastings-/bildeendepunkter og `/henvendelse/[id]`;
- preview: `/api/preview` og `/api/exit-preview`;
- admin Blob-proxy: `/api/admin/blob`;
- retention cron: `/api/cron/purge-leads` hver søndag kl. 03:00;
- robots og sitemap.

### 3.4 Eksisterende leadbeskyttelse

- Zod-validering;
- telefon eller e-post er obligatorisk;
- adresse er valgfri i offentlig API og lagres som `Ikke oppgitt` når tom;
- postnummer og eksplisitt personvernsamtykke er obligatorisk;
- honeypot og Turnstile-støtte;
- rate limit med Upstash og lokal memory-fallback;
- maks 15 bilde-URL-er;
- lead lagres før e-post forsøkes;
- e-postfeil logges uten å miste lead;
- tidsbegrenset v2-HMAC-token for leadbilder;
- eksisterende legacy-token er uten utløp for gamle utsendelser.

## 4. Identifiserte gap og risikoer

| ID | Funn | Konsekvens | Tiltak/fase |
|---|---|---|---|
| P0-01 | Roller er `admin` og `editor`, ikke `worker` | Ingen sikker ansattportal | Migrasjon og access i fase 2 |
| P0-02 | Ukjent/eldre rolle tolkes som `admin` | Farlig når worker innføres | Stram deny-by-default rolleparser i fase 2 |
| P0-03 | Hele `media`-collection er offentlig lesbar | Uegnet for kunde-, kontrakt- og arbeidsfiler | Medieklassifisering og privat filpolicy i fase 1 |
| P0-04 | Legacy leadbildetoken utløper aldri | Gamle lenker kan leve for lenge | Revocation/hash-strategi uten å ødelegge gamle lenker i fase 1 |
| P0-05 | E-post sendes direkte i lead-request | Retry og leveringsstatus mangler | Outbox/jobber i fase 1 og 5 |
| P0-06 | In-memory rate limit er svak på serverless | Produksjon krever Upstash | Helsesjekk og configuration gate i fase 1 |
| P0-07 | Leadstatus har bare fire generelle verdier | Kan ikke styre tilbudsreisen | Kontrollert statusmigrasjon i fase 5 |
| P0-08 | Blogg krever engelsk tittel og innhold | Norsk-først arbeidsflyt blokkeres | Fase 3 |
| P0-09 | Bloggbody er begrenset textarea/Markdown-lite | Mangler full lenke- og innholdsstruktur | Fase 3 |
| P0-10 | Kalkulatorinnstillinger er ikke versjonert prisbok | Ikke egnet for bindende tilbud | Egen prisbok i fase 6 |
| P0-11 | Lokal Windows ARM64 mangler libSQL-binary | Lokal produksjonsbuild stopper ved page data | Bruk PostgreSQL/Linux CI eller støttet lokal runtime før Gate 1 |
| P0-12 | 16 npm audit-funn: 6 moderate, 10 high | Krever kontrollert avhengighetsarbeid | Risikovurderes og oppgraderes uten `--force` i fase 10 |
| P0-13 | Retention cron kjenner bare leads/Blob-prefiks | Nye relasjoner kan bli foreldreløse eller slettes feil | Utvid retention etter ny datamodell i fase 9/10 |
| P0-14 | To merkevarekilder bruker Takfornyelse og Fornyelsegruppen | Risiko for blandet kundespråk | Låst merkevarebeslutning under |

## 5. Låste beslutninger

### D-001 – applikasjon

Alt bygges i eksisterende `landing_no` med Next.js, Payload og samme produksjonsdatabase. Ingen separat Laravel-/Filament-applikasjon opprettes.

### D-002 – interne kontotyper

Kun `admin` og `worker` brukes i første versjon. `editor` migreres kontrollert; ukjent rolle skal aldri gi adminrettigheter.

### D-003 – interne flater

- `/admin` er full administrasjon;
- `/user` er mobil-først for ansatte;
- worker ser bare egne tildelte oppdrag;
- kunde får sikker tidsbegrenset tilbudslenke, ikke permanent konto.

### D-004 – merkevare

Det eksisterende nettstedet fortsetter å være kundevendt som **Takfornyelse** på `takfornyelse.as`. Fornyelsegruppens kunnskapsbase brukes som operativ kilde for godkjente regler, men navn, e-post, visuell identitet og lenker skal tilpasses og valideres mot Takfornyelse før de publiseres. Automatisk tekst skal ikke blande de to identitetene.

### D-005 – språk

Norsk bokmål er primærspråk i admin, meldinger og blogg. Eksisterende engelsk nettsted beholdes, men engelsk blogginnhold er valgfritt og skal ikke blokkere norsk publisering.

### D-006 – AI-autoritet

Gemini brukes bak et provider-grensesnitt. AI kan foreslå og forklare, men kan ikke bestemme tall, publisere, sende økonomiske dokumenter, godkjenne avvik eller gjøre HMS-/konstruksjonsvedtak.

### D-007 – menneskelig godkjenning

Administrator må godkjenne bloggpublisering, personlige AI-svar med nye påstander, tilbud, kontrakt, endringsavtale og lav-confidence-måling.

### D-008 – adresse i leadskjema

Adressefeltet skal være synlig og tydelig anbefalt, men kunden kan sende skjemaet uten adresse. Automatisk kartmåling og konkret tilbud blokkeres til systemet har nok verifiserbar eiendomsinformasjon.

### D-009 – kart og måling

Kartverkets offisielle API-er og lovlig lisensiert kart-/ortofoto brukes. Norgeskart skal ikke skrapes eller fjernstyres som produksjonsavhengighet. AI foreslår polygon/vinkelgruppe; vanlig kode beregner areal.

### D-010 – takareal

Skrått areal beregnes deterministisk som:

```text
faktor = 1 / cos(takvinkel)
faktisk takareal = horisontalt areal × faktor
```

Referansefaktorene 22°–45° fra mottatt beregningsgrunnlag er obligatoriske tester. Usikker vinkel gir intervall/confidence, ikke falsk eksakt verdi.

### D-011 – priser

Pakkeprisene `99 / 138 / 337 kr/m2 + mva` er godkjente veiledende markedsføringsankere for Basic, Standard og Premium. De skal ikke automatisk bli bindende tilbudspriser. Bindende beregning bruker en versjonert, administratorgodkjent prisbok.

### D-012 – tjenesteområde

Ålesund og Møre og Romsdal skal beholdes som betjent område. Systemet skal likevel innhente sted og kunne stoppe automatisk løfte dersom kapasitet eller logistikk må avklares.

### D-013 – kommunikasjon

Resend/e-post er første aktive kanal. SMS bygges som adapter, men er deaktivert til leverandør, samtykke og maler er godkjent. Servicekommunikasjon skilles fra markedsføring.

### D-014 – sikker oppstart

Arbeid kan ikke starte før worker har gjennomført før-kontroll. Avvik over avtalt maksimalramme, endret omfang eller HMS-risiko blokkerer oppstart.

### D-015 – datamigrasjon og deploy

- migrasjoner er additive før separat produksjonsbackup og restore-test;
- alle risikofunksjoner er avslått bak feature flags som standard;
- full løsning testes lokalt og i preview/staging;
- produksjon oppdateres bare med godkjent pull request etter Gate 10/11.

## 6. Åpne produksjonsblokkere

Disse blokkerer ikke trygg kodeutvikling, men blokkerer aktivering av berørte funksjoner:

| ID | Beslutning | Midlertidig implementeringsregel | Eier før produksjon |
|---|---|---|---|
| B-001 | Hvilke tjenester kan få automatisk m2-tilbud | Kun konfigurerbare tjenester; ingen aktiv som standard | Administrator/fagansvarlig |
| B-002 | Toleranse per tjeneste | Felt og regelmotor bygges; ingen skjult standard | Administrator + juridisk kontroll |
| B-003 | Maksimalbeløpsformel | Konfigurerbar; manglende verdi blokkerer sending | Administrator + juridisk kontroll |
| B-004 | Kontrollmålemetode på stedet | Registreres som påkrevd valg | Fagansvarlig |
| B-005 | Kontrakts-, angrerett- og endringstekst | Malversjon kreves; produksjonsflagget av | Juridisk/personvernansvarlig |
| B-006 | Endelig signeringsmetode | Provider og testdriver bygges | Administrator + juridisk kontroll |
| B-007 | Kart-/ortofotoleverandør og lisens | Adresse-API kan bygges; bildebruk av | Administrator/teknisk ansvarlig |
| B-008 | Synlig bloggforfatter og reviewer | Felter kreves; publisering blokkeres uten ekte navn | Administrator |
| B-009 | Search Console Domain property | CSV/manuell fallback | Google-kontoeier |
| B-010 | Gemini API og databehandlergrunnlag | Fake provider; AI-feature av | Administrator/personvernansvarlig |
| B-011 | Produksjonsdatabase-snapshot og restore | Ingen produksjonsmigrasjon før bevis | Database-/Vercel-eier |
| B-012 | Nødvendige før-/etterbilder per tjeneste | Konfigurerbar sjekkliste | Fagansvarlig |

## 7. Miljøvariabelinventar

Eksisterende navn beholdes. Verdier ble ikke lest eller lagret i rapporten.

### Eksisterende

- `NEXT_PUBLIC_SITE_URL`;
- `PAYLOAD_SECRET` og valgfri `PREVIEW_SECRET`;
- `DATABASE_URL` og `DATABASE_URL_MIGRATE`;
- `BLOB_READ_WRITE_TOKEN`;
- `RESEND_API_KEY`, `LEAD_FROM_EMAIL`, `LEAD_TO_EMAIL`;
- Turnstile-variabler;
- Upstash-variabler;
- `CRON_SECRET`;
- Google/Meta analysevariabler;
- valgfri `SENTRY_DSN`.

### Planlagt i fase 1 og senere

- feature flags fra masterplanen;
- Gemini API/model/budsjett;
- provider-valg for e-post, SMS, kart og signering;
- sikre token-/signeringsinnstillinger;
- Search Console OAuth-referanse uten token i CMS;
- jobb- og cron-konfigurasjon.

## 8. Personvern- og sikkerhetsgrunnlag

Følgende regler er bindende for implementeringen:

- ingen API-nøkler, cookies, tokens, kundedata eller databaseeksporter i Git;
- minst mulig persondata sendes til AI;
- AI QA bruker anonymiserte data der mulig;
- opt-out og samtykke lagres og håndheves;
- markedsføring sendes ikke uten gyldig grunnlag;
- servicebekreftelser inneholder ikke skjult mersalg;
- pris, kontrakt, signatur, tildeling, overstyring og sletting auditeres;
- personvernforespørsel eskaleres til menneske;
- kunden oppfordres aldri til å gå på taket;
- lekkasje, snølast, skade, klage, garanti og avtalevilkår eskaleres.

## 9. Fase 1 – konkret startpakke

Fase 1 skal implementere fundament uten å endre kundereisen:

1. typed feature flags og integrasjonskonfigurasjon;
2. provider-kontrakter med fake/log-drivere;
3. generell token-tjeneste med hash, utløp og tilbakekalling;
4. state-transition-validator;
5. pengesummer/mva som heltall;
6. idempotency og job/outbox-grunnlag;
7. audit events og felles audit-tjeneste;
8. privat/offentlig mediaklassifisering;
9. korrelasjons-ID og sikker strukturert logging;
10. additive migrasjoner, genererte Payload-typer og tester.

## 10. Gate 0-verifikasjon

| Krav | Resultat |
|---|---|
| Baseline grønn eller avvik dokumentert | Bestått |
| Produksjonskode identifisert og backupet | Bestått |
| Arkitektur og data inventert | Bestått |
| Produksjonsblokkere har eier og sikker fallback | Bestått |
| Hemmeligheter/persondata ikke lagret | Bestått |
| Kunnskapsbase og detaljroadmaps kontrollert | Bestått |
| Fase 1 har konkret, avgrenset startpakke | Bestått |

**Gate 0: BESTÅTT.** Fase 1 kan starte. Ingen endring er gjort i produksjonen.
