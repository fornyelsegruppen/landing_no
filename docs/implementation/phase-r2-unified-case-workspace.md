# Fase R2 – samlet saksflate og handlingsinnboks

**Status:** Fullført i isolert staging 24. august 2026  
**Produksjon:** Urørt  
**Staging:** `https://takfornyelse-staging.vercel.app/admin-v2/cases/1`  
**Teknisk fallback:** Payload `/admin` er beholdt uendret

## Mål

Samle eksisterende kunde-, måle-, pris-, tilbuds-, meldings-, kontrakt-, arbeids- og dokumentdata i én sikker operativ sak, slik at administrator kan forstå status og utføre riktig neste handling uten å navigere mellom Payload-collections.

## Leveranser

- Serverbasert `AdminCase`-read-model over eksisterende Payload/PostgreSQL-data.
- Sikker dynamisk rute `/admin-v2/cases/{leadId}` med samme adminautorisasjon som R1.
- Statusheader med ansvarlig, frist og én deterministisk neste handling.
- Saksseksjoner for kunde, AI/henvendelse, måling, pris og tilbud, kundemeldinger, kontrakt, arbeid, endringsavtaler, dokumenter og tidslinje.
- Universelt søk og alle relevante køtreff åpner samme operative sak.
- Primærhandlinger gjenbruker eksisterende autoriserte admin-API-er og oppdaterer saken etter vellykket handling.
- Økonomiske handlinger for pris, tilbudsutkast, godkjenning og utsending krever eksplisitt bekreftelse.
- Audit ble lagt til for godkjenning/versjonering av måling, prisberegning og tilbudsutkast. Eksisterende tilbuds-, lead- og arbeidsordreaudit er bevart.
- Utdaterte meldingsutkast blir ikke foreslått på nytt når en nyere tilsvarende melding allerede er sendt. Dette hindrer duplisert tilbudsutsending.
- Server-read-model returnerer ikke kundelenke- eller tilgangstokens.
- Langt kundenavn brytes korrekt på mobil i stedet for å bli skjult.

## Sikkerhet og datakonsistens

- Siden krever aktiv Payload-bruker med rollen `admin` før data lastes.
- Alle muterende API-er utfører egen serverautorisasjon; klientvisningen er ikke en sikkerhetsgrense.
- Saken bruker samme database og dokumentreferanser som teknisk backoffice. Det finnes ingen parallell CRM-kopi.
- Sikre kundetokens eksponeres ikke av read-model. Eventuell kundelenke som allerede inngår i sendt meldingsbrødtekst er bare synlig for autentisert administrator.
- Feil ved primærhandling vises i saken og etterlater den opprinnelige statusen intakt.

## Verifikasjon

### Automatisk

- `npm run lint`: bestått.
- `npx tsc --noEmit --incremental false`: bestått.
- `npm test`: 108 testfiler og 322 tester bestått.
- R2-testene dekker 15 status-/neste-handlingstilstander, ukjent lead, komplett saksmontering, tokenfiltrering, utdaterte meldingsutkast og bekreftelseskrav for økonomiske handlinger.
- GitHub Quality gate [32766786378](https://github.com/fornyelsegruppen/landing_no/actions/runs/32766786378): dependency audit, lint, typecheck, 322 tester, migrasjon opp/ned, tom PostgreSQL 16-bootstrap, Linux/PostgreSQL-produksjonsbuild og 8 Chromium-smoketester bestått på commit `97df59b`.

### Autentisert staging

En eksisterende syntetisk stagingordre ble åpnet gjennom custom admin og kontrollert mot samme database:

- kunde, kontakt, adresse og status;
- godkjent takmåling `TM-1-V1` med arealintervall og confidence;
- deterministisk pris og tilbud `T-1-V1` med mva. og maksimalpris;
- sendt melding, eldre utkast og kontrakt `K-1-V1`;
- samlet kronologisk tidslinje;
- riktig primærstatus `Laukiama kliento`, uten nytt forslag om å sende gammelt utkast;
- AI-/henvendelsesseksjonen vises også når kvalifiseringsresultat mangler;
- 390 × 844 mobilvisning viser status, neste handling og seksjoner i én lesbar kolonne.

Ingen melding, pris, tilbud eller annen kundevendt handling ble utløst under visuell kontroll.

### Build og deployment

- Vercel Preview-build `dpl_ALD9TdmhZSG6qkGQbmrq9VWwf6jT` fullførte migrasjoner, TypeScript, 63 statiske sider og dynamisk saksrute.
- Fast stagingalias peker på dette bygget.
- Produksjonsdomene og produksjonsdeployment ble ikke endret.

## Kjente avgrensninger

- Automatisk kvalifisering/måling og confidence-ruting ferdigstilles i R4.
- Kundespørsmål, full tilbudsredigering og PDF-preview ferdigstilles i R5.
- Selskapsaksept og arbeidsordreopprettelse ferdigstilles i R6.
- Arbeidstildeling og planlegging ferdigstilles i R7; inntil da finnes kontrollert lenke til teknisk detalj for disse senere stegene.
- Samlet permanent dokument-/fakturaflyt ferdigstilles i R8.
- Profilert e-postadapter, umiddelbar jobbkjøring og leveringskontroll er neste fase R3.

## Gate R2

| Krav | Resultat |
|---|---|
| Eksisterende testordre kan behandles uten å åpne Payload-collections | Bestått for tilgjengelige R2-statusoverganger; senere arbeidsflyter er eksplisitt avgrenset til R4–R8 |
| Samme data og rettigheter som teknisk backoffice | Bestått med felles Payload/PostgreSQL-data og serverbasert adminautorisasjon |
| Økonomiske handlinger krever bekreftelse og audit | Bestått for måling, pris og tilbud; testet i kode uten å utføre kundevendt staginghandling |
| Desktop og telefon | Bestått i autentisert staging, inkludert 390 × 844 |
| Produksjon uendret | Bestått |

**Beslutning:** Gate R2 er bestått. Fasen er lukket i staging. R3 starter uten produksjonscutover.
