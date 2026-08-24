# Fase R6 – selskapsaksept og enhetlige PDF-dokumenter

**Status:** Implementert og automatisk verifisert 25. august 2026; autentisert staging-E2E gjenstår  
**Produksjon:** Urørt

## Beslutning

`signed` betyr at kunden har signert. Kontrakten er først ferdig når `companySignedAt` er satt av en autentisert administrator. Arbeidsordre kan ikke opprettes før begge parter har signert.

## Leveranser

- Kunden signerer med fullt navn, tegnet PNG-signatur og automatisk tidspunkt.
- Kundens rå signatur lagres som beskyttet kontraktsfil, ikke i offentlig media eller logg.
- Etter kundesignering viser custom admin `Kunden har signert – venter på vår signatur` og tilbyr navn-, signatur- og signeringsknapp.
- Administratorens signatur bindes til innlogget bruker, dokumenthash, navn, tidspunkt og HMAC-minimert nettverksbevis.
- Endelig PDF genereres med kunde- og leverandørsignatur side ved side i kontraktens egen signaturdel.
- Etter selskapsaksept sendes en profilert e-post med endelig PDF til kunden; idempotensnøkkel hindrer dobbel utsending.
- Kundeportalen viser forskjell på kundesignert og ferdig signert avtale og serverer nyeste varige dokument.
- Dashboard-køen `Kontrakter til signering` teller kundesignerte avtaler som mangler leverandørsignatur – ikke tilbud som fortsatt venter på kunden.
- Alle genererte kontrakt-, lead- og endrings-PDF-er bruker samme Takfornyelse-letterhead, logo, kontaktinformasjon, organisasjonsnummer, adresse, footer og sidetall.
- Adminstatus, meldingstyper og tidslinjetyper vises på valgt NB/LT/EN-panelspråk. Tidslinjeelementer er klikkbare og åpner full teknisk detalj.

## Datamodell og migrasjon

Migrasjon `20260825_120000_contract_counter_signatures` legger til:

- `customerSignatureImage`;
- `companySignatureEvidence`;
- `companySignatureImage`;
- `companySignedDocument`;
- `companySignedAt`;
- `companySignedBy`.

Kommersielt snapshot og dokumenthash forblir uendret. Etter kundesignering kan bare de uttrykkelige feltene for selskapsaksept legges til; etter begge signaturer er kontrakten uforanderlig.

## Verifikasjon

- `npm run typecheck`: bestått.
- `npm run lint`: bestått.
- `npm test`: 114 testfiler og 344 tester bestått.
- Enhetstester dekker separat selskapsbevis, to signaturer i endelig PDF, arbeidsordreblokkering før selskapsaksept, riktig neste handling og endelig e-postvedlegg.

## Gjenstående stagingkontroll

1. Opprett en ny syntetisk kundehenvendelse.
2. Godkjenn og send tilbudspakken.
3. Signer som kunde på mobilbredde.
4. Bekreft at dashboard viser én avtale som venter på Takfornyelse, ikke kunden.
5. Åpne saken, skriv administratornavn, tegn signaturen og signer.
6. Kontroller endelig PDF visuelt: logo, letterhead, footer, kontaktinformasjon, begge navn, begge signaturer og begge tidspunkt.
7. Kontroller at kunden mottar nøyaktig én profilert e-post med endelig PDF.
8. Kontroller at neste handling først nå blir `Opprett arbeidsordre`.

