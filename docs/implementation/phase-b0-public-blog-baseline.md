# B0 — viešo blogo baseline ir rollback

**Data:** 2026-08-26  
**Šaka:** `codex/master-platform-implementation`  
**Baseline commit:** `2b35ab56ab0f6cfda43e73320d78cbcb271f7be5`  
**Rollback tag:** `pre-public-blog-integration-2026-08-26`  
**Staging:** `https://takfornyelse-staging.vercel.app`  
**Produkcija:** nekeista

## Faktinė būsena

- `/no/blogg` veikia ir turi H1 `Takguide for boligeiere`.
- Viešai rodomi du administratoriaus publikuoti NO straipsniai:
  - ID `1`, `takfornying-alesund-kystklima`;
  - ID `2`, `sjekk-tak-etter-vinter`.
- Abu įrašai `/admin-v2/blog` rodomi `PUBLIKUOTA`, kokybės balas `86`.
- Staging bazėje B0 metu nėra draft ar scheduled straipsnio. B1 draft sauga tikrinama izoliuotais testiniais dokumentais; B6 galima sukurti aiškiai pažymėtą staging juodraštį, jei reikia faktinei preview kelionei.
- Kataloge papildomai veikia šešios statinės temų kortelės.
- Desktop ir mobile header neturi `/blogg` nuorodos.
- Home neturi naujausių straipsnių bloko ar `/blogg` nuorodos.
- Pagrindinis footer turi `/no/blogg`, bet pavadinimas yra `Takguide`.
- Faktinis Payload `Site Settings → Navigation` sąrašas yra tuščias, todėl staging naudoja built-in fallback meniu.
- `/no/blogg` B0 patikroje neturėjo root horizontalaus slinkimo.
- Staging XML tiesioginis CLI tikrinimas nukreipiamas į Vercel protection login; sitemap turinys B1–B6 tikrinamas autorizuotu/automatiniu būdu, nevertinant login HTML kaip sitemap.

## Pasirinkti testiniai duomenys

- Published kelionei: `takfornying-alesund-kystklima`.
- Antram published ir rikiavimo scenarijui: `sjekk-tak-etter-vinter`.
- Draft saugos testui: izoliuotas test fixture, nes baseline staging neturi nepublikuoto įrašo.

## Rollback

```text
git switch codex/master-platform-implementation
git revert <blog-integration-commits-newest-first>
```

Arba perkelti staging alias atgal į prieš blogo integraciją patikrintą deployment. Produkcija B0 metu nepakeista.

## Fazės vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
