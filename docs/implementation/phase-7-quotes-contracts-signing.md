# Fase 7 – tilbud, kundelenke, kontrakt og signering

Dato: 23. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat

Det er etablert en versjonert tilbuds- og kontraktsflyt fra godkjent prisberegning til sikker kundelenke, PDF og elektronisk signering. Kunden ser de samme låste tallene i nettvisning og PDF. Et signert dokument kan ikke endres eller slettes gjennom vanlig arbeidsflyt, og kunden får en varig kopi som PDF-vedlegg i en idempotent meldingskø.

Teknisk ferdigstillelse er ikke juridisk produksjonsgodkjenning. Intern signering med tegnet signatur, skrevet navn, dokumenthash og bevismetadata omtales ikke som avansert eller kvalifisert eIDAS-signatur. Produksjonsflaggene for kundetilbud og signering skal være avslått til faktisk kontraktstekst, angreskjema, signaturmetode og personvernflyt er vurdert og godkjent.

## Rettslig implementeringsgrunnlag

- Angrerettloven krever blant annet tydelig erkjennelse av betalingsforpliktelsen ved elektronisk bestilling, bekreftelse på varig medium og særskilt håndtering når kunden uttrykkelig ber om tidlig oppstart: [angrerettloven](https://lovdata.no/dokument/NL/lov/2014-06-20-27/%C2%A739).
- Standard angreskjema skal gjøres tilgjengelig før avtalen inngås: [departementets veileder til angrerettloven](https://www.regjeringen.no/contentassets/6d6b5195d1ee4133977bf5339d1623d9/veileder-angrerett-2017.pdf) og [forskrift om opplysningsplikt og angrerett](https://www.regjeringen.no/globalassets/upload/bld/frl/angrerettloven/forskrift.pdf).
- Forbrukerrådet anbefaler skriftlig kontrakt med blant annet pris, oppstart, ferdigstilling og betalingsvilkår: [sjekkliste for håndverkertjenester](https://www.forbrukerradet.no/tips-og-rettar/bustad-og-straum/bruk-av-handverkar/sjekkliste-for-du-vel-handverkar/).
- Elektroniske tillitstjenester i Norge reguleres gjennom 2018-loven som gjennomfører eIDAS: [lov om elektroniske tillitstjenester](https://lovdata.no/nav/lov/2018-06-15-44).

## Leveranser

### Låste dokumenter

- `quotes`, `contracts` og `contract-terms` er egne versjonerte samlinger;
- tilbudet låser måleversjon, prisregel, beregning, arealintervall, mva., toleranse, maksimalpris og vilkårsversjon i ett kanonisk snapshot;
- samme snapshot gir stabil SHA-256-hash og samme visningsmodell i web og PDF;
- administrator må godkjenne tilbudet før det kan utstedes;
- godkjent tilbud og signert kontrakt er uforanderlige; ny informasjon krever ny versjon;
- godkjente juridiske vilkår krever en ekstern `LEGAL_REVIEW_REFERENCE`, godkjenningsperson og tidspunkt.

### Sikker kundelenke

- ugjettbart token lagres bare som hash, er knyttet til nøyaktig tilbud, har utløp og kan tilbakekalles eller regenereres;
- feil, utløpt eller tilbakekalt token gir ingen opplysninger om kunden;
- kundesiden og API-svar er `noindex` og `no-store`;
- kunden kan se tilbudet, laste ned PDF, stille spørsmål, avslå eller signere;
- spørsmål blir en innkommende melding i samme lead-tidslinje;
- utstedelse lager meldingsutkast, men sender aldri uten administrativ godkjenning.

### Kontrakt og signatur

- mobil signaturflate støtter mus, penn og finger;
- knappen sier tydelig `Bestilling med forpliktelse til å betale og signer`;
- betaling, vilkår og mottatt angrerettinformasjon må godtas eksplisitt;
- tidlig oppstart er valgfri og krever en ekstra uttrykkelig erkjennelse;
- serveren validerer ekte PNG-signaturdata, nøyaktig dokumenthash og alle samtykker;
- rå IP og user-agent lagres ikke; HMAC-bevis gjør etterprøving mulig uten å beholde råverdiene;
- PDF inneholder tilbud, kontrakt, prisgrunnlag, vilkår, angrerett, skjema, signatur og bevisreferanser;
- signert PDF lagres privat og sendes kunden som vedlegg via den idempotente meldingskøen;
- samtidig signering håndteres med betinget statusoppdatering, slik at bare én signering vinner.

### Personvern og sletting

- personvernteksten beskriver tilbud, kontrakt, signaturbevis og oppbevaring;
- leads uten signert kontrakt rydder meldinger, tokens, tilbud, beregninger og målinger i riktig avhengighetsrekkefølge;
- lead med signert kontrakt kan ikke slettes gjennom vanlig personvernjobb, men må arkiveres etter godkjent oppbevaringspolicy;
- private PDF-er leses bare fra godkjent privat lagring, med traversal- og størrelseskontroll.

## Migrasjoner

- `20260823_173944_phase7_quotes_contracts` oppretter tilbud, kontrakter, kontraktsvilkår og låserelasjoner;
- `20260823_175110_phase7_message_attachments` legger til kundespørsmål og private vedlegg;
- avhengigheter bruker kontrollert `CASCADE`/`RESTRICT`;
- rollback mapper nye meldingstyper før enum-nedgradering og fjerner kontrakter før tilbud;
- `up` og `down` er kjørt mot ekte in-process PostgreSQL via PGlite.

## Verifikasjon og Gate 7

| Kontroll | Resultat |
|---|---|
| Full Vitest-regresjon | 73 filer, 209 tester bestått |
| Kundetoken isolerer riktig tilbud | Bestått |
| Ugyldig/tilbakekalt token | Avvist uten datalekkasje |
| Idempotent samtidig signering | Bestått |
| Dokument- og signaturhash | Bestått |
| Falsk PNG-signatur | Avvist |
| Juridiske vilkår uten kontrollreferanse | Blokkert |
| Godkjent/signert dokument endres | Blokkert |
| Signert PDF som e-postvedlegg | Bestått |
| Personvernsletting med signert kontrakt | Blokkert |
| Migrasjoner `up`/`down` | Bestått |
| TypeScript | Bestått |
| ESLint | Bestått |
| Produksjonsbuild | Bestått; 58 statiske sider og tilbudsruter kompilert |

Gate 7 er teknisk bestått. Mobil fullflyt må gjentas i staging fordi lokal, autentisert nettleserkjøring på denne Windows ARM64-maskinen blokkeres av manglende valgfri `libsql`-binær.

## Produksjonsblokkere

- få faktisk kontraktstekst, prisavvik, tidlig oppstart, angrerett og standard angreskjema juridisk vurdert;
- opprett ny `contract-terms`-versjon med den godkjente teksten og registrer ekte `LEGAL_REVIEW_REFERENCE`;
- avgjør dokumentert om intern tegnet signatur er tilstrekkelig for denne avtalekategorien; velg kvalifisert leverandør/eID dersom juridisk vurdering krever det;
- konfigurer Resend-domene, avsender, secrets og databehandleravtale;
- gjennomfør mobil staging-test av visning, PDF, spørsmål, avslag, signering, kopi og tilbakekalt/utløpt lenke;
- gjennomfør tilgjengelighetskontroll av signaturflyten og tilby et praktisk alternativ dersom kunden ikke kan tegne;
- aktiver `FEATURE_CUSTOMER_QUOTES` og `FEATURE_CONTRACT_SIGNING` først etter kontrollene over.
