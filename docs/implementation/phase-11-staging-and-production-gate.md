# Fase 11 – stagingpilot og produksjonsgate

Dato: 24. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat så langt

Kodebasen er teknisk klargjort for intern staging og kontrollert feature-for-feature-aktivering. En sikker release-gate hindrer at et feature-flagg alene kan gjøre en funksjon produksjonsklar: integrasjoner, felles stagingbevis og funksjonens egne godkjenninger må også være komplette. Ingen godkjenning eller pilotresultat er fabrikkert.

## Leveranser

- anonymisert, databaseuavhengig fullreisetest dekker bloggartikkel, attribuert lead, kontaktvalidering, takmåling, deterministisk pris, tilbud, kontrakt, stedskontroll og dokumentert oppdrag;
- adminoversikten viser om produksjonsgaten er åpen eller lukket;
- admin-API-et returnerer sikker go/no-go-status uten secret- eller dokumentverdier;
- alle syv risikofunksjoner er `disabled` som standard;
- en aktivert funksjon blir `no_go` hvis integrasjon eller obligatorisk bevis mangler;
- komplett testkonfigurasjon blir `go` og er dekket av enhetstest;
- stagingpilot, trinnvis aktivering, overvåking og rollback er dokumentert i `docs/operations/staging-pilot-runbook.md`;
- alle nødvendige godkjenningsreferanser er dokumentert i `.env.example` og `docs/operations/release-gate-register.md`.

## Lokal verifikasjon

| Kontroll | Resultat |
|---|---|
| Anonymisert full plattformreise | 1 test bestått |
| Release-gate, feature readiness og sikker helsestatus | 3 filer, 11 tester bestått |
| Alle ikke-migrasjonstester | 83 filer, 235 tester bestått |
| Alle migrasjonstester | 12 filer, 24 tester bestått enkeltvis |
| Samlet testomfang | 95 filer, 259 tester bestått |
| TypeScript | Bestått |
| ESLint | Bestått uten feil/advarsler |
| Produksjonsbuild | Bestått; 59 statiske sider og alle dynamiske ruter kompilert |
| Standardtilstand | 7 av 7 risikofunksjoner avslått |
| Hemmelighetsvern | Gate-output inneholder bare nøkkelnavn, aldri verdier |

## GitHub-kvalitetsgate

[Quality gate 32669148448](https://github.com/fornyelsegruppen/landing_no/actions/runs/32669148448) er grønn mot commit `3b852b3`:

- Ubuntu og Node 22;
- ekte PostgreSQL 16-container med eksplisitt `sslmode=disable` kun for lokal CI;
- produksjonsavhengighetsaudit på high-nivå, ESLint og TypeScript bestått;
- 83 filer / 235 enhets- og API-tester bestått;
- 12 filer / 24 migrasjons- og rollbacktester bestått;
- en helt tom PostgreSQL-database ble sikkerhetskontrollert, bygget til gjeldende schema og registrert med 23 baselinemigrasjoner;
- deterministisk offentlig testinnhold ble seedet uten produksjonsdata;
- produksjonsbuild med 59 statiske sider bestått;
- 7 av 7 Chromium-smoketester mot det ferdige produksjonsbygget bestått.

Dette beviser den tekniske tom-databasebanen. Det erstatter ikke restore fra en anonymisert produksjonslik kopi eller autentisert manuell staging-QA.

## Ekstern staginggate – ikke utført

Følgende kan ikke sannferdig godkjennes i den lokale kodefasen og blokkerer produksjon:

- Vercel-prosjektet `landing-no` er bekreftet koblet til `darbasnorvegija4-eng/landing_no`, med `main` som produksjonsgren og automatisk previewstøtte;
- `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY` og e-postadressene er bare konfigurert for produksjon. Preview har derfor ikke separat database, autentiseringssecret eller sikker testlevering;
- en separat PostgreSQL-/Neon-stagingdatabase og egne preview-secrets er ikke opprettet eller tilkoblet;
- produksjonssnapshot, Blob-inventar og restore-øvelse er ikke utført;
- autentisert visuell QA på `/admin`, `/user`, mobil og sikre kundelenker er ikke signert;
- ekte testlevering for Resend, Search Console, lisensiert ortofoto og eventuelt SMS er ikke dokumentert;
- 20–30 ekte leadpilot og sammenligning mot fysisk kontrollmåling er ikke gjennomført;
- prisregler, kontrakt/angrerett, signaturbevis, databehandlere og meldingstekster mangler registrert eier-/juridisk godkjenning;
- produkteier har ikke gitt eksplisitt produksjons-go for noen feature.

Vercels prosjektoversikt viste dessuten `57,6 %` feilrate for det eksisterende produksjonsprosjektet i det viste seks-timersvinduet. Årsak og normal baseline må avklares i en personvernbevisst logggjennomgang før piloten starter; dette tallet er ikke brukt som bevis for en bestemt kodefeil.

Gate 11 er derfor med hensikt lukket. Neste sikre handling er å opprette separat staging og gjennomføre runbooken. Produksjonsbranch, produksjonsdatabase og levende feature-flagg er ikke endret.

Krav-for-krav-status er dokumentert i `docs/implementation/completion-audit-2026-08-23.md` slik at ingen lokal test kan forveksles med full produksjonsgodkjenning.
