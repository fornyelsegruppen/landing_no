# E4 — kontekstinis veiksmas ir kontrolinė suvestinė

**Data:** 2026-08-26  
**Aplinka:** lokali patikra; produkcija nepakeista

## Įgyvendinta

- Pagrindinis CTA dabar įvardija konkretų dokumentą: pvz. `Patvirtinti pasiūlymą T-15-V2`, `Pasirašyti sutartį K-15-V2`, `Sukurti darbo užsakymą K-15-V2`.
- Prieš CTA matoma kontrolinė suvestinė: klientas, paslauga, dokumentas, kaina su PVM, maksimali kaina, avansas ir pakeičiama versija.
- Pasiūlymo veiksmai į API siunčia laukiamą ID, versiją ir hash; įmonės parašas siunčia sutarties versiją ir hash; darbo sukūrimas siunčia sutarties ID, versiją ir hash.
- Bylos lygio veiksmai siunčia laukiamą `caseRevision`; pasikeitus bylai kitas skirtukas gauna `409 CASE_REVISION_CONFLICT`.
- Ekonominiai, sutartiniai ir darbo sukūrimo veiksmai prieš vykdymą pateikia paskutinį patvirtinimą su konkrečiu veiksmo/dokumento pavadinimu.
- Įmonės parašo laukas LT/NO/EN aiškiai nurodo, kad tai Takfornyelse vardu pasirašantis asmuo.
- Dvigubo paspaudimo metu valdikliai lieka išjungti per esamą `busy` būseną.

## Patikra

- Pasenusio pasiūlymo skirtuko API testas grąžina aiškų `409` ir aktualią V3 nuorodą: **PASS**.
- Aktualaus V2 versija ir hash perduodami prieš siuntimą: **PASS**.
- Sutarties parašo ir darbo sukūrimo guard testai: **PASS**.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.

## Etapo vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PENDING_E6_UAT
ROLLBACK_READY=YES
E4_LOCAL_GO=YES
```
