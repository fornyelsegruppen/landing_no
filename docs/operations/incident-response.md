# Incident-prosess

## Prioritet

- **P0:** mulig datalekkasje, kompromittert secret, feil kunde ser dokument, pris/signatur knyttet til feil avtale;
- **P1:** utsending til feil mottaker, dobbel bindende utsending, arbeid kan starte uten påkrevd godkjenning, datatap;
- **P2:** køfeil, leverandørfeil, utilgjengelig panel eller måling som krever manuell behandling;
- **P3:** visuell feil eller ikke-kritisk innholdsavvik.

## Første tiltak

1. stans berørt feature med flagg, men bevar logger og data;
2. ved utsendingsfeil: deaktiver cron/leverandørnøkkel og sett jobber til `attention`/`cancelled`;
3. ved token-/tilgangshendelse: tilbakekall tokens, deaktiver konto og roter berørte secrets;
4. ved datamistanke: stans skriving og ta snapshot før retting;
5. noter korrelasjons-ID, tidspunkt, berørt collection/ID og handling – aldri rå token, signatur, kontaktdata eller dokumentinnhold i hendelseskanalen;
6. varsle systemeier og personvernansvarlig. De avgjør kunde-/myndighetsvarsling etter gjeldende frister og faktagrunnlag.

## Gjenoppretting og etterarbeid

- korriger med ny versjon eller additiv migrasjon; ikke omskriv signerte historiske snapshots;
- kjør negative tilgangstester og full kundereise i staging før gjenåpning;
- dokumenter årsak, omfang, tidslinje, tiltak og eier;
- oppdater test, runbook og kontroll som kunne forhindret gjentakelse;
- lukk først når data, utsending, tilgang og overvåking er verifisert.

