# Fase R0 – operativ baseline, rollback og kontrakt

**Status:** Fullført for isolert stagingutvikling  
**Dato:** 24. august 2026  
**Branch:** `codex/master-platform-implementation`  
**Produksjon:** Ikke endret

## 1. Resultat

R0 har etablert et reproduserbart og identifiserbart startpunkt for custom admin-arbeidet. Dokumentasjonen er korrigert etter den reelle stagingreisen, to eksisterende baselinefeil er rettet, hele PostgreSQL-kvalitetsgaten er grønn, og commitet er lagret på GitHub med en eksplisitt rollbacktagg.

R0 godkjenner bare videre utvikling i isolert staging. Det er ikke en produksjonsgodkjenning og innebærer ikke at produksjonsdatabase, Blob-lager, feature-flagg eller levende domener er endret.

## 2. Styrende beslutninger

| Tema | Beslutning |
|---|---|
| Operativ admin | Custom Takfornyelse-grensesnitt i samme applikasjon |
| Utviklingsrute | `/admin-v2` i staging |
| Endelig rute | `/admin` etter R10-cutover |
| Teknisk backoffice | Payload flyttes til `/system-admin` først ved cutover |
| Ansattportal | Eksisterende `/user` videreføres |
| Data og auth | Samme Payload/PostgreSQL og samme sessionsystem |
| Roller | Bare `admin` og `worker` |
| AI | Forbereder og formulerer, men bestemmer ikke pris, juss, dato eller HMS |
| Økonomi | Regelmotor beregner; administrator godkjenner |
| Faktura | Dokument-/fakturautkast og status inngår; offisiell bokføring/utsending krever senere godkjent prosess |
| Produksjon | Urørt til komplett R10-gate og eksplisitt produkteiergodkjenning |

## 3. Rollbackbevis

| Bevis | Verdi |
|---|---|
| Verifisert commit | `2e2b8690f83d906d22d6e0a97288e9e0e43ff9a6` |
| GitHub-branch | `fornyelsegruppen/landing_no:codex/master-platform-implementation` |
| Rollbacktagg | `rollback/pre-custom-admin-r1-2026-08-24` |
| Kvalitetsgate | [GitHub Actions 32759538583](https://github.com/fornyelsegruppen/landing_no/actions/runs/32759538583) |
| Pull request | [darbasnorvegija4-eng/landing_no#52](https://github.com/darbasnorvegija4-eng/landing_no/pull/52) |
| Restoreprosedyre | [Backup- og restore-runbook](../operations/backup-restore-runbook.md) |

Rollback til dette punktet betyr applikasjonskode og ruter. Produksjonsdatabase-/Blob-restore krever eget ferskt snapshot, inventar, isolert restorebevis og eksplisitt eiergodkjenning før R10. Ingen kundedata eller secrets er lagret i Git.

## 4. Baseline og feil som ble funnet

### 4.1 Lokal kontroll

| Kontroll | Resultat |
|---|---|
| `npm run lint` | Bestått uten advarsler etter retting |
| `npx tsc --noEmit --incremental false` | Bestått |
| `npm test` | 105 testfiler / 298 tester bestått |
| Lokal `npm run build` | Kompilering besto, men sideinnsamling er blokkert av manglende Windows ARM64 `libsql`-binær |

Den lokale ARM64-feilen er miljøspesifikk. Den autoritative buildkontrollen kjøres derfor mot PostgreSQL 16 på Linux i GitHub Actions.

### 4.2 Rettet baselinefeil 1 – private Blob-metadata

PostgreSQL production build avdekket at et inline metadataobjekt med `focalX`/`focalY` ble avvist av Payloads innsnevrede Next-buildtype selv om feltene finnes og brukes ved runtime. Metadataen ble flyttet til en navngitt, testet verdi uten å endre lagret innhold eller Blob-opprydding.

Relatert commit: `2653413` (`fix: restore PostgreSQL production build`).

### 4.3 Rettet baselinefeil 2 – framebeskyttelse

Chromium-smoken avdekket at konfigurasjonen returnerte `X-Frame-Options: SAMEORIGIN`, mens den dokumenterte sikkerhetskontrakten og testen krever `DENY`. Den strenge verdien ble gjenopprettet.

Relatert commit: `2e2b869` (`fix: restore strict frame protection`).

## 5. Autoritativ PostgreSQL-kvalitetsgate

[Quality gate 32759538583](https://github.com/fornyelsegruppen/landing_no/actions/runs/32759538583) besto mot rollbackcommit:

- produksjonsavhengighetsaudit på high-nivå;
- ESLint uten advarsler;
- TypeScript;
- 93 unit-/API-testfiler med 274 tester;
- 12 migrasjons-/rollbackfiler med 24 tester;
- bootstrap av tom PostgreSQL 16-database;
- deterministisk smoke-seeding;
- production build mot PostgreSQL;
- 7 av 7 offentlige Chromium-smoketester.

## 6. Staging-rutekontrakt før R1

En read-only kontroll med eksisterende autentisert Preview-session ga følgende baseline:

| Rute | Observert før R1 | Forventet etter relevant fase |
|---|---|---|
| `/admin` | Payload-dashboard virker | Forblir Payload gjennom R1–R9; custom etter R10 |
| `/admin-v2` | Ikke implementert; gir nå feilside | Custom admin-skall i R1 |
| `/system-admin` | Ikke implementert; offentlig 404 | Payload-backoffice etter R10 |
| `/user` | Mobilportal virker og panelspråk kan velges | Videreføres og integreres i R7 |
| `/user/login` | Aktiv session sendes korrekt til `/user` | Uendret |
| Offentlig `/no` | Laster korrekt i Preview | Skal ikke regresjonspåvirkes |

Direkte anonyme shell-kall mot Preview blir avvist av Vercel Authentication og sendt til Vercel SSO. Dette er forventet for det beskyttede QA-miljøet. Negativ applikasjonstilgang er i tillegg dekket av automatiske access-tester; R1 skal legge til egne custom-admin 401/403/E2E-tester.

## 7. Beslutningseiere og produksjonsblokkere

| Beslutning | Eierrolle | Status |
|---|---|---|
| Prisregler, minimum, toleranse og makspris | Daglig leder / økonomiansvarlig | Må godkjennes før ekte tilbud |
| Kontrakt, angrerett, tidlig oppstart og selskapsaksept | Daglig leder + norsk juridisk rådgiver | Må godkjennes før ekte kontrakter |
| Personvern og Gemini-/e-postdatabehandlere | Behandlingsansvarlig | Må godkjennes før kundedata behandles i produksjon |
| HMS- og førkontroll | Faglig/HMS-ansvarlig | Må godkjennes før workerpilot |
| Offisiell faktura og regnskapskobling | Regnskapsfører / økonomiansvarlig | Ikke del av første custom-adminleveranse uten godkjenning |
| Produksjonssnapshot, Blob-inventar og restore | Produkteier + teknisk ansvarlig | Obligatorisk rett før R10-cutover |

Alle manglende godkjenninger er eksplisitte produksjonsblokkere og stopper ikke bygging av en avslått, isolert stagingfunksjon.

## 8. Gate R0

**BESTÅTT FOR R1-STAGINGUTVIKLING.**

- produksjon er urørt;
- styrende dokumentasjon og routekontrakt er oppdatert;
- rollbackcommit og GitHub-tagg finnes;
- rollbackcommit har grønn PostgreSQL build- og testgate;
- restoreprosedyren er dokumentert;
- faktiske produksjonssnapshot/Blob/restore-kontroller er flyttet til riktig tidspunkt før R10 og er fortsatt åpne;
- juridiske, pris-, personvern-, HMS- og regnskapsbeslutninger har eksplisitt eierrolle og produksjonsblokkering.

Neste fase er **R1 – custom admin-skall på `/admin-v2`**. Eksisterende Payload `/admin`, `/user`, stagingdatabase og produksjon skal ikke erstattes eller migreres i R1.
