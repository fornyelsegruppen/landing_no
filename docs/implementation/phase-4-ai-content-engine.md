# Fase 4 – AI-assistert innholdsmotor

Dato: 23. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat

Takfornyelse har nå en kontrollert innholdsmotor som kan foreslå og prioritere temaer, lage strukturerte norske blogg-utkast med Gemini og stoppe tekst som ikke består deterministisk kvalitetskontroll. Motoren kan aldri publisere direkte. En administrator må kontrollere, navngi faglig kontrollør, godkjenne og enten publisere eksplisitt eller angi et gyldig fremtidig tidspunkt.

## Leveranser

### Temakilder og prioritering

- ti godkjente manuelle fagtemaer er alltid tilgjengelige, inkludert Ålesund;
- offisiell Google Search Console-integrasjon bruker kun `webmasters.readonly` og eksakt konfigurert eiendom;
- Google Ads, Google Trends og Search Console kan importeres som CSV;
- CSV-parseren støtter komma/semikolon, norske/engelske kolonnenavn, duplikatsummering, maksimum 1 MB og 2 000 rader;
- kundespørsmål kan bare brukes aggregert etter fjerning av e-post, telefon og gateadresse; enkelthenvendelser eksponeres ikke;
- hver kandidat har kilde, begrunnelse, 0–100 topic score, poenggrunnlag, overlap score og en deterministisk artikkelbrief;
- 70 prosent eller høyere tematisk overlapp avvises som mulig kannibalisering.

Topic score følger vedtatt vekting: tjenesterelevans 25, etterspørsel 20, kommersiell verdi 15, innholdsgap 15, sesong 10, original kunnskap 10 og lokal relevans 5.

### AI-utkast og kvalitetsporter

- Gemini bruker strukturert JSON-output med Zod-validering;
- API-nøkkelen sendes bare i `x-goog-api-key`, aldri i URL, prompt, database eller logg;
- modell kan konfigureres, mens staging bruker `gemini-3.5-flash-lite`;
- prompt-, modell- og kunnskapsversjon lagres i `seo-runs`;
- godkjent bedriftskunnskap om tjenester, priser, områder, påstander, sikkerhet og CTA er versjonert;
- pris, garanti, usikre takråd, språkblanding, søkeordstapping, manglende internlenke og overlapp kontrolleres maskinelt;
- foreslått output inneholder artikkel, metadata, FAQ, CTA, internlenker, kilder, bildebrief, alt-tekst og punkter for menneskelig kontroll;
- lav kvalitet lagres som en oppmerksomhetskrevende kjøring, ikke som et publiserbart innlegg;
- daglig Gemini-grense kan konfigureres og er 20 kall som standard.

### Tidsplan og redaksjonell kontroll

- idempotente mandags- og torsdagsspor gir maksimalt to automatiske utkast per ISO-uke;
- unike databaseindekser stopper samme jobb selv ved gjentatt cron-kall;
- separat publiseringsjobb behandler bare gjennomgåtte, planlagte og forfalte innlegg;
- administrator kan avvise, regenerere, redigere, godkjenne, planlegge og publisere;
- alle eksplisitte workflow-handlinger skrives til den uforanderlige auditloggen uten artikkel- eller personinnhold;
- adminoversikten viser AI-utkast og summerer SEO-feil i oppmerksomhetskøen.

### Lisensierte stockbilder

- når `PEXELS_API_KEY` er konfigurert, får nye AI-utkast automatisk et relevant liggende Pexels-bilde;
- Pexels-søket er begrenset til tak/hus, og nedlasting godtar bare HTTPS fra `images.pexels.com`, støttede bildeformater og maksimalt 12 MB;
- bilde-ID, søk, kildeside, fotograf, fotografside, lisens og hentetid lagres på medieobjektet;
- fotograf og Pexels vises som kreditering under bildet på den offentlige artikkelen;
- administrator kan skrive et eget engelsk bildesøk og bruke **Finn / bytt gratis bilde**, eller erstatte bildet med en vanlig egen opplasting i `Hero image`;
- feil i bildeberikelsen kan aldri slette eller blokkere et gyldig artikkelutkast, og ingen bildehandling publiserer artikkelen.

### Innholdsrapport

Når Search Console er konfigurert, kan administrator hente 90 dagers visninger, klikk, CTR og gjennomsnittsposisjon per publisert bloggside. Offisiell URL Inspection brukes for indekseringsvurdering, dekningsstatus og siste crawl. Uten integrasjonen vises en tydelig konfigurasjonsmelding; data blir ikke funnet på ved scraping.

Offisielt implementeringsgrunnlag:

- [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Search Console Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Search Console URL Inspection](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- [Pexels API](https://www.pexels.com/api/documentation/)
- [Pexels-lisens](https://www.pexels.com/license/)

## Sikker fallback

- uten Gemini opprettes fagtema og brief, men ingen kunstig fritekst;
- uten Search Console brukes godkjent manuell fagplan eller administratorimportert CSV;
- ingen AI-rute kan sette `_status=published`;
- alle risikofunksjoner er fortsatt slått av som standard med feature flags.

## Migrasjon

`20260823_160853_phase4_ai_content_engine` legger til redaksjonelle QA-felt, foreslåtte lenker og kontrollpunkter, søkeytelse, temafingerprint, idempotency og triggerkilde. Eksisterende temaer og kjøringer får sikre legacy-identifikatorer før `NOT NULL` og unike indekser aktiveres. Rollback konverterer avviste utkast til vanlige utkast før gammel enum gjenopprettes.

## Verifikasjon og Gate 4

| Kontroll | Resultat |
|---|---|
| TypeScript | Bestått |
| ESLint | Bestått uten feil eller advarsler |
| Full Vitest-regresjon | 46 filer, 133 tester bestått |
| Fase 4 migrasjon up/down i PGlite | Bestått, inkludert legacy-backfill og rejected rollback |
| To komplette strukturerte testutkast | Bestått AI QA |
| Dårlig/oppfunnet innhold | Blokkert |
| CSV og PII-negative tester | Bestått |
| Cron-autentisering og idempotency | Bestått |
| Produksjonskompilering | Bestått med PostgreSQL-adapter og forventet fallback fordi lokal testdatabase ikke kjører |
| Lokal SQLite admin-smoke | Miljøavvik: libsql publiserer ikke Windows ARM64-binær; gjentas i staging |

Gate 4 er bestått. Det lokale native SQLite-avviket påvirker ikke applikasjonskoden eller PostgreSQL-produksjon, men autentisert visuell adminflyt skal gjentas i staging før produksjonssetting.

## Produksjonsblokkere

- `GEMINI_API_KEY`, `PEXELS_API_KEY`, `CRON_SECRET`, feature flags og eventuelt Search Console servicekonto må legges i hostingens secret store;
- Search Console servicekonto må få lesetilgang til riktig `takfornyelse.as`-eiendom;
- ekte forfatter og faglig kontrollør må fastsettes før første publisering;
- staging må kjøre migrasjon, autentisert admin-smoke og to pilotutkast før flaggene aktiveres.
