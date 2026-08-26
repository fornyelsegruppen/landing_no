# B1 — blogo publikavimo ir matomumo sauga

**Data:** 2026-08-26  
**Commit:** `ad54eb1`  
**Staging deployment:** `dpl_75RzKTprTSPnFRykds5Yh8xAMcbA`  
**Alias:** `https://takfornyelse-staging.vercel.app`

## Įgyvendinta

- Sukurtas vienas autoritetingas `publishedPostWhere` filtras.
- Viešas įrašas dabar privalo turėti abi būsenas:
  - Payload `_status = published`;
  - redakcinę `editorialStatus = published`.
- Filtras naudojamas:
  - viešam straipsnių sąrašui;
  - tiesioginei slug užklausai;
  - `getPublishedPosts` ir sitemap šaltiniui;
  - anoniminei Payload `posts` read prieigai.
- Autorizuotas preview ir toliau gali skaityti draft versiją.
- Pridėti unit testai visoms redakcinėms būsenoms ir vienodam query formatui.

## Patikra

- `publication-visibility`, editorial policy, publishing flow ir sitemap: 14 testų PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Vercel production-mode build: PASS, 72 puslapiai sugeneruoti.
- Staging katalogas vis dar rodo du published įrašus ir nerodo `Draft` žymų.
- Sintetinis nepublikuoto/neegzistuojančio įrašo URL grąžina firminį 404 ir neatskleidžia turinio.
- Staging browser console klaidų: 0.
- Produkcija nepakeista.

## Fazės vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
