# Fase R4 – automatisk sakspakke fra henvendelse

**Dato:** 25. august 2026  
**Miljø:** isolert Preview/staging  
**Produksjon:** urørt  
**Status:** kode og automatiske tester fullført; autentisert staging-E2E gjenstår

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

## Staging-gate

Fasen kan først lukkes etter en autentisert stagingreise med en ny, syntetisk henvendelse:

1. mottaksbekreftelse mottas én gang;
2. Gemini-oppsummering vises;
3. måling, pris, tilbud og kontrakt opprettes automatisk;
4. admin kontrollerer tall og bruker én godkjenningshandling;
5. kunden mottar tilbudslenken;
6. spørsmål, signering og avslag med årsak prøves hver for seg;
7. avslått sak vises i oppmerksomhetskø og kan lukkes uten datatap.

Produksjonsaktivering er fortsatt ikke godkjent.
