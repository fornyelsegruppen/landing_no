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

## Ekstern staginggate – teknisk miljø opprettet

Den 24. august 2026 ble første isolerte Vercel Preview etablert uten endring av produksjonsgren, produksjonsdatabase eller levende domener:

- stabilt, Vercel-beskyttet QA-endepunkt: `https://takfornyelse-staging.vercel.app`;
- separat Neon-database `takfornyelse-staging`, Free-plan, Frankfurt (`fra1`), uten Neon Auth;
- databaseintegrasjonen er koblet bare til Vercel-miljøet `Preview`, ikke `Production` eller `Development`;
- separat, tilfeldig `PAYLOAD_SECRET` er lagret som sensitiv Preview-variabel;
- `NEXT_PUBLIC_SITE_URL` er satt til det stabile stagingendepunktet bare for Preview;
- alle syv risikofunksjoner er eksplisitt `false`, og `SMS_PROVIDER=disabled`;
- `RESEND_API_KEY` er ikke kopiert fra produksjon. Payload logger test-e-post internt i stedet for å sende til kunder;
- helt tom database ble kontrollert, bygget til gjeldende schema, registrert med 23 baselinemigrasjoner og seedet med deterministisk offentlig innhold;
- staging-migrasjonsstatus viser 23 av 23 gjeldende migrasjoner som anvendt;
- Vercel Preview-build med inspector-referanse `8ZRfUkgudrJHDw1dev9XDrocsV2W` ble `READY`: migrasjoner, TypeScript, produksjonskompilering og 59 statiske sider besto;
- `/no`, `/admin` og `/user/login` returnerer `200`; anonym tilgang til `/api/admin/platform-health` returnerer korrekt `401`;
- offentlig staging svarer med `X-Robots-Tag: noindex`, korrekt staging-canonical, HSTS, CSP-report-only, `X-Frame-Options: DENY` og `X-Content-Type-Options: nosniff`;
- første visuelle kontroll av norsk forside og første-admin-skjerm besto.

Staging avdekket og fikk rettet en reell Neon-kompatibilitetsfeil: den gamle strengbaserte fjerningen av `channel_binding=require` kunne også fjerne URL-ens `?`-skilletegn. Gjeldende `node-postgres` støtter parameteren, så database-URL-en beholdes nå intakt i runtime-, migrasjons- og seedbanene. 95 testfiler / 259 tester og ESLint besto etter rettingen.

Vercel Hobby tillater bare cronplaner som kjører høyst daglig. De planlagte fem- og trettiminuttersjobbene ble derfor ikke registrert i Preview; Preview-kilden ble distribuert uten cronaktivering mens alle automatiske funksjoner er avslått. Før produksjon må cron-kjøringen flyttes til godkjent kø/scheduler eller Vercel-planen endres. Ingen betalt plan ble valgt.

## Gjenstående eksterne porter

Følgende kan fortsatt ikke sannferdig godkjennes og blokkerer produksjon:

- produksjonssnapshot, Blob-inventar og dokumentert restore-øvelse er ikke utført;
- første staging-admin og staging-arbeider er ikke opprettet, så autentisert mobil QA på `/admin`, `/user` og sikre kundelenker er ikke signert;
- ekte testlevering for Resend, Search Console, lisensiert ortofoto og eventuelt SMS er ikke dokumentert;
- 20–30 ekte leadpilot og sammenligning mot fysisk kontrollmåling er ikke gjennomført;
- prisregler, kontrakt/angrerett, signaturbevis, databehandlere og meldingstekster mangler registrert eier-/juridisk godkjenning;
- produkteier har ikke gitt eksplisitt produksjons-go for noen feature.

Vercels prosjektoversikt viste dessuten `57,6 %` feilrate for det eksisterende produksjonsprosjektet i det viste seks-timersvinduet. Årsak og normal baseline må avklares i en personvernbevisst logggjennomgang før piloten starter; dette tallet er ikke brukt som bevis for en bestemt kodefeil.

Gate 11 er derfor fortsatt med hensikt lukket. Neste sikre handling er å opprette første staging-admin og staging-arbeider, gjennomføre autentisert desktop-/mobil-QA og deretter restore-øvelsen. Produksjonsbranch, produksjonsdatabase og levende feature-flagg er ikke endret.

Krav-for-krav-status er dokumentert i `docs/implementation/completion-audit-2026-08-23.md` slik at ingen lokal test kan forveksles med full produksjonsgodkjenning.
