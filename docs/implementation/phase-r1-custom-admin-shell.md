# Fase R1 – custom admin-skall på `/admin-v2`

**Status:** Fullført i isolert staging 24. august 2026  
**Produksjon:** Urørt  
**Staging:** `https://takfornyelse-staging.vercel.app/admin-v2`  
**Teknisk fallback:** Eksisterende Payload `/admin` er beholdt uendret

## Mål

Gi administrator en rask, tydelig og mobiltilpasset Takfornyelse-flate med eksisterende Payload-session og samme PostgreSQL-data, uten å gjøre Payload til nødvendig daglig startside.

## Leveranser

- Sikker, dynamisk `/admin-v2`-rute med eksisterende Payload-auth.
- Aktiv `admin` får tilgang; anonym bruker sendes til admininnlogging; `worker` sendes til `/user`.
- Responsiv Takfornyelse-layout med desktop-sidebar og sammenleggbart mobilmeny.
- Panelespråk norsk bokmål, lietuvių og English. Valget lagres på brukeren og brukes umiddelbart i aktiv session.
- Kundetekster, tilbud, kontrakter og andre utgående dokumenter påvirkes ikke av panelspråket og forblir på norsk.
- Read-only oversikt med faktiske antall for nye henvendelser, svarutkast, endringsavtaler, bloggkontroll, tilbud, kontrakter, aktive oppdrag, oppmerksomhet, manglende tildeling og neste 72 timer.
- Feil ved datalasting vises eksplisitt. Systemet viser ikke kunstige nullverdier når databasen eller en spørring feiler.
- Alle oversiktskort åpner en serverfiltrert operativ kø.
- Universelt søk på kundenavn, telefon, e-post, adresse, postnummer, sted og tilbuds-/kontrakt-/arbeidsreferanse.
- Kontrollert overgangslenke til teknisk Payload-backoffice. Egne samlede saksvisninger kommer i R2, dokumentregister i R8 og full bloggstyring i R9.

## Sikkerhets- og personvernmodell

- Autorisasjon håndheves på serveren før Payload-data lastes.
- `admin-v2` bruker ikke klientlagrede kundedata eller et parallelt API-token.
- Søk er begrenset til 80 tegn, krever minst to tegn og returnerer bare et begrenset antall treff.
- Serverfunksjonene returnerer bare feltene som trengs i kø og søk; full sak åpnes først i autorisert backoffice. R2 erstatter dette med samlet custom saksvisning.
- Ingen credentials, tokens eller kundedata er lagt i Git.

## Verifikasjon

### Automatisk

- `npm test`: 107 testfiler og 305 tester bestått før siste dokumentasjonscommit.
- R1-enhetstester: admin/worker/anonym beslutning, tillatte kønøkler, søkenormalisering, ekte telleraggregering, eksplisitt databasefeil og universelt søk.
- `npm run lint`: bestått uten advarsler.
- `npx tsc --noEmit --incremental false`: bestått.
- GitHub Quality gate `32763477323`: dependency audit, lint, typecheck, 305 tester, migrasjon opp/ned, tom PostgreSQL 16-bootstrap, Linux/PostgreSQL-produksjonsbuild og 8 Chromium-smoketester bestått på commit `3833987`.
- Den åttende Chromium-testen verifiserer at en anonym bruker omdirigeres til admininnlogging og ikke får lese custom dashboard-data.

### Autentisert staging

Følgende ble kontrollert i faktisk administratorsession mot stagingdatabasen:

- `/admin-v2` åpner med riktig administratoridentitet og reelle stagingtall;
- desktop-layout og navigasjon er lesbar og uten horisontal overflow;
- svarutkastkortet åpnet riktig filtrert kø og viste eksisterende meldingsutkast;
- søk etter `T-1` fant riktig tilbudsreferanse;
- språkbytte LT → EN → LT ble lagret og brukt uten ny innlogging;
- 390 × 844 mobilvisning skjulte desktop-sidebar, viste mobilmeny, søk og kort i én kolonne;
- mobilmenyen åpnet og viste blant annet Henvendelser og Blogg.

### Build

- Vercel Preview-build `dpl_2Pbs7NXSYtdueUkmWC22Zmm894YP` fullførte migrasjoner, TypeScript, 63 statiske sider og dynamisk `/admin-v2` mot staging PostgreSQL.
- Fast stagingalias peker på dette bygget.
- Lokal Windows ARM-kompilering fullfører kode og TypeScript, men page collection er fortsatt blokkert av det dokumenterte valgfrie `@libsql/win32-arm64-msvc`-modulet. Linux/PostgreSQL-build er autoritativt og bestått.

## Kjente avgrensninger

- R1 er med vilje read-only. Godkjenning, redigering og én samlet sak kommer i R2–R9 etter faseplanen.
- Enkelte overgangslenker åpner fortsatt Payload-detaljsiden. Dette bevarer en fungerende fallback til den samlede custom saksvisningen er ferdig i R2.
- E-postadapter og privat Blob-storage er egne eksisterende staging-/produksjonsporter og lukkes i senere faser; R1 introduserer ingen ny fil- eller e-postflyt.

## Gate R1

| Krav | Resultat |
|---|---|
| Worker og anonym bruker får ikke admin-data | Bestått gjennom serverautorisasjon, rolletest og anonym Chromium-redirecttest |
| Kort åpner riktig filtrert kø | Bestått i kode-/enhetstest og autentisert stagingprøve |
| Desktop og telefon | Bestått i autentisert staging, inkludert 390 × 844 |
| Eksisterende `/admin` uendret | Bestått; Payload er fortsatt tilgjengelig som fallback |
| Produksjon uendret | Bestått |

**Beslutning:** Gate R1 er bestått. Fasen er lukket i staging. Deretter starter R2 uten produksjonscutover.
