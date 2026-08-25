# F4 — matavimo įrodymas pasiūlyme, sutartyje ir PDF

**Data:** 2026-08-25  
**Aplinka:** staging `https://takfornyelse-staging.vercel.app`  
**Commit:** `c46661c`  
**Deployment:** `dpl_6oowDfiN9f9haf2y1kGzVbadeJiE`  
**Rezultatas:** GO

## Pasiektas rezultatas

- Pasiūlymo `quote-v2` snapshot išsaugo matavimo režimą, pastato identifikatorių, plotą, nuolydį, įrodymo media ID, SHA-256 hash, atribuciją ir administratoriaus patvirtinimą.
- Sutarties `contract-v2` snapshot įšaldo tą patį pasiūlymo ir matavimo snapshot; sena `v1` schema toliau perskaitoma.
- Kliento peržiūra ir PDF rodo tą pačią matavimo versiją bei vizualinį priedą.
- Prieš PDF generavimą privatus vizualas perskaitomas, patikrinamas jo SHA-256 ir SVG saugiai rasterizuojamas į PNG.
- Sugadintas arba pakeistas vizualas blokuoja dokumento generavimą.
- `manual_no_visual` režimas dokumentuojamas be žemėlapio vaizdo, su ploto šaltiniu, pagrindimu, patvirtinusiu administratoriumi ir laiku.
- Nauja matavimo versija automatiškai perskaičiuoja kainą, sukuria naują pasiūlymo ir sutarties juodraštį bei pakeičia ankstesnį aktyvų juodraštį.
- Išleistas ar priimtas pasiūlymas nebeleidžia paprasto matavimo perrašymo — reikalingas kontroliuojamas pakeitimo susitarimas.

## Automatinė verifikacija

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run test:ci:unit` — PASS, 129 failai / 421 testas.
- `npm run test:ci:migrations` — PASS, 16 failų / 28 testai.
- Vietinis `npm run build` — TypeScript ir kompiliacija PASS; Windows ARM64 puslapių surinkimą sustabdo anksčiau dokumentuota neprivaloma `@libsql/win32-arm64-msvc` biblioteka.
- Oficialus Vercel Linux build — PASS, 67 statiniai puslapiai ir visi dinaminiai maršrutai sugeneruoti.

## Staging priėmimas

### Vizualus kelias

- Sintetinė byla: `#10`, be tikro kliento.
- Rasti 8 OSM pastatų kandidatai; pasirinktas pagrindinis namas.
- Sukurta `TM-10-V5`, matoma scheminė įrodymo iliustracija.
- Automatiškai sukurti `T-10-V2` ir `K-10-V2`; ankstesnė dokumentų versija pažymėta pakeista nauja versija.
- `/api/admin/quotes/9/pdf` grąžino PDF `Tilbud og kontrakt K-10-V2` su vizualiu įrodymu.

### Rankinis kelias

- Įvestas 130 m² rankinis plotas, skirtumas viršijo 20 %.
- Pirmas bandymas buvo blokuotas ir pareikalavo aiškaus papildomo patvirtinimo.
- Po patvirtinimo sukurta `TM-10-V6`, `T-10-V3` ir `K-10-V3`.
- `/api/admin/quotes/10/pdf` grąžino PDF `Tilbud og kontrakt K-10-V3` be vizualinio priedo, su rankinio matavimo paaiškinimu.

### Konfigūracijos patikra

Pirmas deployment buvo atliktas be F1–F3 staging feature flag reikšmių. Staging išsaugojimo vartas tai aptiko ir operaciją sustabdė. Deployment pakartotas aiškiai įjungus:

- `FEATURE_CASE_STATE_ENGINE_V2=true`
- `FEATURE_MEASUREMENT_EVIDENCE_V2=true`
- `FEATURE_ADMIN_EXCEPTION_FLOWS_V2=true`

Pakartotas identiškas scenarijus praėjo. Nesėkmingo bandymo matavimo versija liko audituojama ir vėliau buvo saugiai superseded; aktyvi byla naudoja tik naujausią versiją.

## Žinomi apribojimai

- Staging kliento el. laiško gavimas F4 metu nekartotas, nes tai atskirai pilnai tikrinama F6 komunikacijos fazėje.
- Sintetinė byla palikta audito istorijai; F9 testinių duomenų valymas turi ją archyvuoti.
- Produkcija nepakeista.

## Fazės vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
