# Fase 9 – endringsavtaler og kontrollert kundekommunikasjon

Dato: 23. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat

Avvik over signert ramme kan nå behandles i en versjonert endringsavtale med før-/etterbeløp, årsak, dokumenthash, administrativ godkjenning og skriftlig kundegodkjenning. Arbeidsordren forblir blokkert til avtalen er akseptert og medarbeideren har gjennomført en ny stedskontroll. Planlagt kommunikasjon og ferdigmelding går gjennom idempotent jobb-/meldingskø med stoppregler, retry og synlig `attention`.

## Leveranser

### Endringsavtale

- bare `blocked`-utfallene `over_tolerance`, `over_maximum` og `scope_change` kan opprette avtale;
- HMS-avvik kan aldri omgjøres til prisavtale;
- hver avtale låser arbeidsordre, signert kontrakthash, før-/etterareal, før-/etterbeløp, mva., årsak, gyldighet og versjon;
- ny avtale erstatter åpen tidligere versjon uten å omskrive historikken;
- administrator må godkjenne uendret dokumenthash før utsending;
- kundelenken lagres som hash, kan tilbakekalles og indekseres ikke;
- kunden må skrive navn og eksplisitt godkjenne nøyaktig dokumenthash;
- IP og user agent lagres bare som HMAC-bevis, ikke råverdier;
- akseptert PDF og bevis er uforanderlige;
- tilbakekalling stopper ikke-sendte meldinger og leveringsjobber.

### Pris- og startkontroll

- etter aksept må medarbeideren sende ny før-kontroll;
- eksakt akseptert areal/pris kan bli `ready`;
- lavere faktisk areal reduserer prisen deterministisk med låst enhetspris og mva.;
- nytt høyere areal, nytt omfangsavvik eller HMS-risiko blokkerer igjen;
- `start` tillates aldri mens siste serverberegnede beslutning er `blocked`.

### Kommunikasjon

- planleggingsbekreftelse opprettes ved planlegging;
- 48-timerspåminnelse og valgfri melding to timer før oppstart planlegges bare når tidspunktet ligger i fremtiden;
- samme jobb-/tidsversjon gir aldri flere meldinger;
- endret tid eller kansellering avbryter gamle ventende jobber;
- ferdigmelding opprettes bare ved status `documented` og legger ved signert kontrakt samt inntil fire etterbilder;
- meldinger opprettes som faste norske maler uten AI-genererte løfter;
- leverandørfeil bruker eksisterende begrenset retry og ender synlig som `attention`;
- kundens kanalvalg respekteres. SMS er deaktivert i første versjon, så SMS-valg blir en synlig manuell oppgave og byttes aldri skjult til e-post;
- sensitiv kundetekst lagres ikke i jobbpayload; bare arbeidsordre-ID, meldingstype og tidsversjon.

## Migrasjon

- `20260823_194404_phase9_change_agreements_communications` oppretter `change_agreements`, kanalpreferanse, meldingstyper og godkjent endringsrelasjon;
- påkrevde relasjoner fra endringsavtale til arbeidsordre og kontrakt bruker `RESTRICT`;
- rollback fjerner sirkulære relasjoner i sikker rekkefølge og mapper nye meldingskategorier til eldre kategorier før enum gjenopprettes;
- migrasjonens `up` og `down` er kjørt mot PostgreSQL-kompatibel PGlite med reelle versjonerte rader.

## Verifikasjon og Gate 9

| Kontroll | Resultat |
|---|---|
| Fasespesifikke tester | 7 filer, 20 tester bestått |
| Alle ikke-migrasjonstester | 76 filer, 221 tester bestått i minnesikre grupper |
| Alle migrasjonstester | 10 filer, 21 tester bestått enkeltvis |
| Samlet testomfang | 86 filer, 242 tester bestått |
| Admin før utsending | Påkrevd og testet |
| Kunde før berørt arbeid | Påkrevd; ny stedskontroll kreves |
| Lavere areal | Reduserer pris og er testet |
| Høyere areal / nytt omfang / HMS | Blokkerer igjen |
| Påminnelse maksimalt én gang | Testet |
| Perplanlegging/kansellering | Gamle jobber avbrytes og er testet |
| Ferdigmelding | Bare etter dokumentasjon; testet |
| TypeScript | Bestått |
| ESLint | Bestått uten feil/advarsler |
| Produksjonsbuild | Bestått; 60 statiske sider og alle nye ruter kompilert |

Gate 9 er teknisk bestått. Autentisert, visuell og ekstern leverandørtest inngår fortsatt i staging-gaten.

## Produksjonsblokkere

- juridisk kontroll av endringsavtaletekst, forbrukervilkår, angrerett og bevismetode;
- ekte Resend-domene og leveringstest med vedlegg;
- valg og databehandlerkontroll av SMS-leverandør før SMS aktiveres;
- kontroll av maksimum vedleggsstørrelse med faktiske mobilbilder;
- verifisering av planlagt kjøring, Oslo-tid og sommer-/vintertid i staging;
- komplett anonymisert reise fra avvik til aksept, ny kontroll, arbeid og ferdigmelding på mobil;
- featureflaggene aktiveres først etter at avhengighetene over er godkjent.
