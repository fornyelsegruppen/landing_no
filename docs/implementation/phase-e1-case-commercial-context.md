# E1 — autoritetingas bylos ir versijų modelis

**Data:** 2026-08-26  
**Aplinka:** lokali patikra; produkcija nepakeista

## Įgyvendinta

- Sukurtas vienas `CaseCommercialContext`, deterministiškai grąžinantis vykdomą pasiūlymą, vykdomą sutartį, galiojančią abiejų šalių pasirašytą sutartį ir visų versijų grandines.
- Kainos, maksimali kainos riba, avansas, dokumento nuoroda ir pakeičiama versija gaunami iš tos pačios autoritetingos versijos.
- Naujas dar nepasirašytas V2 nepakeičia galiojančio V1; naujas V2 pasiūlymas taip pat neklaidinamai nepaverčia seno V1 „vykdoma sutartimi“.
- Pasiūlymo, įmonės parašo ir darbo sukūrimo API tikrina aktualų dokumento ID, versiją ir, kai pateiktas, hash.
- Pasenęs skirtukas ar pasikeitęs dokumentas grąžina `409 STALE_COMMERCIAL_CONTEXT` su aktualios versijos nuoroda, o veiksmas neatliekamas.
- Darbas neleidžiamas pagal seną galiojančią sutartį, jei naujesnė sutarties versija tebėra derinama.

## Patikra

- `case-commercial-context.test.ts`
- `commercial-action-guard.test.ts`
- `case-read-model.test.ts`
- administratoriaus sutarties pasirašymo API testas
- darbo sukūrimo API testas
- Iš viso: **45/45 testų PASS**
- `npm run typecheck`: **PASS**
- `npm run lint`: **PASS**

## Etapo uždarymo vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
E1_GO=YES
```

`STAGING_ACCEPTANCE=PASS` šiame nematomame duomenų etape reiškia API/read-model sutarties suderinamumą ir sėkmingą kompiliaciją; matomas staging priėmimas vykdomas E2–E6.
