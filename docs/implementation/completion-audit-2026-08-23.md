# Fullføringsaudit mot Definition of Done

Dato: 24. august 2026

> **Revidert etter full stagingreise:** Denne audit-tabellen vurderte hovedsakelig kode og automatiske tester. Den skal leses som audit av teknisk fundament, ikke som bevis på ferdig operativ løsning. Nye krav og observerte gap er styrende dokumentert i [fase R0–R10](../custom-admin-and-automation-execution-plan.md).

Teknisk gate-commit: `3b852b3`

PR: `darbasnorvegija4-eng/landing_no#52`

Denne kontrollen bruker kapittel 4 i `full-platform-implementation-master-plan.md` som fasit. `Implementert` betyr at kode og målrettet automatisk test finnes. Det betyr ikke at ekstern staging eller produksjon er godkjent.

| Krav | Kode-/testbevis | Status | Manglende bevis |
|---|---|---|---|
| Admin styrer blogg, leads, tilbud, kontrakter, oppdrag og ansatte | Payload collections, adminhandlinger og dashboard; fase 2–10-rapporter | Implementert | Autentisert visuell stagingreise |
| Worker kan bare lese/endre egne oppdrag | `src/lib/work-orders/access.test.ts`, worker-API og `/user` | Implementert | Mobiltest med to ekte stagingbrukere |
| To norske AI-utkast per uke uten auto-publisering | `vercel.json` mandag/torsdag, `schedule.test.ts`, publiseringspolicy | Implementert | Ekte 2-utkast-pilot med Gemini og reviewer |
| Artikkel kan kontrolleres, forhåndsvises, planlegges, publiseres og måles | bloggflow-, preview-, schedule-, attribution- og audit-tester | Implementert | Stagingpreview, Search Console og sitemap-smoke |
| Lead mottas sikkert, vises og får bekreftelse | lead-API-, validerings-, rate-limit-, media- og meldingspolicytester | Implementert | Ekte staginginnsending og test-e-post |
| AI oppsummerer/lager svarutkast, men sender ikke tilbud | `lead-ai.test.ts`, meldingspolicy og admin-godkjenning | Implementert | Gemini stagingkall med anonym testlead |
| Takestimat har polygon, areal, vinkel, confidence og kilde | målingsmodell og geometry/policy/proposal-tester | Implementert | Lisensiert ortofoto og tre kontrollmålte tak |
| Areal og pris er deterministisk fra låste input | geometry-, slope-, pricing- og versioning-tester | Bevist automatisk | Produksjonsgodkjent prisbok |
| Admin korrigerer måling, velger regel og godkjenner tilbud | admin målings-/tilbudshandlinger og API-tester | Implementert | Autentisert staging-smoke |
| Kunde leser/godtar/avslår og signerer riktig versjon på mobil | kunde-API, token-, dokument-, PDF- og workflowtester | Implementert | Juridisk godkjenning og mobil stagingtest |
| Signert kontrakt låses, spores og lastes ned | dokumenthash, signaturbevis, audit og PDF-tester | Implementert | Juridisk godkjent bevismetode og stagingnedlasting |
| Signert oppdrag kan tildeles worker | work-order create/access/workflow-tester | Implementert | Stagingbrukere og tildelingssmoke |
| Førkontroll kreves før start | precheck- og workflowtester | Bevist automatisk | Komplett mobil stagingreise |
| Avvik over ramme blokkerer og krever skriftlig endring | endringsavtale engine/workflow/document-tester | Bevist automatisk | Kundeaksept i staging og juridisk kontroll |
| Påminnelser/ferdigmelding er idempotente og feil synlige | communications-, jobs-, idempotency- og message-engine-tester | Bevist automatisk | Ekte Resend/testtidssone og leveringsfeil i staging |
| Tilgang, personvern, audit, backup og restore er testet | tilgang/token/media/audit-tester og driftsrunbooks | Delvis | Reell backup, Blob-inventar og isolert restore mangler |
| Migrasjoner kjøres mot produksjonslik kopi | 12 migrasjonsfiler / 24 PGlite-tester, samt tom PostgreSQL 16-bootstrap, 23 baselineregistreringer og produksjonsbuild i [GitHub gate 32669148448](https://github.com/fornyelsegruppen/landing_no/actions/runs/32669148448) | Delvis | Anonymisert produksjonslik snapshot og isolert restore mangler |
| Stagingpilot er godkjent før produksjon | release-gate og staging-runbook | Ikke oppfylt | Preview DB/secrets, manuell QA, 20–30 leads og eiergodkjenning |
| Tester, lint, typecheck, build og E2E består | [GitHub gate 32669148448](https://github.com/fornyelsegruppen/landing_no/actions/runs/32669148448): 95 filer/259 tester, audit, lint, typecheck, PostgreSQL-build og 7/7 offentlig Chromium-E2E bestått | Delvis | Autentisert admin/worker/kundelenke-E2E på separat staging mangler |

## Operativt tillegg etter stagingtesten

Følgende krav ble gjenåpnet selv om underliggende collections og tester finnes:

| Krav | Observert stagingstatus | Ny gate |
|---|---|---|
| Enkel daglig admin | Payload virker, men arbeidsreisen er for oppstykket | R1–R2 |
| Umiddelbar profilert kundekvittering | Mottakskvitteringen er ikke ferdig branded HTML | R3 |
| Nær-sanntids AI og jobbkjøring | Operativ cron kjører for sjelden for kundereisen | R3–R4 |
| Automatisk takmåleutkast | Administrator må fortsatt starte og velge målingen manuelt | R4 |
| Kundespørsmål | Lagres, men mangler komplett varsel-/svarutkastflyt | R5 |
| Endelig avtale | Kundesignatur mangler separat selskapsaksept/motsignering | R6 |
| Dokument og faktura | Mangler samlet register og kontrollert fakturastatus | R8 |
| Blogg i enkel admin | Virker i Payload, men ikke i custom operativ portal | R9 |
| Produksjonsbevis | Ekte e-post, restore, juridisk kontroll og pilot mangler | R10 |

## Opprinnelig konklusjon for teknisk fundament

Alle planlagte domenefunksjoner er implementert bak avslåtte feature-flagg og automatiske kontroller er grønne. Hele Definition of Done er likevel ikke oppfylt før de fem eksterne bevisgruppene under foreligger:

1. separat Preview/PostgreSQL-konfigurasjon med egne secrets;
2. restore fra anonymisert produksjonslik kopi med rad- og mediekontroll;
3. autentisert, mobil og negativ staging-E2E;
4. leverandør-, pris- og juridisk godkjenning;
5. begrenset ekte pilot og eksplisitt produkteier-go.

Produksjonsmerge og featureaktivering skal forbli blokkert til alle R0–R10-gater og alle `Delvis`/`Ikke oppfylt`-rader har direkte bevis.
