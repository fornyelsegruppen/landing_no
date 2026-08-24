# Backup- og restore-runbook

## Formål og stoppregel

Ingen produksjonsmigrasjon eller aktivering av masterplattformens feature-flagg skal skje før en fersk databasebackup og et separat medieinventar finnes, og restore er bevist i isolert staging. Secrets, kundedata og eksportfiler skal aldri legges i Git eller i saksbeskrivelser.

## Før hver produksjonssetting

1. registrer produksjonscommit, migrasjonsstatus og tidspunkt i deploysaken;
2. opprett leverandørens konsistente PostgreSQL-snapshot/Neon-branch fra produksjon;
3. eksporter et privat Vercel Blob-inventar med fil-ID/path, størrelse og tidspunkt; ikke last kundebilder inn i repoet;
4. dokumenter antall `users`, `leads`, `posts`, `messages`, `quotes`, `contracts`, `work_orders`, `private_media` og `payload_migrations`;
5. bekreft at backupens tilgang er begrenset og at slettedato/eier er registrert;
6. behold Git-backuptaggen og forrige deploy som applikasjonsrollback.

## Restore-test i isolert staging

1. opprett en tom, tilgangsbegrenset stagingdatabase;
2. restore siste snapshot til denne databasen etter leverandørens dokumenterte prosedyre;
3. bruk egne staging-secrets og deaktivert e-post/SMS/annonsering;
4. kjør `npm run db:migrate:status`, deretter pending migrasjoner med `npm run db:migrate`;
5. sammenlign radantallene over og kontroller relasjoner for signert kontrakt → arbeidsordre → privat media;
6. åpne offentlig side, `/admin`, `/user` og sikre testkundelenker med anonymiserte scenarier;
7. les minst én offentlig fil og én autorisert privat fil, og bekreft at direkte uautorisert tilgang avvises;
8. loggfør start/slutt, resultat, avvik og ansvarlig. Slett stagingkopien etter avtalt testperiode.

Restore er ikke bestått hvis bare dumpen finnes. Applikasjonen må starte, migrasjonene må bestå, radantall/relasjoner må stemme og privat media må være lesbart via riktig autorisasjon.

## Tilbakeføring

- før featureflagg aktiveres: slå dem av og rull tilbake til forrige verifiserte applikasjonsdeploy;
- ved additiv migrasjon: behold nye nullable tabeller/felter, slå av funksjonen og rett fremover;
- ved datakorrupsjon eller destruktiv migrasjon: stans skriving, ta nytt forensisk snapshot og restore siste godkjente backup til ny database;
- bytt aldri produksjonsdatabase til en restore uten eksplisitt eiergodkjenning og dokumentert differansekontroll.

## Bevis som skal fylles i fase 11

| Kontroll | Verdi |
|---|---|
| Verifisert applikasjonsrollback | Git-tag `rollback/pre-custom-admin-r1-2026-08-24` → `2e2b8690f83d906d22d6e0a97288e9e0e43ff9a6` |
| PostgreSQL-/buildbevis for rollbackcommit | GitHub Quality gate `32759538583`, bestått 24. august 2026 |
| Snapshot-ID og tidspunkt | Ikke utført ennå |
| Blob-inventar | Ikke utført ennå |
| Stagingdatabase | Separat Preview-database finnes; produksjonslik restore er ikke utført ennå |
| Radantall før/etter | Ikke kontrollert ennå |
| Restore-smoke | Ikke kjørt ennå |
| Godkjent av | Ikke godkjent ennå |

Applikasjonsrollbacket er tilstrekkelig for å starte isolert R1-utvikling. Det erstatter ikke produksjonssnapshot, Blob-inventar eller restore-øvelse. Disse tre kontrollene er obligatoriske rett før R10-cutover og skal ikke gjennomføres ved å endre eller eksportere levende produksjonsdata uten eksplisitt eiergodkjenning.
