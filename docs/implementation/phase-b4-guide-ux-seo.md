# B4 — viešo gidų UX ir SEO nuoseklumas

**Data:** 2026-08-26  
**Pagrindinis commit:** `dbbce6f`  
**Viešo redaktoriaus pataisos commit:** `ca19851`  
**Staging deployment:** `dpl_uoTRNnm8gq2E2GnUGkB1CLF7YNhu`  
**Alias:** `https://takfornyelse-staging.vercel.app`

## Įgyvendinta

- Straipsnio grįžimo nuoroda ir schema suvienodinta į `Råd og guider` / `Advice & guides`.
- Katalogui pridėta `CollectionPage`, `ItemList` ir `BreadcrumbList` struktūrinė schema.
- Katalogo canonical turi NO, EN ir `x-default` alternatyvas.
- Straipsnio canonical/hreflang naudoja vieną lokalizacijos pagalbininką ir neprideda neegzistuojančio EN vertimo.
- Straipsnio Open Graph papildytas pakeitimo data ir autoriumi.
- Susijusių straipsnių sąraše gali būti tik redakciškai ir Payload lygmeniu publikuoti tos kalbos įrašai.
- Sitemap generatorius papildomai atmeta nepublikuotą įrašą net gavęs jį tiesiogiai.
- Pexels nuotolinis vaizdas priimamas tik kai ir domenas, ir tiekėjo žyma yra teisingi.
- Viešas redaktoriaus vardas niekada nerodo el. pašto; būsimi įrašai be display vardo gauna profesionalų fallback.
- Faktiniame staging straipsnyje:
  - ištaisytos dvi norvegų kalbos rašybos klaidos;
  - redaktoriaus el. paštas pakeistas į `Fagansvarlig i Takfornyelse`;
  - bendras SINTEF pradžios puslapis pakeistas konkrečiu oficialiu DIBK stogo priežiūros šaltiniu.

## Patikra

- Tiksliniai sitemap, susijusių įrašų, vaizdų, redaktoriaus, publikavimo, atribucijos ir navigacijos testai: 18 testų PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Vercel production-mode build: PASS, 72 puslapiai sugeneruoti.
- Katalogas: vienas H1, 2 published įrašai, `CollectionPage` ir `BreadcrumbList`, canonical bei NO/EN/x-default alternatyvos.
- Faktinis straipsnis: vienas H1, `BlogPosting`, `WebPage`, `BreadcrumbList`, `FAQPage`, NO canonical ir tik NO/x-default hreflang.
- Faktinio straipsnio CTA atidaro `/no#kontakt`; content-source perdavimas užrakintas unit ir pilno kelio testais.
- Sitemap turi katalogą ir 2 NO published straipsnius, bet neturi tuščių EN straipsnių.
- Turinio pakeitimai tapo vieši per ISR be rankinio redeploy.
- Viešo puslapio redaktorius ir schema rodo tą patį profesionalų vardą.
- Staging naršyklės klaidų: 0; horizontalaus slinkimo nėra.
- Produkcija nepakeista.

## Fazės vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
