# B2 — vieninga „Råd og guider“ navigacija

**Data:** 2026-08-26  
**Pagrindinis commit:** `e9988e6`  
**Responsive pataisos commit:** `43b0f7c`  
**Staging deployment:** `dpl_DYKUSEj5CH9PYrw8TMC9mibCzQgU`  
**Alias:** `https://takfornyelse-staging.vercel.app`

## Įgyvendinta

- Sukurtas vienas `withGuideNavigation` pagalbininkas desktop, mobile ir footer navigacijai.
- Nuoroda visada pridedama, kai CMS meniu jos neturi.
- `/blogg`, lokalizuoti ir tos pačios svetainės absoliutūs URL atpažįstami ir sujungiami į vieną nuorodą.
- Išoriniai URL, kurie tik baigiasi `/blogg`, nėra klaidingai laikomi vidine nuoroda.
- Vartotojo pavadinimas suvienodintas:
  - NO: `Råd og guider`;
  - EN: `Advice & guides`.
- Nuoroda lokalizuojama į `/no/blogg` arba `/en/blogg`.
- Footer pašalintas ankstesnis dubliuojantis `Takguide` pavadinimas.
- Ilgas angliškas CTA mobiliajame ekrane gali persikelti į kelias eilutes ir nebesukelia horizontalaus slinkimo.

## Patikra

- Navigacijos ir publikavimo pagalbininkų testai: 5 testai PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Vercel production-mode build: PASS, 72 puslapiai sugeneruoti.
- NO responsyvi patikra: 320, 375, 768, 1280 ir 1440 px — horizontalaus slinkimo nėra.
- EN responsyvi patikra: 320 ir 375 px — horizontalaus slinkimo nėra.
- NO ir EN puslapiuose matoma lokalizuota nuoroda į teisingą katalogą.
- Desktop, mobile ir footer naudoja tą pačią deduplikavimo logiką.
- Produkcija nepakeista.

## Fazės vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
