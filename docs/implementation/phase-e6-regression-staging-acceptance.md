# E6 — regresija, prieinamumas ir staging priėmimas

**Data:** 2026-08-26  
**Šaka:** `codex/master-platform-implementation`  
**Paskutinis patikrintas commit:** `afc4c5a`  
**Staging alias:** `https://takfornyelse-staging.vercel.app`  
**Vercel deployment:** `dpl_Ez1RnS2tSfoBtCqYN5FuU4n1p2fv`  
**Produkcija:** nekeista

## 1. Patikros rezultatas

Admin V2 bylos ergonomikos E0–E5 funkcijos sujungtos ir techninėje staging patikroje veikia kartu:

- viršuje rodoma pilna bylos suvestinė;
- slenkant po 64 px admin antrašte lieka 65–70 px kompaktiška bylos juosta;
- juosta rodo bylą, klientą, vykdomą versiją, galiojančią sutartį, sumą ir konkretų kitą veiksmą;
- mobiliajame vaizde juosta išskleidžiama ir neuždengia puslapio;
- pasiūlymų ir sutarčių `V1 → V2` grandinės rodo vykdomą, galiojančią ir istorines versijas;
- konkretūs dokumentai turi konkrečios versijos PDF bei techninės peržiūros nuorodas;
- ekonominiai ir sutartiniai veiksmai siunčia tikėtiną versiją/hash ir pasenęs kontekstas blokuojamas `409 STALE_COMMERCIAL_CONTEXT`;
- sėkmė, eilė, pasenęs kontekstas, timeout ir klaida administratoriuje atskiriami aiškiais rezultatais;
- po veiksmo read model automatiškai atnaujinamas.

## 2. Rastas ir pašalintas staging defektas

Pirmoje mobilioje 319 px patikroje dokumentų versijų grandinės grid elementas išplėtė visą puslapį iki 553 px. Matėsi horizontalus viso puslapio slinkimas.

Pataisyta `src/components/admin-v2/case-version-history.tsx`:

- grandinės grid elementams pridėtas `min-w-0`;
- horizontaliai slenkantis versijų konteineris apribotas `max-w-full`;
- leidžiamas tik lokalus grandinės slinkimas, o ne viso puslapio išplėtimas.

Pakartotinis staging rezultatas: 319/320/375/768/1280 px puslapiuose `document.scrollWidth === document.clientWidth`.

## 3. Responsive ir vizualinė matrica

| Dydis | Pradinė suvestinė | Sticky po slinkimo | Aukštis | Root horizontalus slinkimas |
|---|---|---|---:|---|
| 320×700 | PASS | top 64 px | 65 px | nėra |
| 375×812 | PASS | top 64 px | 65 px | nėra |
| 768×900 | PASS | top 64 px | 70 px | nėra |
| 1280×900 | PASS | top 64 px | 65 px | nėra |
| 1440×1000 | PASS | top 64 px | 65 px | nėra |

Mobilios išskleistos juostos rezultatas:

- aukštis padidėja tik vartotojui išskleidus;
- rodomas klientas, vykdoma ir galiojanti versija, suma bei konkretus CTA;
- uždarius grįžta į 65 px;
- root puslapio horizontalaus slinkimo nėra.

## 4. Byla ir dokumentų nuoseklumas

Staging byla `#15` patvirtino dabartinį `V1 → V2` kontekstą:

- vykdoma sutartis: `K-15-V2`;
- galiojanti sutartis: `K-15-V2`;
- būsena: pasirašyta abiejų šalių;
- suma su PVM: `17 647 NOK`;
- didžiausia kaina: `20 294 NOK`;
- avansas: `0 NOK`;
- pakeičia: `K-15-V1`;
- kitas veiksmas: `Sukurti darbo užsakymą K-15-V2`.

Versijų grandinėje atskirai pasiekiami:

- `T-15-V1` ir `T-15-V2` pasiūlymai;
- `K-15-V1` ir `K-15-V2` sutartys;
- istorinės ir galiojančios rolės;
- dokumento PDF, laikas, sumos, parašai ir paslėptas techninis hash.

Pasenusio skirtuko, dvigubo pateikimo ir klaidingos sutarties darbo sukūrimo apsauga patvirtinta maršrutų bei domeno testais. Šioje E6 read-only browser patikroje sąmoningai nebuvo dar kartą siunčiami klientų el. laiškai ar kuriami dublikatiniai darbai.

## 5. Prieinamumas ir kalbos

- vienas pagrindinis `h1`, toliau nuoseklūs `h2` ir `h3`;
- yra `main` landmark ir bylos `aside` su lokalizuota `aria-label`;
- nėra mygtukų ar nuorodų be teksto/accessible name;
- mobilus išskleidimas valdomas semantiniu `details/summary`;
- kalbų pasirinkime yra `Norsk`, `Lietuvių`, `English`;
- LT/NO/EN operaciniai tekstai dengiami unit testais;
- naršyklės konsolėje po staging peržiūros nebuvo klaidų.

## 6. Automatiniai patikrinimai

| Patikra | Rezultatas |
|---|---|
| Unit | 156 failai, 524 testai PASS |
| Migracijos | 19 failų, 32 testai PASS |
| TypeScript | PASS |
| ESLint | PASS |
| Vercel production-mode build | PASS |
| Vercel deployment | READY |
| Browser console errors | 0 |

Vercel build metu liko jau žinomi neblokuojantys perspėjimai apie būsimo `pg` SSL semantikos pakeitimą, Payload el. pašto adapterį build kontekste ir `private-media` storage adapterį. Jie nepakeitė build rezultato ir nėra šio ergonomikos paketo regresija.

## 7. Rollback

- prieš ergonomikos paketą: `411efa0`;
- paskutinė E5 funkcinė versija: `cb4399d`;
- galutinė E6 mobiliojo pločio pataisa: `afc4c5a`;
- staging alias nukreiptas į `dpl_Ez1RnS2tSfoBtCqYN5FuU4n1p2fv`;
- produkcija nebuvo deployinta ar perjungta.

## 8. Fazės vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
TECHNICAL_STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
OWNER_VISUAL_ACCEPTANCE=PENDING
PRODUCTION_GO=NOT_REQUESTED
```

Techninė E6 apimtis užbaigta. Galutinis savininko `GO` negali būti pažymėtas agento vardu; savininkui liko vizualiai peržiūrėti staging bylą ir atskirai nuspręsti dėl produkcijos.
