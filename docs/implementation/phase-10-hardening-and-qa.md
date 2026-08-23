# Fase 10 – hardening, SEO-måling og samlet QA

Dato: 23. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat

Plattformen har nå én samlet administrativ oversikt over oppmerksomhetsbehov, kommende arbeid, innholdsarbeid og integrasjonshelse. Publiserte artikler kan få Search Console-data og faktisk leadattribusjon, og systemet oppretter en forklarbar innholdsanbefaling som alltid må vurderes av administrator. Retention, tokenbruk, personvern, avhengigheter og driftsprosedyrer er samtidig strammet inn.

## Leveranser

### Operativ oversikt

- dashboardet viser arbeid de neste 72 timene, åpne endringsavtaler, ubehandlede innholdsanbefalinger og øvrige oppmerksomhetskøer;
- integrasjonshelse viser bare status og sikker forklaring, aldri nøkler, tokens eller andre hemmeligheter;
- feil i én valgfri leverandør stopper ikke den øvrige oversikten.

### SEO-måling og innholdsaudit

- publiserte norske og engelske blogg-URL-er kobles til henvendelser fra de siste 90 dagene;
- Search Console-målinger og URL-inspeksjon oppdateres når integrasjonen er konfigurert;
- manglende eller midlertidig utilgjengelig Search Console gir leadmåling og tydelig degradert status, ikke total feil;
- innholdsmotoren foreslår `behold`, `oppdater` eller `slå sammen` basert på alder, synlighet, CTR, posisjon og leads;
- `redirect` kan velges manuelt av administrator sammen med målside;
- anbefaling, begrunnelse, tidspunkt, målside og kontrolltid lagres; ingen anbefaling utføres automatisk;
- hver ytelsesoppdatering får korrelasjons-ID og audit-hendelse.

### Sikkerhet, retention og personvern

- sletting fjerner bare eksakte private Blob-URL-er som tilhørte en henvendelse som faktisk ble slettet;
- kontraktsrelaterte henvendelser beholdes på dokumentert rettslig grunnlag uten å stoppe behandling av andre rader;
- gamle v1-bildetokens avvises som standard og kan bare aksepteres frem til en eksplisitt, tidsbegrenset cutoff;
- personvernteksten forklarer adresse-/kartbruk, kontrollert arealestimat, deterministisk pris, administrativ godkjenning, signeringsbevis, påminnelser og dokumentasjonsoppbevaring;
- backup/restore, retention/sletting, incident response og databehandleroversikt er dokumentert i `docs/operations/`;
- kunde- eller autentiseringsdata er ikke lagt i Git.

### Plattform- og tilgjengelighetshardening

- Next.js er oppgradert til 16.3.2 og Payload-pakkene er låst samlet til 3.88.0;
- gammel middleware-konvensjon er erstattet av Next.js 16 `proxy`;
- ESLint-konfigurasjonen bruker leverandørens native flat-config;
- React-effekter, referanseoppdateringer, listener-opprydding og intern navigasjon er korrigert etter de strengere reglene;
- mobiltest kontrollerer 375 px-visning, horisontal overflow, én hovedoverskrift, sikkerhetsheadere og synlig tastaturfokus;
- personvernteksten har egen offentlig smoke-test.

## Migrasjon

- `20260823_200533_phase10_content_measurement_hardening` legger til leadytelse og innholdsaudit på blogginnlegg og tilsvarende versjonsfelter;
- migrasjonens `up` og `down` er kjørt mot PostgreSQL-kompatibel PGlite;
- eksisterende innlegg kan stå uten nye felt til første målekjøring, så migrasjonen er bakoverkompatibel.

## Verifikasjon

| Kontroll | Resultat |
|---|---|
| Fase-10-kjernetester | 5 filer, 10 tester bestått |
| Alle ikke-migrasjonstester | 79 filer, 227 tester bestått i minnesikre grupper |
| Alle migrasjonstester | 11 filer, 22 tester bestått enkeltvis |
| Samlet testomfang | 90 filer, 249 tester bestått |
| TypeScript | Bestått |
| ESLint | Bestått uten feil/advarsler |
| Produksjonsbuild | Bestått; 59 statiske sider og alle dynamiske ruter kompilert |
| Avhengighetssikkerhet | 0 kritiske/høye funn ved `npm audit --omit=dev --audit-level=high` |
| Migrasjon/rollback | Bestått på PGlite |
| Git diff-kontroll | Bestått |

## Kjente avvik og Gate 10

- seks moderate advisories ligger transitivt i Payloads `drizzle-kit`/eldre `esbuild` for utviklingsserveren; leverandørkjeden har ingen tilgjengelig rettelse. Utviklingsserver skal derfor aldri eksponeres offentlig;
- full nettleser-E2E med autentisert `/admin` og `/user` kan ikke kjøres på denne Windows ARM64-maskinen fordi den valgfrie native libsql-binæren ikke finnes;
- databaseuavhengig produksjonsbuild er bestått, men autentisert visuell QA, ekte leverandørtest og restore-øvelse må utføres i staging;
- den manuelle sjekklisten ligger i `docs/operations/phase10-manual-qa-checklist.md` og skal signeres med stagingbevis i fase 11.

Den automatiserte og kodebaserte delen av Gate 10 er bestått. Produksjonsgaten forblir lukket til fase 11 har dokumentert staging, restore, juridiske godkjenninger, eksterne leverandører og manuell mobil-/tilgjengelighetskontroll.
