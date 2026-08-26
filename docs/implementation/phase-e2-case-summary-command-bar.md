# E2 — pilna bylos suvestinė ir prisegta valdymo juosta

**Data:** 2026-08-26  
**Aplinka:** vietinis build; produkcija nepakeista

## Įgyvendinta

- Bylos viršuje rodoma pilna komercinė suvestinė: klientas, paslauga, bylos būsena, atsakingas asmuo, vykdoma versija, galiojanti sutartis, kaina, maksimali kaina ir avansas.
- Po suvestine įdėta kompaktiška `sticky` valdymo juosta, kuri lieka po pagrindine administratoriaus antrašte.
- Desktop juosta rodo bylą, klientą, vykdomą ir galiojančią versijas, sumą, būseną bei kitą veiksmą.
- Telefono juosta yra 64 px minimalaus aukščio, rodo svarbiausią kontekstą ir leidžia laikinai išskleisti informaciją be atskiro pin nustatymo.
- Juostos CTA nuveda į aktualų `Kitas veiksmas`; sekcijoms pritaikytas didesnis `scroll-margin`, kad sticky elementai neuždengtų antraščių.
- Ilgi tekstai saugiai trumpinami, nėra fiksuoto pločio, todėl išvengiama horizontalaus slinkimo.
- Valdymas pasiekiamas klaviatūra, turi aiškias focus būsenas ir semantines etiketes.

## Patikra

- `npm run typecheck`: **PASS**
- `npm run lint`: **PASS**
- Produkcinis Next.js build su Windows x64 runtime: **PASS**
- Vietinė SQLite schema neturėjo staging lentelių, todėl build metu naudotas numatytas turinio fallback; kompiliacija ir visų maršrutų generavimas užbaigti sėkmingai.
- 320–375 px juostos struktūra naudoja vieną 64 px eilutę ir išskleidžiamą detalę; nuo 768 px aktyvuojama desktop tinklelio versija.

## Etapo vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PENDING_E6_VISUAL_AUDIT
ROLLBACK_READY=YES
E2_LOCAL_GO=YES
```
