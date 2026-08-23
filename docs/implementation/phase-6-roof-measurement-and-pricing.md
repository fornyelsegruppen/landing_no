# Fase 6 – adresse, takmåling og deterministisk pris

Dato: 23. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat

Det er etablert en versjonert, revisjonssikker måle- og prisflyt. Kartverket normaliserer adresser, AI kan foreslå bygg/polygon/vinkel fra et lisensiert privat målebilde, mens kode alene beregner geometri, skrått areal, mva., toleranse og pris. Administrator må kontrollere og godkjenne målingen. Lav confidence, manglende bygg, ukjent vinkel, manglende lisensgrunnlag eller manglende godkjent prisregel blokkerer godkjenning – også via Payloads vanlige collection-API.

## Offisielle datakilder og vilkår

- Adresseoppslag bruker Kartverkets åpne Adresse REST-API mot Matrikkelen. Tjenesten krever ikke registrering og data oppdateres normalt daglig: [Kartverkets brukerveiledning](https://www.kartverket.no/api-og-data/eiendomsdata/brukarrettleiing-adresse-api).
- Åpne Kartverket-produkter er normalt CC BY 4.0 og skal krediteres `© Kartverket`: [vilkår for bruk](https://www.kartverket.no/api-og-data/vilkar-for-bruk).
- Flyfoto og detaljerte kart har særvilkår. Skjermbilder fra Norgeskart/Norge i bilder kan brukes med korrekt kreditering, men automatisert WMS/WMTS-tilgang behandles separat.
- Nye Norge i bilder WMS/WMTS-tjenester krever token og tilgang gjennom GeoID/Norge digitalt eller egen avtale: [Norge i bilder-tjenester](https://www.geonorge.no/nib).

Systemet bruker derfor aldri skjult nettleserautomatisering eller scraping som produksjonsavhengighet. Automatisk ortofoto er `configuration_required` til `NORGE_I_BILDER_TOKEN` og datert `MAP_TERMS_ACCEPTED_AT` finnes i hostingens secret/config-lager.

## Leveranser

### Adresse og bildegrunnlag

- `KartverketAddressProvider` validerer input, bruker timeout og mapper offisielle adressepunkter til en intern leverandøruavhengig kontrakt;
- full kunde­adresse sendes ikke til Gemini – bare geografisk anker og det godkjente private målebildet;
- privat bilde må være klassifisert som `measurement`, ha støttet MIME-type og være under 10 MB;
- kilde, URL, lisens, kreditering, hentetidspunkt og privat kartbilde lagres på måleversjonen;
- automatisk bildeflyt krever både teknisk token og eksplisitt registrert vilkårsgodkjenning.

### Takmåling

- ny `roof-measurements`-samling med lead, versjon, forrige versjon, normalisert adresse, koordinat, bygg-ID, flere takflater, vinkelintervall, confidence, begrunnelse og godkjenningsspor;
- AI-output valideres strengt og får bare foreslå bygg, polygon, vinkelintervall, confidence og begrunnelse;
- polygon må ha 3–30 gyldige punkter, kan ikke krysse seg selv og må være innenfor et rimelig takareal;
- georeferert horisontalflate beregnes lokalt i meter;
- hver takflate beregnes med `1 / cos(vinkel)`, råverdier summeres og sluttsummen avrundes én gang til 0,1 m²;
- admin får SVG-forhåndsvisning, kontrollhandlinger og må opprette ny versjon ved polygon-/vinkelendring;
- en godkjent måling er uforanderlig; direkte redigering av låste felt avvises.

### Pris

- ny `price-rules`-samling med tjeneste, versjon, enhetspris eks. mva. i øre, mva. i basispunkter, minstepris, toleranse, valgfri makspris, gyldighet og vilkårsversjon;
- markedsføringsprisene 99/138/337 kr/m² er ikke automatisk gjort til bindende prisregler;
- prisregel kan bare godkjennes av aktiv administrator, og godkjent innhold kan ikke endres i samme versjon;
- ny uforanderlig `price-calculations`-samling lagrer hele input/output-snapshot og hash;
- alle penger beregnes i heltalls-øre, aldri binær flyttallspresisjon;
- AI kan generere forklaring, men teksten avvises dersom den introduserer et tall som ikke finnes i den låste beregningen.

## Migrasjoner

- `20260823_171411_phase6_measurement_pricing` oppretter alle tre samlinger, indekser og relasjoner;
- `20260823_172422_phase6_measurement_license_evidence` legger til eksplisitt lisenskontroll;
- obligatoriske relasjoner bruker kontrollert cascade/restrict i stedet for ugyldig `SET NULL`;
- rollback fjerner låserelasjoner og avhengige tabeller i riktig rekkefølge;
- `up` og `down` er kjørt mot ekte in-process PostgreSQL via PGlite.

## Verifikasjon og Gate 6

| Kontroll | Resultat |
|---|---|
| Full Vitest-regresjon | 64 filer, 185 tester bestått før siste dokumentasjonsendring; avsluttende regresjon kjøres på commit-punktet |
| Obligatoriske faktorer 22/27/32/36/40/45° | Bestått |
| Flere takflater og én sluttavrunding | Bestått |
| Selv-kryssende/ugyldig polygon | Avvist |
| Høy/middels/lav confidence | Riktig draft/review/blokkert |
| Lav confidence via collection-API | Blokkert i hook og test |
| Samme låste input | Identisk hash og prisresultat |
| Penger/mva. uten flyttallsfeil | Bestått |
| AI med oppdiktet tall | Avvist |
| Godkjent måling/prisregel endres i samme versjon | Avvist |
| Migrasjoner up/down | Bestått |
| TypeScript | Bestått |
| Produksjonsbuild | Bestått; 57 statiske sider og nye måle-API-ruter kompilert |

Gate 6 er teknisk bestått. Produksjonsflagget for automatisk takmåling forblir avslått til punktene nedenfor er gjennomført i staging.

## Produksjonsblokkere

- inngå og dokumenter rett til Norge i bilder WMS/WMTS, opprett GeoID/token og registrer `MAP_TERMS_ACCEPTED_AT`;
- opprett faktiske prisregler i admin og godkjenn dem etter intern økonomisk kontroll; ingen markedsføringspris brukes automatisk;
- godkjenn prisvilkår, toleranse og maksimalbeløpsregel juridisk/kommersielt;
- kontroller tre representative eiendommer mot kjent fysisk måling før pilot;
- kjør autentisert admin-smoke med privat testbilde i staging;
- `FEATURE_ROOF_MEASUREMENT` skal først slås på etter denne kontrollen.

