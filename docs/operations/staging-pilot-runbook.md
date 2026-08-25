# Stagingpilot og kontrollert aktivering

## Stoppregel

Ingen risikofunksjon aktiveres i produksjon før dens rad i go/no-go-registeret har komplette bevis, alle integrasjoner viser `ready`, backup/restore er bestått og produkteier har gitt eksplisitt godkjenning. Bevisverdier er interne saks-/dokument-ID-er; aldri hemmeligheter eller kundedata.

## A. Intern staging

1. Bruk eksisterende Vercel previewmekanisme, men opprett separat PostgreSQL-/Neon-database og egne Preview-secrets. Produksjonens `DATABASE_URL` eller `PAYLOAD_SECRET` skal aldri gjenbrukes.
2. Bruk staging-spesifikke secrets. Hold e-post/SMS i test/log-modus og annonserings-ID-er tomme.
3. Restore anonymisert produksjonslik kopi etter `backup-restore-runbook.md`.
4. For en helt tom stagingdatabase: kjør `npm run db:bootstrap` én gang. Kommandoen nekter å kjøre dersom databasen allerede inneholder tabeller, oppretter gjeldende schema og registrerer alle eksisterende migrasjoner som baseline. For en restore: aldri kjør bootstrap eller schema push. Kjør deretter migrasjoner, `npm run typecheck`, `npm run lint`, alle tester og `npm run build` på stagingcommit.
5. Opprett separate testkontoer for administrator og medarbeider.
6. Kjør én komplett anonymisert reise: bloggutkast → faglig godkjenning → publisering → attribuert henvendelse → måling → låst pris → godkjent tilbud → signert kontrakt → tildelt oppdrag → førkontroll → arbeid → etterdokumentasjon.
7. Kjør negative tester for feil rolle, annen medarbeiders oppdrag, utløpt/tilbakekalt token og privat media.
8. Kjør den manuelle sjekklisten i `phase10-manual-qa-checklist.md` og registrer avvik.

## B. Begrenset ekte pilot

1. Deploy koden med alle nye feature-flagg avslått.
2. Aktiver bare én funksjonsgruppe etter dokumentert go/no-go.
3. Kjør 20–30 ekte henvendelser gjennom innboksen med admin-godkjenning på alle meldinger og beløp.
4. Sammenlign AI-/kartestimat mot fysisk kontrollmåling på minst tre representative tak. Registrer absolutt og prosentvis avvik.
5. Mål tid til første svar, tid til tilbud, manuelle korrigeringer, leveringsfeil, kundespørsmål og kostnad per integrasjon.
6. Begrens bloggpiloten til maksimalt to utkast per uke. Ingen AI-publisering.
7. Ved personvern-, tilgangs-, pris- eller meldingsfeil: slå av berørt flagg, behold auditbevis og følg incident-runbook.

## C. Produksjonsgodkjenning

1. Godkjenn prisbok, mva., toleranse, maksimum, confidence-regler og manuell fallback.
2. Godkjenn kontrakt, angrerett, signeringsbevis, personvern, meldingsrytme og databehandlere.
3. Fyll dokumentreferansene som er listet i `.env.example`.
4. Kontroller `/api/admin/platform-health`: bare ønskede funksjoner kan ha `go`; øvrige skal være `disabled`.
5. Ta ferskt snapshot og Blob-inventar, registrer radantall og bekreft fungerende restore.
6. Aktiver ett flagg om gangen, ta smoke-test og overvåk køer/feil før neste flagg.
7. Overvåk intensivt i minst én uke og behold forrige deploy som umiddelbar applikasjonsrollback.

## Bevismal

| Felt | Verdi |
|---|---|
| Staging-URL | `https://takfornyelse-staging.vercel.app` → Preview `landing-qso18lkhl-darbasnorvegija4-8212s-projects.vercel.app` |
| Commit | `df03dbd`; quality run `32903823308` bestått |
| Vercel-prosjekt | `darbasnorvegija4-8212s-projects/landing-no` bekreftet; preview støttes |
| Preview database/secrets | Separat Preview-database, Payload-secret, Resend, Gemini, Upstash, Turnstile og privat Blob er bekreftet; Production-secrets gjenbrukes ikke |
| Stagingdatabase/snapshot | Separat Preview-database finnes; produksjonssnapshot er ikke opprettet |
| Restore-test | Syntetisk PostgreSQL dump/restore bestått i run `32903823308`; produksjonssnapshot-restore gjenstår |
| Automatisk QA | Lint, TypeScript, 463 unit/API, 31 migrasjoner, build, 11 E2E og restore bestått i run `32903823308` |
| Manuell QA | Ikke signert |
| Leadpilot 20–30 | Ikke startet |
| Takmåling mot fasit | Ikke startet |
| Juridisk godkjenning | Ikke registrert |
| Produksjonseier | Ikke godkjent |
