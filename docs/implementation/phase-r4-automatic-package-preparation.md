# Fase R4 – automatisk sakspakke fra henvendelse

**Dato:** 25. august 2026  
**Miljø:** isolert Preview/staging  
**Produksjon:** urørt  
**Status:** automatisk pakkeopprettelse verifisert i autentisert staging; utsending og komplett kunde-E2E gjenstår

## Formål

En komplett henvendelse med e-post, presis adresse og valgt tjeneste skal ikke stoppe etter Gemini-oppsummeringen. Systemet skal automatisk forberede et kontrollert, sammenhengende beslutningsgrunnlag:

1. Kartverket-normalisert adresse;
2. valgt OSM-bygningskontur;
3. versjonert foreløpig takmåling;
4. deterministisk areal og pris fra godkjent prisregel;
5. tilbudsutkast;
6. kontraktsutkast;
7. én administrativ handling som godkjenner måling og dokumenthash, oppretter kundelenke og sender tilbudet.

Gemini kan oppsummere og formulere tekst, men bestemmer ikke areal, pris, mva., toleranse eller maksimalpris.

## Implementert flyt

- `lead.ai.draft` kjører nær sanntid etter lagret henvendelse.
- Når måle- og tilbudsfunksjonene er klare, fortsetter samme operative jobb med automatisk sakspakke.
- Adresse søkes hos Kartverket med gate/husnummer, postnummer og eventuell by.
- OSM-kandidater rangeres etter om adressepunktet ligger i konturen, confidence og avstand.
- Ett unikt bygg som inneholder adressepunktet velges automatisk.
- Ett tydelig nærmeste `medium`-treff kan foreslås når avstandsledelsen er minst 12 meter.
- Flere like sannsynlige bygg blokkerer automatikk og gir administrator en konkret oppgave.
- Foreløpig helningsintervall er 22–32°. Dette og bygningskonturen må godkjennes av administrator.
- Areal og pris beregnes av eksisterende deterministiske motorer.
- Tilbud og kontrakt opprettes som utkast og kan ikke sendes uten aktiv administrator.
- AI-svarutkast som erstattes av en komplett tilbudspakke avbrytes, slik at admin ikke får en misvisende primærhandling.
- Eksisterende sak uten måling får handlingen `Forbered måling, pris, tilbud og kontrakt`, slik at eldre staging-leads kan etterbehandles.

## Sikkerhetsgrenser

- Ingen bindende pris sendes automatisk.
- Lav confidence velges aldri automatisk.
- Ved et tvetydig byggtreff blokkeres pakken; administrator må velge riktig bygg.
- Måleutkastet beholder kilde, lisens, kreditering, polygon, vinkelintervall, confidence, beregningssnapshot og hash.
- Bare en godkjent prisregel kan brukes.
- Bare juridisk godkjente og miljøkonfigurerte kontraktsvilkår kan brukes.
- `Godkjenn og send hele tilbudspakken` krever eksplisitt bekreftelse i admin.
- Før utsending kontrolleres måleport, tilbudshash og at tilbudet peker på nyeste måling.
- E-post går gjennom varig outbox; midlertidig leveringsfeil mister ikke tilbudet.

## Kundens avslag

Kunden kan velge årsak og skrive en kommentar. Systemet:

- lagrer avslaget og hele saken;
- registrerer årsaken som innkommende kundemelding;
- sender en vennlig profilert bekreftelse;
- legger saken i administratorens oppmerksomhetskø;
- lar administrator følge opp eller lukke saken;
- sletter ikke kontrakt-, tilbuds-, måle- eller meldingshistorikk.

## Automatiske bevis

| Kontroll | Resultat |
|---|---|
| ESLint | Bestått |
| TypeScript | Bestått |
| Målrettede R4/R5-tester | 4 filer, 32 tester bestått |
| Full Vitest-regresjon | 113 filer, 338 tester bestått |
| Produksjonskompilering | Kode kompilert og TypeScript bestått; lokal sluttinnsamling blokkeres av kjent manglende Windows ARM64 `@libsql`-optional binary |

## Autentisert stagingbevis – sak 6

En lagret staginghenvendelse for `Takvask + impregnering` ble etterbehandlet i custom admin.

- Første forsøk ble korrekt blokkert fordi godkjent prisregel manglet. Systemet fant ikke på en pris.
- En isolert testregel ble opprettet som `STAGING-TEST-TAKVASK-IMPREGNERING-138-V1`, 138 kr/m² eks. mva., 25 % mva. og 15 % toleranse. Notatet markerer uttrykkelig at regelen bare gjelder staging og ikke er juridisk godkjent produksjonspris.
- Kartverket normaliserte adressen til `Lyngveien 28A, 1182 OSLO`.
- Ett høy-confidence OSM-bygg ble valgt.
- Måling `TM-6-V1` ble opprettet med 86,7 m² horisontalt og 93,5–102,3 m² estimert takareal.
- Prisgrunnlaget ga 17 647 NOK inkl. mva. og 20 294 NOK maksimalpris.
- Tilbud `T-6-V1` og kontrakt `K-6-V1` ble opprettet som utkast.
- Det tidligere AI-svarutkastet ble satt til `cancelled`.
- Custom admin viser én bekreftelsespliktig handling: `Godkjenn og send hele tilbudspakken`.
- Handlingen ble med vilje ikke utført i denne kontrollen; ingen tilbudsmelding ble sendt til kunden.

## Staging-gate

Den automatiske opprettelsen i punkt 1–3 er nå bevist for sak 6. Fasen kan først lukkes etter resten av den autentiserte stagingreisen:

1. admin kontrollerer tall og bruker én godkjenningshandling;
2. kunden mottar tilbudslenken;
3. spørsmål, signering og avslag med årsak prøves hver for seg;
4. avslått sak vises i oppmerksomhetskø og kan lukkes uten datatap;
5. minst tre kjente referansetak sammenlignes med kontrollmål før produksjon.

Produksjonsaktivering er fortsatt ikke godkjent.
