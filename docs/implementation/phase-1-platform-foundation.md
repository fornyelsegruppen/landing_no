# Fase 1 – plattformfundament

**Status:** Fullført

**Dato:** 23. august 2026

**Branch:** `codex/master-platform-implementation`

## 1. Resultat

Det felles, sikre fundamentet for bloggautomatisering, henvendelser, tilbud, kontrakter og arbeidsordre er implementert uten å endre den offentlige kundereisen. Alle risikofunksjoner er avslått som standard og må både aktiveres og ha nødvendige integrasjoner før de kan kjøres.

## 2. Leveranser

| Område               | Implementert                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Feature flags        | Typed flags for AI-utkast, takmåling, tilbud, signering, workerportal, påminnelser og SEO-planlegger              |
| Konfigurasjonsstatus | Sikker status for AI, e-post, SMS, kart, signering, søkedata og jobber; viser aldri hemmelige verdier             |
| Admin-helsesjekk     | Autentisert admin-only `GET /api/admin/platform-health` med `no-store`                                            |
| Providerkontrakter   | AI, e-post, SMS, kart, signering og søkedata bak utskiftbare grensesnitt                                          |
| Sikre lokale drivere | Deterministisk AI, logg-e-post, deaktivert SMS, tom kartdriver, intern signaturkontroll og statiske søkedata      |
| Jobbmodell           | Status, begrenset retry, `attention`, idempotency key, correlation ID og sanitert feiltekst                       |
| Audit                | Append-only `audit-events`, snapshot-hash, feltliste og blokkering av sensitive metadatafelter                    |
| Tokens               | 256-bit opaque token, formålsbundet SHA-256-hash, utløp, tilbakekalling, single-use og timing-safe kontroll       |
| Penger               | NOK i heltall øre, mva i basispunkter og mengde i tusendeler                                                      |
| State machine        | Felles server-side overgangsvalidator                                                                             |
| Private filer        | Egen `private-media` collection og sentral tilgangspolicy for admin, tildelt worker og tidsbegrenset kundetilgang |
| Observability        | Correlation ID og rekursiv redigering av sensitive kontekstfelter                                                 |
| Testdata             | Kun syntetiske fixtures med reserverte `example.invalid`-adresser                                                 |
| Database             | Additiv migrasjon for `audit_events`, `operational_jobs`, `access_tokens` og `private_media`                      |

Den eksisterende admin Blob-routen krever nå eksplisitt adminrolle, ikke bare en vilkårlig innlogget CMS-bruker.

## 3. Sikkerhetsregler som er verifisert

- alle nye feature flags er `false` uten eksplisitt miljøkonfigurasjon;
- en aktivert funksjon regnes ikke som klar dersom en avhengighet mangler;
- API-responsen inneholder bare provider-navn og navn på manglende variabler, aldri API-nøkler;
- jobbpayload skal inneholde referanser, ikke kopiert kundedata;
- sensitive auditnøkler som navn, adresse, e-post, telefon, token og signatur avvises;
- private filer er ikke offentlig lesbare gjennom Payload;
- utløpte, tilbakekalte og brukte single-use-tokens avvises;
- migrasjonen endrer ikke historiske tabeller for leads, blogg, sider eller brukere.

## 4. Migrasjon og rollback

Migrasjonen `20260823_135227_phase1_platform_foundation` er bevisst additiv. Den:

1. oppretter kun fire nye collections og nødvendige enumtyper/indekser;
2. legger lock-relasjoner til bare når Payloads locktabell finnes;
3. legger bruker-FK til bare når `users` finnes;
4. tåler nytt kall uten duplisering;
5. har rollback som bare fjerner fase-1-objektene.

Den genererte JSON-filen er lagret som nåværende Payload/Drizzle-snapshot for senere migrasjoner. En egen test kjører SQL-en mot et isolert PostgreSQL-kompatibelt PGlite-miljø både på helt tom database og på en produksjonslik core-schema, kjører `up` to ganger, validerer unik idempotency key og kontrollerer avgrenset `down`.

Før produksjonsmigrasjon gjelder fortsatt blocker `B-011`: separat produksjonssnapshot og dokumentert restore-test må gjennomføres i staging/deployfasen. Ingen produksjonsdatabase er endret i denne fasen.

## 5. Verifikasjon

| Kontroll                                    | Resultat                                                   |
| ------------------------------------------- | ---------------------------------------------------------- |
| `npm run generate:types`                    | Bestått; alle nye Payload-typer generert                   |
| `npm run typecheck`                         | Bestått                                                    |
| `npm run lint`                              | Bestått                                                    |
| `npm test`                                  | Bestått; 25 testfiler / 79 tester etter endelig kontroll   |
| Migrasjon på tom isolert PostgreSQL-instans | Bestått                                                    |
| Migrasjon på produksjonslik core-schema     | Bestått, inkludert gjentatt `up`                           |
| Rollback-isolasjon                          | Bestått; core-tabeller beholdt                             |
| Produksjonsbuild med Postgres-adapter       | Bestått; 49 statiske sider og alle dynamiske routes samlet |
| Offentlig lead/blogg-regresjon              | Bestått gjennom eksisterende tester og full build          |
| `git diff --check`                          | Bestått                                                    |

Windows ARM64 mangler fortsatt den valgfrie native libSQL-pakken. Derfor ble den fullstendige builden kjørt med samme PostgreSQL-adapter som produksjonen, mens CMS-lesing bevisst var slått av under statisk bygg. Dette er et lokalt runtime-avvik, ikke en kode- eller produksjonsfeil.

## 6. Gate 1

**BESTÅTT.** Fundamentet fungerer uten ekte Gemini-, SMS- eller ekstern signeringskonto. SQL er utført og reversert i isolert PostgreSQL-miljø, offentlig build og regresjonstester er bestått, og alle risikofunksjoner forblir avslått.

Neste fase kan innføre streng `admin`/`worker`-modell, `/user`-skall og deny-by-default tilgang uten å bygge forretningslogikk på usikre roller.
