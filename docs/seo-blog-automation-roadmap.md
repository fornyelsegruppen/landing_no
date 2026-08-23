# Takfornyelse.as – AI-assistert SEO-blogg og innholdsroadmap

**Status:** Planlagt  
**Primærspråk:** Norsk bokmål  
**Foreslått pilot:** 12 uker  
**Produksjonsmål:** 2 artikkelutkast per uke, publisering bare etter kvalitetsgodkjenning

**Samlet gjennomføringsplan:** [Takfornyelse.as – samlet implementeringsplan](./full-platform-implementation-master-plan.md)  
**Relatert implementeringsplan:** [Forenklet admin- og brukerpanel](./takfornyelse-admin-user-panel-roadmap.md)

## 1. Oppgave og mål

Bygg en kontrollert, AI-assistert innholdsmotor for Takfornyelse.as som:

- finner relevante temaer innen takvask, impregnering, takmaling, takfornying og nytt tak;
- prioriterer temaer etter reell etterspørsel, forretningsverdi og eksisterende innhold;
- oppretter to norske artikkelutkast per uke;
- tilfører original faglig verdi, ekte prosjektbevis og naturlige interne lenker;
- lar en ansvarlig person kontrollere og godkjenne innhold før publisering;
- publiserer godkjente artikler med korrekt metadata, schema, sitemap og konverteringsmåling;
- måler synlighet, organisk trafikk og kvalifiserte henvendelser over tid.

Målet er ikke å masseprodusere søkemotorinnhold. Målet er å bygge et nyttig og troverdig kunnskapsbibliotek som hjelper boligeiere og styrker synligheten til relevante tjenester og områder.

## 2. Prinsipper og avgrensninger

### Skal gjøres

- Norsk innhold skal prioriteres.
- AI skal hjelpe med research, struktur og førsteutkast.
- Ekte fagkunnskap, bilder, priser og prosjektdata skal ha en tydelig kilde.
- Hvert innlegg skal svare på et konkret spørsmål eller problem kunden faktisk har.
- Hvert innlegg skal ha én tydelig hovedintensjon og én primær målgruppe.
- Innholdet skal kobles til riktig tjeneste, område og neste steg.
- Alle publiserte artikler skal være nyttige også for en leser som kommer direkte til siden, ikke bare fra Google.

### Skal ikke gjøres

- Ingen automatisk massepublisering uten kvalitetskontroll i pilotperioden.
- Ingen kopiering eller omskriving av konkurrentartikler.
- Ingen falske forfattere, erfaringer, omtaler, sertifikater eller prosjektpåstander.
- Ingen faste løfter om pris, resultat, levetid, kapasitet eller garanti uten godkjent grunnlag.
- Ingen by- eller kommunesider dersom området ikke faktisk betjenes.
- Ingen mange nesten identiske artikler for små søkeordvarianter.
- Ingen uoffisiell scraping av Google-søk eller Google Trends som produksjonsavhengighet.
- Ingen kjøpte eller manipulerte lenker og omtaler.

## 3. Nåværende situasjon

Takfornyelse.as har allerede et godt teknisk utgangspunkt:

- Payload CMS har en `posts`-samling med utkast og publisering.
- `/no/blogg` og `/no/blogg/[slug]` finnes.
- Metadata, canonical, Open Graph, `BlogPosting` og breadcrumbs genereres.
- Publiserte innlegg legges automatisk i sitemap.
- Robots.txt og sitemap.xml finnes.

Identifiserte mangler før automatisering:

- Ingen publiserte blogginnlegg finnes i sitemap per 23. august 2026.
- Artikkelinnholdet støtter ikke ordentlige klikkbare interne lenker i brødteksten.
- Bloggmalen mangler automatisk CTA, relaterte tjenester og relaterte artikler.
- Synlig forfatter, faglig kontrollør og kontrollert-dato mangler.
- Innlegg har ikke felt for tema, søkeintensjon, tjeneste, sted, kilder eller kvalitetsscore.
- Engelsk innhold er obligatorisk i dagens CMS, selv om Norge er hovedmarkedet.
- Det finnes ikke en kontroll mot duplisering og søkeordkannibalisering.
- Search Console-domeneegenskapen var ikke tilgjengelig i kontoen som ble kontrollert.

## 4. Prioriterte datakilder for temaer

Temaer skal ikke velges bare fordi de er populære i Google Trends. Følgende prioritering brukes:

1. **Google Search Console**
   - søk med mange visninger og posisjon 5–20;
   - søk med mange visninger og lav CTR;
   - spørsmål der eksisterende landingsside ikke svarer godt nok;
   - indekserings- og innholdsproblemer.
2. **Google Ads-søkeord og søketermer**
   - kvalifiserte kommersielle søk;
   - spørsmål som fører til relevante besøk eller henvendelser;
   - irrelevante søk brukes som negativt signal.
3. **Reelle kundehenvendelser**
   - spørsmål fra skjema, telefon, e-post og befaring;
   - vanlige innvendinger og misforståelser;
   - sesongspørsmål.
4. **Google Trends**
   - kontrollert liste med nisjerelaterte seed-temaer;
   - Norge og relevante underregioner;
   - sammenligning av sesong og stigende interesse;
   - offisiell Trends API brukes dersom alpha-tilgang innvilges.
5. **Manuell faglig plan**
   - vedlikeholdskalender;
   - sikkerhet og egnethet;
   - prisdrivere;
   - sammenligninger mellom behandling og takbytte;
   - dokumenterte prosjekter og lokale forhold.

## 5. Temamodell og poengberegning

Hver temakandidat får en score fra 0 til 100.

| Faktor | Vekt | Forklaring |
| --- | ---: | --- |
| Relevans for tjenester | 25 | Direkte kobling til en tjeneste Takfornyelse faktisk leverer |
| Dokumentert etterspørsel | 20 | Search Console, Ads, Trends eller kundehenvendelser |
| Kommersiell verdi | 15 | Sannsynlighet for kvalifisert befaring eller tilbud |
| Innholdsgap | 15 | Eksisterende side svarer ikke godt nok på spørsmålet |
| Sesongaktualitet | 10 | Riktig tidspunkt for vær, vedlikehold eller planlegging |
| Originalt bevis | 10 | Eget prosjekt, bilde, måling eller faglig erfaring finnes |
| Lokal relevans | 5 | Reelt betjent område og unikt lokalt innhold |

### Automatisk avvisning

En kandidat skal avvises eller sendes til manuell vurdering når:

- temaet ikke er direkte relevant for Takfornyelse;
- en eksisterende side dekker samme søkeintensjon;
- nødvendig faglig dokumentasjon mangler;
- temaet krever løfter eller juridiske/faglige påstander som ikke kan verifiseres;
- temaet bare er en trend uten forbindelse til eksisterende kunder;
- artikkelen sannsynligvis vil kannibalisere en viktig tjeneste- eller prisside.

## 6. Foreslått innholdsstruktur

Hver artikkel skal som minimum inneholde:

1. Én tydelig H1.
2. Kort svar eller oppsummering tidlig på siden.
3. Forklaring av problemet og når det er relevant.
4. Hva boligeieren kan kontrollere selv på en trygg måte.
5. Hva som krever faglig vurdering.
6. Prisdrivere når temaet er kommersielt.
7. Eget eksempel, prosjekt, bilde eller faglig kommentar når tilgjengelig.
8. Naturlige interne lenker til relevante sider.
9. Tydelig, rolig CTA til gratis vurdering eller befaring.
10. Relevante spørsmål og svar.
11. Kilder og kontrollert dato.
12. Synlig forfatter og faglig kontrollør.

### Standard CTA

CTA skal tilpasses temaet, men følge denne logikken:

> Usikker på om taket bør vaskes, impregneres, males eller skiftes? Send postnummer, adresse hvis ønskelig og gjerne bilder. Vi vurderer riktig neste steg og gir et tydelig tilbud før arbeidet starter.

CTA skal ikke love endelig pris eller teknisk konklusjon uten vurdering.

## 7. Interne lenker

Hvert innlegg skal normalt ha:

- 1 lenke til primær tjenesteside;
- 1 lenke til pris- eller sammenligningsside når relevant;
- 1 lenke til et dokumentert prosjekt eller referanse;
- 1–2 lenker til relaterte guider;
- 1 CTA-lenke til kontaktskjemaet;
- breadcrumbs tilbake til Takguide og forsiden.

Lenketeksten skal beskrive målsiden naturlig. Eksakt samme søkeordanker skal ikke brukes mekanisk i alle artikler.

## 8. CMS- og datamodell

### Ny samling: `seo-topics`

Foreslåtte felt:

- `topic`;
- `primaryKeyword`;
- `secondaryKeywords`;
- `searchIntent`: informational, commercial, local eller comparison;
- `service`;
- `location`;
- `season`;
- `source`: Search Console, Ads, Trends, lead eller manual;
- `sourceMetrics`;
- `topicScore`;
- `overlapScore`;
- `reasonForSelection`;
- `status`: candidate, rejected, queued, drafted, approved eller published;
- `checkedAt`;
- `relatedPost` dersom temaet allerede er dekket.

### Utvidelse av `posts`

Foreslåtte felt:

- `primaryKeyword`;
- `secondaryKeywords`;
- `searchIntent`;
- `serviceRelation`;
- `locationRelation`;
- `category`;
- `sourceUrls`;
- `authorName`;
- `reviewerName`;
- `reviewedAt`;
- `aiAssisted`;
- `aiGenerationRunId`;
- `qualityScore`;
- `relatedPosts`;
- `relatedServices`;
- `ctaVariant`;
- `scheduledAt`;
- `lastContentAuditAt`;
- `performanceNotes`.

### Ny samling: `seo-runs`

Skal lagre ikke-sensitive driftsdata:

- start- og sluttid;
- hvilken jobb som kjørte;
- valgte og avviste temaer;
- modellversjon og promptversjon;
- kvalitetsresultat;
- feil uten hemmeligheter eller kundedata;
- opprettet utkast eller publisert innlegg.

API-nøkler, tokens, cookies og kundeopplysninger skal aldri lagres i CMS-loggen eller Git-repositoriet.

## 9. AI-generering

Generatoren skal få kontrollert kontekst fra:

- selskapets godkjente fakta og tjenester;
- pris- og garantiregler;
- betjente områder;
- godkjent merkevarestemme;
- tema og søkeintensjon;
- utvalgte kilder;
- aktuelle prosjektdata;
- liste over eksisterende sider som kan lenkes.

Generatoren skal returnere strukturert data, ikke bare fritekst:

- slug;
- tittel;
- ingress;
- artikkelinnhold;
- meta title;
- meta description;
- foreslåtte interne lenker;
- FAQ;
- CTA;
- bildebehov og alt-tekst;
- påstander som krever menneskelig kontroll;
- kilder;
- kort begrunnelse for hvorfor artikkelen er nyttig.

## 10. Kvalitetsporter

Før et utkast kan godkjennes, må systemet kontrollere:

### Fag og fakta

- Tjenesten leveres faktisk.
- Området betjenes faktisk.
- Priser samsvarer med godkjente priser og mva-formulering.
- Ingen absolutte garantier eller levetidsløfter.
- Ingen farlige gjør-det-selv-råd om arbeid i høyden.
- Produkter og sertifikater er korrekt omtalt.

### Originalitet

- Ingen kopiert konkurrenttekst.
- Lav semantisk overlapp med eksisterende Takfornyelse-artikler.
- Minst ett originalt element: prosjekt, bilde, faglig vurdering, lokal forklaring eller egen data.

### Språk

- Naturlig norsk bokmål.
- Ingen blanding av svensk, dansk, engelsk eller litauisk.
- Ingen overdreven søkeordgjentakelse.
- Ingen typiske AI-formuleringer uten konkret innhold.

### SEO

- Unik tittel og meta description.
- Én primær søkeintensjon.
- Riktig canonical og språkversjon.
- Fungerende interne lenker.
- Riktig bilde og beskrivende alt-tekst.
- Artikkel- og breadcrumb-schema valideres.
- Sitemap oppdateres etter publisering.

### Konvertering

- CTA passer artikkelens intensjon.
- CTA går til riktig skjema eller tjenesteside.
- UTM og organisk attribusjon bevares.
- Ingen aggressivt eller villedende salgsspråk.

## 11. Redaksjonell arbeidsflyt

Anbefalt statusløp:

`candidate → queued → draft → AI QA → human review → approved → scheduled → published → measured`

### Pilotregel

- Systemet produserer to utkast per uke.
- En ansvarlig person må godkjenne hvert utkast.
- Bare godkjente utkast får `scheduledAt`.
- Et utkast kan avvises uten at et erstatningsinnlegg må publiseres samme uke.
- Kvalitet er viktigere enn å nå nøyaktig to publiseringer.

### Senere automatisk publisering

Automatisk publisering kan vurderes først når:

- minst 20 utkast er faglig kontrollert;
- faktiske feil er sjeldne og dokumentert;
- ingen innholdskannibalisering er oppdaget;
- publiserte artikler blir indeksert og gir relevant synlighet;
- ansvarlig leder godkjenner konkrete tema- og innholdstyper som kan auto-publiseres.

Pris-, garanti-, sikkerhets-, skade- og juridiske temaer skal fortsatt kreve menneskelig godkjenning.

## 12. Teknisk jobbplan

### Fase 0 – tilgang og baseline

**Mål:** Skaff målegrunnlag før innhold produseres.

Oppgaver:

- verifiser Takfornyelse.as som Domain property i Google Search Console;
- send inn `/sitemap.xml`;
- lagre baseline for organiske klikk, visninger, CTR, posisjon og indekserte sider;
- registrer konverteringer fra organisk trafikk;
- dokumenter eksisterende søk, sider og temaer;
- etabler en liste over godkjente tjenester, områder, priser og påstander.

Akseptansekriterier:

- Search Console-data kan leses;
- sitemap er behandlet uten kritiske feil;
- baseline-rapport er lagret;
- konverteringer kan knyttes til organisk trafikk.

### Fase 1 – CMS og redaksjonelt fundament

**Mål:** Gjør CMS klart for kontrollert SEO-produksjon.

Oppgaver:

- opprett `seo-topics` og `seo-runs`;
- utvid `posts` med SEO-, kilde-, forfatter- og QA-felt;
- gjør norsk til primært innholdsspråk;
- gjør engelsk versjon valgfri;
- generer ikke hreflang til en språkversjon som ikke finnes;
- legg inn statuser og planlagt publisering;
- legg til preview for redaktør.

Akseptansekriterier:

- et norsk utkast kan opprettes uten engelsk kopi;
- utkast kan forhåndsvises uten indeksering;
- kilder, forfatter, kontrollør og kvalitetsscore lagres;
- bare godkjente innlegg kan planlegges.

### Fase 2 – ny artikkelmal

**Mål:** Gjør hvert innlegg nyttig, lenkbart og konverterende.

Oppgaver:

- erstatt begrenset Markdown-visning med sikker rich text eller fullverdig Markdown;
- støtt klikkbare interne og eksterne lenker;
- legg til automatisk CTA-komponent;
- vis forfatter, faglig kontrollør og oppdatert dato;
- vis relaterte tjenester og artikler;
- legg til brødsmuler og delingsmetadata;
- legg til kildeområde når kilder brukes;
- forbedre `BlogPosting`-schema med relevante felt;
- test mobil, tilgjengelighet og ytelse.

Akseptansekriterier:

- interne lenker er klikkbare og crawlbare;
- CTA vises riktig på mobil og desktop;
- schema valideres uten kritiske feil;
- en artikkel kan ha ekte bilde med korrekt alt-tekst;
- artikkelmalen har ingen layout shift eller blokkert innhold.

### Fase 3 – temainnhenting og prioritering

**Mål:** Velg temaer fra faktiske signaler.

Oppgaver:

- koble Search Console API med minste nødvendige lesetilgang;
- importer aggregerte Ads-søketermer;
- bygg kontrollert seed-liste for Google Trends;
- bruk offisiell Trends API hvis tilgang finnes;
- ellers støtt manuell CSV-import eller godkjent offentlig datasett;
- hent anonymiserte temafrekvenser fra kundehenvendelser, uten persondata;
- beregn topic score og overlap score;
- vis begrunnelse for valg i admin.

Akseptansekriterier:

- systemet kan foreslå minst ti relevante kandidater;
- hver kandidat har kilde, score og begrunnelse;
- duplikater og åpenbar kannibalisering markeres;
- irrelevante nasjonale trender filtreres bort.

### Fase 4 – AI-generator og QA

**Mål:** Opprett kontrollerte norske utkast.

Oppgaver:

- bygg versjonert systemprompt og artikkelbrief;
- hent kun godkjent bedriftskontekst;
- generer strukturert artikkelutkast;
- kjør faktakontroll mot godkjente data;
- kjør språk-, duplikat-, lenke- og påstandskontroll;
- beregn quality score;
- lagre resultat som Payload-utkast;
- send varsel til redaktør om nytt utkast eller feil.

Akseptansekriterier:

- generatoren publiserer aldri direkte;
- alle utkast har kilder og kontrollpunkter;
- pris og garanti kan ikke oppfinnes;
- utkast med lav kvalitet eller høy overlapp avvises;
- hele kjøringen kan spores uten å lagre hemmeligheter.

### Fase 5 – tidsplan og publisering

**Mål:** Produser jevnt uten massepublisering.

Foreslått tidsplan:

- mandag: tema 1 velges og utkast opprettes;
- torsdag: tema 2 velges og utkast opprettes;
- godkjent innhold publiseres etter redaksjonell vurdering;
- sitemap oppdateres automatisk;
- publisert URL registreres for senere måling.

Tekniske oppgaver:

- opprett beskyttet cron-endepunkt for temavalg og utkast;
- opprett separat publiseringsjobb for godkjente, planlagte innlegg;
- bruk lås/idempotency slik at samme uke ikke oppretter duplikater;
- legg inn retry med grense;
- logg feil og varsle ansvarlig person.

Akseptansekriterier:

- maksimalt to planlagte utkast opprettes per uke;
- samme tema kan ikke opprettes to ganger;
- jobb kan kjøres på nytt uten duplikat;
- bare `approved` + gyldig `scheduledAt` kan publiseres.

### Fase 6 – måling og innholdsvedlikehold

**Mål:** Forbedre det som gir relevant synlighet og leads.

Oppgaver:

- lag ukentlig Search Console-rapport per artikkel;
- mål visninger, klikk, CTR, gjennomsnittsposisjon og indekseringsstatus;
- mål CTA-klikk, skjema-start og kvalifisert lead;
- sammenlign innholdsklynger og søkeintensjoner;
- marker artikler som bør oppdateres, slås sammen eller omdirigeres;
- oppdater dato bare når innhold faktisk er forbedret;
- behold historikk over større revisjoner.

Akseptansekriterier:

- hver artikkel kan kobles til Search Console-data;
- organisk lead kan spores tilbake til landingssiden;
- innhold uten verdi identifiseres etter en avtalt periode;
- oppdatering og sammenslåing bruker korrekte redirects.

### Fase 7 – 12 ukers pilot og beslutningsport

**Mål:** Bevis at prosessen gir kvalitet før skalering.

Pilotleveranser:

- opptil 24 genererte utkast;
- bare godkjente artikler publiseres;
- minst én faglig eller original verdi per publisert artikkel;
- minst én kommersiell og én informativ/seasonal kandidat per uke;
- ukentlig QA-logg;
- sluttrapport etter 12 uker.

Beslutning etter pilot:

- fortsett med to utkast per uke;
- reduser eller øk frekvens basert på kvalitet og søkeetterspørsel;
- tillat auto-publisering bare for forhåndsgodkjente lavrisikoformater;
- behold manuell godkjenning for øvrige temaer;
- avslutt eller endre klynger som ikke gir relevant synlighet.

## 13. Første foreslåtte innholdsklynger

Dette er startkandidater, ikke automatisk godkjente søkeord:

### Pris og valg

- Hva koster takvask per m²?
- Takfornying eller nytt tak – hva bør vurderes?
- Hva påvirker prisen på takmaling?
- Når lønner det seg å impregnere takstein?

### Tilstand og vedlikehold

- Mose på taket: når er det et vedlikeholdsproblem?
- Kan alle typer tak høytrykksvaskes?
- Tegn på at takstein ikke bør males.
- Slik vurderes taket etter vinteren.
- Hvor tørt må taket være før impregnering eller maling?

### Sesong

- Når på året er det best å vaske taket?
- Planlegging av takarbeid før høstregnet.
- Vårkontroll av tak, takrenner og beslag.
- Hva frost og fukt gjør med eldre betongtakstein.

### Lokalt og prosjektbasert

- Takfornying i Ålesund og påvirkning fra kystklima.
- Dokumentert takvaskprosjekt: før, underveis og etter.
- Takmaling av et 240 m² tak – prosess og prisdrivere.
- Hvordan vegetasjon og skygge påvirker mosevekst i et konkret område.

## 14. Suksessmål

Baseline skal fastsettes i fase 0. Deretter følges:

- ikke-merkevareorganiske visninger;
- organiske klikk;
- antall søk med posisjon 1–3, 4–10 og 11–20;
- CTR per viktig side og søk;
- indekserte publiserte artikler;
- kvalifiserte organiske henvendelser;
- konverteringsrate fra artikkel til skjema-start og lead;
- antall artikler som må korrigeres vesentlig;
- kannibalisering eller fall på viktige tjenestesider;
- redaksjonell tid per godkjent artikkel.

Frekvens eller antall artikler alene er ikke et suksessmål.

## 15. Risikoer og mottiltak

| Risiko | Mottiltak |
| --- | --- |
| Tynt eller generisk AI-innhold | Originalt bevis, faglig kontroll og kvalitetsgrense |
| Feil pris eller garanti | Bruk bare godkjente data og blokker ukjente påstander |
| Kannibalisering | Intent- og likhetskontroll før utkast |
| Feil norsk | Norsk språkkontroll og menneskelig gjennomgang |
| For mange like lokalsider | Bare reelle områder med unikt lokalt innhold |
| Ustabil Trends-integrasjon | Offisiell API, kontrollert CSV eller manuell fallback |
| Persondata i AI-kontekst | Bruk bare anonymiserte spørsmål og aggregerte signaler |
| Indeksering uten verdi | Publiseringsport, Search Console-måling og konsolidering |
| AI oppgir falsk ekspertise | Synlig, ekte forfatter/kontrollør og godkjent kunnskapsbase |
| Cron lager duplikater | Idempotency-nøkkel per tema og uke |

## 16. Sikkerhet og personvern

- Search Console og andre integrasjoner skal bruke minste nødvendige lesetilgang.
- Hemmeligheter skal ligge i Vercel-miljøvariabler, aldri i Git.
- Rå kundehenvendelser skal ikke sendes til temageneratoren.
- Bare anonymiserte spørsmål og aggregerte frekvenser kan brukes.
- Bilder må ha dokumentert rett til bruk og nødvendig kundesamtykke.
- Private adresser skal ikke publiseres i prosjektartikler.
- AI-kjøringer skal ikke lagre telefon, e-post, adresse, meldinger eller bilder fra leads.

## 17. Avhengigheter og beslutninger før implementering

Før fase 1 starter, avklares:

1. Hvem er synlig forfatter og faglig kontrollør?
2. Hvem godkjenner utkast i Payload?
3. Skal engelsk blogg deaktiveres midlertidig eller være valgfri?
4. Har riktig Google-konto tilgang til Search Console Domain property?
5. Skal det søkes om Google Trends API alpha-tilgang?
6. Hvilke områder er bekreftet som reelt betjent, spesielt Ålesund og Møre og Romsdal?
7. Hvilke priser, produkter, garantier og formuleringer er godkjent for automatisk bruk?
8. Hvilke prosjektbilder kan brukes offentlig?
9. Hvilken kanal skal motta varsel om nye utkast?
10. Hvilken AI-leverandør og kostnadsgrense skal brukes?

## 18. Anbefalt implementeringsrekkefølge

1. Fase 0 – Search Console, sitemap og baseline.
2. Fase 1 – CMS-felter, statuser og norsk-først.
3. Fase 2 – artikkelmal, lenker, CTA, author/reviewer og schema.
4. Fase 3 – temainnhenting og poengmodell.
5. Fase 4 – AI-generator og kvalitetsporter.
6. Fase 5 – to ukentlige utkast og kontrollert publisering.
7. Fase 6 – rapportering og innholdsvedlikehold.
8. Fase 7 – 12 ukers pilot og beslutning om videre automasjon.

## 19. Definition of Done for hele oppgaven

Oppgaven er ferdig når:

- systemet velger relevante temaer fra godkjente kilder;
- to utkast kan opprettes automatisk per uke uten duplikater;
- AI kan ikke publisere direkte i pilotperioden;
- alle utkast går gjennom dokumenterte kvalitetsporter;
- redaktør kan forhåndsvise, godkjenne, avvise og planlegge;
- publiserte artikler har korrekt norsk, metadata, schema, sitemap, interne lenker og CTA;
- forfatter, faglig kontrollør, kilder og oppdateringsdato vises;
- organisk trafikk og leads kan måles per artikkel;
- systemet har sikker logging uten hemmeligheter eller persondata;
- 12-ukers piloten er evaluert og videre automasjonsnivå er besluttet.

## 20. Offisielle referanser

- Google: helpful, reliable, people-first content  
  https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google: generative AI content guidance  
  https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- Google: spam policies and scaled content abuse  
  https://developers.google.com/search/docs/essentials/spam-policies
- Google: Trends API alpha  
  https://developers.google.com/search/apis/trends
- Google: sitemap guidance  
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google: local ranking factors  
  https://support.google.com/business/answer/7091
