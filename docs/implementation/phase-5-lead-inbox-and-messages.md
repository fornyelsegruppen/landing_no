# Fase 5 – henvendelser, innboks og kontrollerte svarutkast

Dato: 23. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat

Eksisterende henvendelsesskjema er koblet til en trygg arbeidskø uten å gjøre lagring avhengig av e-post eller AI. Kunden får en forhåndsgodkjent mottaksbekreftelse når e-post finnes, administratoren ser neste handling og frist, og Gemini kan lage en strukturert intern oppsummering og et norsk svarutkast. AI-utkast kan ikke sendes før administratoren eksplisitt godkjenner det.

## Leveranser

### Henvendelsesinnboks

- `leads` har utvidet statusflyt, ansvarlig administrator, neste handling, frist, siste kontakt, lukket dato og kontrollert kvalifiseringsresultat;
- nye henvendelser får en konkret kontrollfrist uten å endre dagens offentlige validering, frivillige adresse, bildeopplasting, samtykke, rate limit eller attribusjon;
- lead-detaljen viser kundeopplysninger, bilder, annonsekilde, meldingshistorikk og handlingsknapper på samme side;
- adminoversikten viser nye henvendelser, svarutkast og meldings-/jobbfeil.

### Meldinger og outbox

- ny `messages`-samling støtter `draft`, `approved`, `queued`, `sent`, `delivered`, `failed`, `attention` og `cancelled`;
- mottaksbekreftelsen er en fast norsk/engelsk transaksjonsmal uten AI-avhengighet;
- hver mottaksbekreftelse og levering har unikt idempotency-key;
- Resend bruker leverandørens idempotency-key slik at samtidige retry-kall ikke lager dobbeltutsending;
- leveringsjobber inneholder bare `messageId`, aldri navn, e-post, adresse eller meldingstekst;
- midlertidig feil gir kontrollert retry med grense; uttømte forsøk havner i `attention` og kan startes på nytt fra admin;
- uten e-postleverandør beholdes meldingen i kø med synlig `configuration_required`, mens henvendelsen allerede er lagret;
- meldingsstatus, godkjenner, leverandør og feilfelter er systemstyrte og kan ikke omgås gjennom vanlig Payload-redigering.

### AI-kvalifisering og svarutkast

- Gemini mottar ikke kundens navn, telefon, e-post eller full adresse;
- postnummer reduseres til region, og fritekst renses for kontaktdata, adresse og vanlige navnefraser;
- strukturert output inneholder oppsummering, tjenestekategori, mangelliste, risikoflagg, neste handling, emne og svarutkast;
- output valideres med Zod før lagring;
- AI kan ikke endre kundens valgte tjeneste, oppgi pris, garanti eller lovet oppstartsdato;
- AI-feil påvirker ikke lagret henvendelse og vises i oppmerksomhetskøen;
- felles daglig og månedlig Gemini-grense teller både blogg og henvendelser.

### Administratorhandlinger

- `Lag AI-svarutkast`;
- `Be om informasjon` med trygg, redigerbar mal;
- `Godkjenn og send`;
- `Prøv sending igjen`;
- `Start måling`;
- `Lukk`.

Godkjenning og utsending registreres i auditloggen med aktør, lead-ID, correlation-ID og feltnavn, men uten meldingsinnhold eller kontaktdata.

### Personvern og sletting

Personvernsiden forklarer AI-assistert behandling, dataminimering og obligatorisk menneskelig kontroll. Produksjonsbruk krever databehandleravtale. Når et lead slettes gjennom Payload, fjernes tilhørende meldinger før leadet; database-relasjonen tåler også direkte sletting uten å blokkere retention-jobben.

## Migrasjon

`20260823_163755_phase5_lead_inbox_messages`:

- oppretter `messages` med unike idempotency-indekser og leveringstilstand;
- utvider leadstatus og arbeidskøfelt;
- mapper nye statuser tilbake til gyldige legacy-statuser ved rollback;
- dropper låsedokument-relasjonen i riktig rekkefølge før tabellen;
- er testet både `up` og `down` i ekte in-process PostgreSQL via PGlite.

## Verifikasjon og Gate 5

| Kontroll | Resultat |
|---|---|
| Full Vitest-regresjon | 52 filer, 149 tester bestått |
| TypeScript | Bestått |
| ESLint | Bestått uten feil/advarsler |
| Produksjonsbuild | Bestått; 55 sider og alle nye API-ruter kompilert |
| Fase 5 migrasjon up/down | Bestått |
| Lead overlever e-postfeil | Bestått rutetest |
| Lead overlever AI-køfeil | Bestått rutetest |
| Mottaksbekreftelse sendes én gang | Bestått engine-test |
| AI-output og PII-minimering | Positive og negative tester bestått |
| Pris/garanti uten admin | Blokkert i policy og test |
| Admin-godkjenning | Systemstyrt status + audit |
| Autentisert visuell admin-smoke | Gjentas i staging på grunn av manglende Windows ARM64 libsql-binær |

Migrasjonstestene kjøres sekvensielt med 60 sekunders hook-grense fordi hver PGlite-fil starter et komplett PostgreSQL-miljø. Dette fjernet falske ARM-ressurstimeouts; alle migrasjonstestene gikk deretter grønt.

Gate 5 er bestått.

## Produksjonsblokkere

- `RESEND_API_KEY`, godkjent avsenderdomene og riktig `LEAD_FROM_EMAIL`/`LEAD_TO_EMAIL` må være konfigurert;
- `GEMINI_API_KEY` og databehandleravtale må være godkjent før AI-flagget slås på;
- cron-intervallene i `vercel.json` må bekreftes mot faktisk Vercel-abonnement før staging deploy;
- autentisert staging-test skal bruke testkunde og testmottaker, ikke ekte kundedata;
- SMS for telefon-only kunder er fortsatt eksplisitt deaktivert og krever separat leverandør, samtykke og malgodkjenning.
