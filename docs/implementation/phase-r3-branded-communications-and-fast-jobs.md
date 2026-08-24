# Fase R3 – profilert kommunikasjon og rask jobbkjøring

**Status:** Teknisk fullført i staging 24. august 2026; ekstern leveringsgate åpen  
**Produksjon:** Urørt  
**Staging:** `https://takfornyelse-staging.vercel.app`  
**Blokkerende konfigurasjon:** `RESEND_API_KEY` og `RESEND_WEBHOOK_SECRET` mangler i Preview

## Mål

Gi kunden en umiddelbar og profesjonell mottaksbekreftelse, behandle sikre bakgrunnsjobber uten å vente på neste dags cron og gjøre leveringsfeil synlige for administrator.

## Leveranser

- Felles responsiv HTML-mal for all kundekommunikasjon med Takfornyelse-logo, farger, telefon, e-post, selskapsnavn, organisasjonsnummer og adresse.
- HTML blir generert fra kontrollert tekst når en eldre melding mangler egen `bodyHtml`.
- Kundeinnhold HTML-escapes, mens sikre `https://`-lenker blir klikkbare.
- Standard Resend-avsender er navngitt som `Takfornyelse <post@takfornyelse.as>`; `reply-to` peker mot selskapets mottaksadresse.
- Mottaksbekreftelse opprettes idempotent og lagres med både tekst- og HTML-versjon.
- Ny gjenbrukbar operativ jobbprosessor for meldingslevering, Gemini-utkast og arbeidsordrekommunikasjon.
- Nye lead-jobber kjøres med Next.js `after()` umiddelbart etter at HTTP-svaret er sikret. Daglig cron beholdes som rescue-scan.
- Avbrutte `running`-jobber eldre enn 15 minutter returneres til retry-kø.
- Eksponentiell retry, maksimalforsøk og `attention`-kø brukes uten å lagre kundeinnhold i jobbpayload eller feiltekst.
- Telefon-only lead får eksplisitt oppgave om manuell oppringing. Det opprettes ikke falsk automatisk SMS-/e-postforventning.
- Signaturverifisert `/api/webhooks/resend` håndterer `delivered`, `delivery_delayed`, `bounced`, `complained`, `failed` og `suppressed`.
- Permanent leveringsfeil flytter meldingen til eksisterende administrator-kø `Reikia dėmesio`; webhook lagrer ikke mottakeradresse eller leverandørens rå feilmelding.

## Verifikasjon

### Automatisk

- `npm run lint`: bestått.
- `npx tsc --noEmit --incremental false`: bestått.
- `npm test`: 112 testfiler og 332 tester bestått.
- Nye tester dekker HTML-branding/escaping, Resend-eventer, signaturkrav, umiddelbar jobbkjøring, sikker jobbreferanse, konfigurasjonsfeil og phone-only-ruting.
- GitHub Quality gate [32768883369](https://github.com/fornyelsegruppen/landing_no/actions/runs/32768883369): dependency audit, lint, typecheck, tester, migrasjoner, tom PostgreSQL-bootstrap, produksjonsbuild og 8 Chromium-smoketester bestått på commit `ce850e4`.

### Autentisert staging

En syntetisk lead `R3 AUTOMATISK KOMMUNIKASJONSTEST` ble sendt gjennom den offentlige tostegsformen:

- nettsiden bekreftet innsending med `Takk! Vi tar kontakt snart.`;
- saken ble lagret som lead `#3` i samme stagingdatabase;
- profilert receipt `Vi har mottatt henvendelsen din` ble opprettet og markert `sent` av sikker Preview-logprovider;
- Gemini-utkast ble generert innen sekunder og saken gikk til `draft_ready` uten å vente på cron;
- custom admin viste én riktig primærhandling `Patvirtinti ir siųsti žinutę`;
- AI-oppsummering, receipt, AI-utkast og tidslinje var synlig i samme sak;
- testen brukte kun reservert syntetisk e-postadresse og inneholdt markering `Ingen kunde`.

### Build og deployment

- Vercel Preview-build `dpl_DSb9N92P7dotv8nCM4yM2V7Dd6Sx` bygget 64 sider og den nye webhook-ruten.
- Deployment ble kjørt på nytt etter at Preview fikk offentlige `LEAD_FROM_EMAIL`/`LEAD_TO_EMAIL`-verdier; stagingalias peker på redeployet preview.
- Forsøk på å lese/kopiere den skjulte production-nøkkelen ble stoppet av sikkerhetspolicy og ble ikke omgått.
- Ingen secret ble vist, lagret lokalt eller lagt i Git.

## Åpen ekstern gate

Preview bruker fortsatt eksplisitt sikker logprovider fordi `RESEND_API_KEY` bare finnes i production. Følgende må gjøres før R3 kan lukkes helt:

1. Legg en Resend API-nøkkel i Vercel **Preview** som `RESEND_API_KEY`.
2. Opprett en Resend webhook mot `https://takfornyelse-staging.vercel.app/api/webhooks/resend`.
3. Abonner minst på `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` og `email.suppressed`.
4. Legg webhookens signing secret i Vercel **Preview** som `RESEND_WEBHOOK_SECRET`.
5. Redeploy Preview og send én kontrollert e-post til en eiergodkjent testadresse.
6. Bekreft nøyaktig én mottatt profilert e-post og `delivered` i samme admin-sak.

## Gate R3

| Krav | Resultat |
|---|---|
| Umiddelbar jobb venter ikke til neste dags cron | Bestått i autentisert staging |
| Midlertidig feil mister ikke lead eller lager duplikat | Bestått i idempotens-, retry- og durabilitytester |
| Ingen persondata eller secrets i jobbpayload/feillogg | Bestått i kode- og enhetstest |
| Profilert HTML-/tekstmal og reply-to | Bestått i kode, test og lagret stagingmelding |
| Ekte testadresse mottar nøyaktig én melding og webhook markerer `delivered` | **Åpen – krever to Preview secrets og kontrollert ekstern test** |
| Produksjon uendret | Bestått |

**Beslutning:** R3-koden og intern stagingreise er godkjent. Fasen forblir `ekstern gate åpen` og R4 starter ikke før ekte Resend-levering er verifisert eller eier eksplisitt godkjenner at den eksterne porten flyttes til R10.
