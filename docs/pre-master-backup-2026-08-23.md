# Takfornyelse.as – backup- og gjenopprettingsmanifest før masterimplementering

**Dato:** 23. august 2026

**Kodebackup:** Fullført og verifisert

**Produksjonsdata:** Skal sikres separat før første produksjonsmigrasjon

**Formål:** Bevare den fungerende versjonen mens masterplanen utvikles isolert

## 1. Verifisert produksjonsgrunnlag

| Felt | Verdi |
|---|---|
| Produksjonsrepository | `darbasnorvegija4-eng/landing_no` |
| Produksjonsbranch | `main` |
| Produksjonscommit | `380f64d2d7092cfb0bdf7f681ad6afebe30030c1` |
| Commit | `Merge pull request #51 from fornyelsegruppen/codex/add-service-placeholder` |
| Vercel-miljø | `Production – landing-no` |
| GitHub deployment-ID | `6040588362` |
| Vercel-status | `success` |
| Deployment | `https://vercel.com/darbasnorvegija4-8212s-projects/landing-no/8MqTs2mWsijDYvi1AAWqz46VvDWh` |

Produksjonscommit og Vercel-deployment ble kontrollert mot GitHub Deployments API før backupen ble opprettet.

## 2. GitHub-kodebackup

Den eksakte produksjonscommiten er lagret i Fornyelsegruppens GitHub-repository på to uavhengige Git-referanser:

- branch: [`backup/live-before-master-2026-08-23`](https://github.com/fornyelsegruppen/landing_no/tree/backup/live-before-master-2026-08-23);
- annotert tag: [`backup-live-before-master-2026-08-23`](https://github.com/fornyelsegruppen/landing_no/tree/backup-live-before-master-2026-08-23).

Begge peker til:

```text
380f64d2d7092cfb0bdf7f681ad6afebe30030c1
```

Backup-branchen og taggen skal ikke flyttes, overskrives eller slettes under implementeringen.

## 3. Isolert utviklingsmiljø

| Felt | Verdi |
|---|---|
| Lokalt katalog | `C:/Dev/takfornyelse-master-implementation` |
| Utviklingsbranch | `codex/master-platform-implementation` |
| Skrivbar GitHub remote | `fornyelsegruppen/landing_no` som `origin` |
| Produksjonsremote | `darbasnorvegija4-eng/landing_no` som `upstream` |
| Basis | Produksjonscommit `380f64d` |
| Første tillegg | Kun godkjent roadmap-dokumentasjon |

All masterimplementering skal utføres i dette kataloget og på denne branchen. Det gamle kataloget skal ikke brukes som aktiv implementeringsflate.

## 4. Regler som beskytter produksjonen

1. Ingen utviklingscommit pushes direkte til `upstream/main`.
2. Alle kodeendringer pushes til `origin/codex/master-platform-implementation` eller en underbranch.
3. Produksjonsmiljøvariabler kopieres ikke til Git eller dokumentasjon.
4. Nye databasemigrasjoner er additive frem til separat backup og restore-test er godkjent.
5. Risikofunksjoner deployes bak feature flags og er avslått som standard.
6. Full løsning testes lokalt og deretter i separat Vercel preview/staging.
7. Produksjon oppdateres først etter Gate 10 og stagingpilot i masterplanen.
8. Før produksjonsmerge tas ny databasebackup og gjeldende produksjonscommit registreres på nytt.
9. Produksjonsdeploy skjer med godkjent pull request; `main` skal ikke force-pushes.

## 5. Kodegjenoppretting

### Raskeste vei ved frontend-/kodefeil

1. Åpne den verifiserte Vercel-deploymenten i tabellen over.
2. Promoter eller redeploy den kjente fungerende deploymenten etter kontroll i Vercel.
3. Kontroller `takfornyelse.as`, kontaktskjema, `/admin` og leadlevering.

### Git-basert vei

1. Opprett en recovery-branch fra `backup-live-before-master-2026-08-23`.
2. Sammenlign recovery-branchen mot gjeldende `upstream/main`.
3. Opprett og godkjenn pull request tilbake til produksjonsrepository.
4. La normal Vercel-deploy kjøre og utfør smoke-test.

Ikke force-push eller reset produksjonsbranch. Backupreferansen brukes som kilde for en sporbar recovery-commit eller kontrollert redeploy.

## 6. Det GitHub-backupen ikke inneholder

GitHub skal ikke inneholde:

- PostgreSQL-produksjonsdatabase eller kundeopplysninger;
- Vercel Blob-kundebilder eller signerte dokumenter;
- Vercel-miljøvariabelverdier;
- API-nøkler, tokens, cookies eller signeringshemmeligheter;
- uanonymiserte databaseuttrekk.

Disse delene må sikres i leverandørens godkjente backup-/secret-løsning. Å legge dem i et privat GitHub-repository er heller ikke godkjent backupmetode.

## 7. Obligatorisk databackup før produksjonsmigrasjoner

Før en migrasjon kjøres mot produksjonsdatabasen skal følgende være dokumentert:

- databaseleverandør og aktivt prosjekt/branch;
- tidspunkt for snapshot eller point-in-time-recovery-punkt;
- retentionperiode;
- kryptert eksport dersom leverandørbackup ikke er tilstrekkelig;
- restore-test til isolert stagingdatabase;
- kontroll av antall brukere, leads, posts og mediareferanser etter restore;
- navngitt ansvarlig for rollback;
- estimert gjenopprettingstid.

Før endringer i mediamodellen skal Vercel Blob-inventar og retention kontrolleres. Miljøvariabelnavn kan dokumenteres, men verdiene skal forbli i Vercel/secret manager.

## 8. Lokal baseline etter ren GitHub-klone

Kjøring i `C:/Dev/takfornyelse-master-implementation`:

| Kontroll | Resultat |
|---|---|
| `npm ci --legacy-peer-deps` | Bestått, 825 pakker installert |
| `npm run lint` | Bestått |
| `npm run typecheck` | Bestått |
| `npm run test` | Bestått, 10 testfiler og 37 tester |
| `npm run build` | Kompilering bestått; lokal page-data-fase blokkert av manglende `@libsql/win32-arm64-msvc` |
| Vercel-produksjonsbuild | Bestått for commit `380f64d` |

NPM rapporterte 16 kjente avhengighetsfunn: 6 moderate og 10 high. Det ble bevisst ikke kjørt `npm audit fix --force`, fordi en ukontrollert major-oppgradering kan introdusere regresjon. Funnene håndteres kontrollert i hardeningarbeidet.

Den lokale buildfeilen er registrert som et eksisterende Windows ARM64-/libSQL-miljøproblem, ikke som en feil introdusert av masterimplementeringen. Den skal enten løses i utviklingsmiljøet eller omgås med en produksjonslik PostgreSQL-/Linux-test før Gate 1 lukkes.

## 9. Neste godkjente steg

Fortsett med fase 0 i [samlet implementeringsplan](./full-platform-implementation-master-plan.md): inventar, beslutningsregister, produksjonsdatabackupstrategi og konkrete oppgaver for plattformfundamentet.
