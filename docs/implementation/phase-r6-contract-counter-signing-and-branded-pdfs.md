# Fase R6 – selskapsaksept og enhetlige PDF-dokumenter

**Status:** Implementert, deployet og delvis staging-verifisert 25. august 2026; administratorens faktiske medsignering gjenstår  
**Produksjon:** Urørt

## Beslutning

`signed` betyr at kunden har signert. Kontrakten er først ferdig når `companySignedAt` er satt av en autentisert administrator. Arbeidsordre kan ikke opprettes før begge parter har signert.

## Leveranser

- Kunden signerer med fullt navn, tegnet PNG-signatur og automatisk tidspunkt.
- Kundens rå signatur lagres som beskyttet kontraktsfil, ikke i offentlig media eller logg.
- For eldre kundesignerte stagingavtaler hentes den eksakte signaturgrafikken kontrollert fra den varige gamle PDF-en; hvis den ikke kan gjenfinnes, blokkeres medsignering fremfor å lage et mangelfullt sluttdokument.
- Etter kundesignering viser custom admin `Kunden har signert – venter på vår signatur` og tilbyr navn-, signatur- og signeringsknapp.
- Administratorens signatur bindes til innlogget bruker, dokumenthash, navn, tidspunkt og HMAC-minimert nettverksbevis.
- Endelig PDF genereres med kunde- og leverandørsignatur side ved side i kontraktens egen signaturdel.
- Etter selskapsaksept sendes en profilert e-post med endelig PDF til kunden; idempotensnøkkel hindrer dobbel utsending.
- Kundeportalen viser forskjell på kundesignert og ferdig signert avtale og serverer nyeste varige dokument.
- Dashboard-køen `Kontrakter til signering` teller kundesignerte avtaler som mangler leverandørsignatur – ikke tilbud som fortsatt venter på kunden.
- Alle genererte kontrakt-, lead- og endrings-PDF-er bruker samme Takfornyelse-letterhead, logo, kontaktinformasjon, organisasjonsnummer, adresse, footer og sidetall.
- Adminstatus, meldingstyper og tidslinjetyper vises på valgt NB/LT/EN-panelspråk. Tidslinjeelementer er klikkbare og åpner full teknisk detalj.

## Operativ admin-korrigering 25. august 2026

- Et avbrutt internt `ai_reply`-utkast som er erstattet av en automatisk tilbudspakke skjules fra kundemeldinger og operativ tidslinje. Det har aldri vært sendt og skal derfor ikke presenteres som om kunden eller administratoren avbrøt en melding.
- Meldingsretning og leveringsstatus er separate begreper i panelet; LT viser nå `Siunčiama klientui`, mens faktisk levering vises med `Išsiųsta`, `Pristatyta`, `Nepavyko` osv.
- Tidslinjen navigerer til relevant del av den samme custom-saken. Payload-lenken er fortsatt tilgjengelig som en sekundær teknisk detalj, ikke som normal arbeidsflyt.
- Custom-saken viser strukturert AI-oppsummering, manglende informasjon og risikoflagg i stedet for rå JSON.
- Administratoren kan skrive inn et kontrollert takareal og begrunnelse direkte i custom-saken. Systemet oppretter da en ny, sporbar måleversjon og regenererer pris, maksimalpris, tilbud og kontraktsutkast. Tidligere utkast erstattes kontrollert.
- Manuell arealoverstyring kan bare gjøres før tilbudet sendes. Godkjenning bevarer overstyrt areal fremfor å erstatte det med ny polygonberegning.
- Kontraktbeskyttelsen sammenligner nå faktiske feltendringer. Payload kan sende uendrede originalfelt sammen med leverandørsignaturen uten at legitim medsignering blokkeres.

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
- `npm test`: 117 testfiler og 349 tester bestått etter operativ admin-korrigering.
- Enhetstester dekker separat selskapsbevis, to signaturer i endelig PDF, arbeidsordreblokkering før selskapsaksept, riktig neste handling og endelig e-postvedlegg.
- Vercel Preview `dpl_234owmDaLF3Xa1j8fDc89rnMyPd4` kjørte migrasjonen og bygget 64 sider samt den nye signeringsruten.
- Stagingaliaset peker på denne Preview-versjonen.
- Visuell stagingkontroll av dynamisk tilbuds-PDF bekreftet mørk letterhead, riktig logo, gul skillelinje, tydelig dokumenttittel, leverandør-/kundeinformasjon og mørk footer.
- Eksisterende kundesignert stagingavtale viser nå tydelig at kundens signatur er mottatt og at endelig kopi først sendes etter Takfornyelses medsignering.
- LT-admin viste lokaliserte lead-, tilbuds-, melding-, kontrakt- og tidslinjestatuser samt klikkbare tidslinjeelementer.

## Gjenstående stagingkontroll

1. Opprett en ny syntetisk kundehenvendelse.
2. Godkjenn og send tilbudspakken.
3. Signer som kunde på mobilbredde.
4. Bekreft at dashboard viser én avtale som venter på Takfornyelse, ikke kunden.
5. Åpne saken, skriv administratornavn, tegn signaturen og signer.
6. Kontroller endelig PDF visuelt: logo, letterhead, footer, kontaktinformasjon, begge navn, begge signaturer og begge tidspunkt.
7. Kontroller at kunden mottar nøyaktig én profilert e-post med endelig PDF.
8. Kontroller at neste handling først nå blir `Opprett arbeidsordre`.
