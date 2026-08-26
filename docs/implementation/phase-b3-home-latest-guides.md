# B3 — naujausi gidai pagrindiniame puslapyje

**Data:** 2026-08-26  
**Commit:** `8751943`  
**Staging deployment:** `dpl_Eixy3NS4KVNSWpWAY4dc5p6XEYu2`  
**Alias:** `https://takfornyelse-staging.vercel.app`

## Įgyvendinta

- Pagrindiniame puslapyje prieš galutinį kontaktų CTA pridėtas serverinis naujausių gidų blokas.
- Rodomi daugiausia trys naujausi konkrečiai kalbai tinkami įrašai.
- Įrašas pakartotinai tikrinamas pagal abu viešo publikavimo vartus: Payload ir redakcinę būseną.
- Kortelėje rodoma kategorija, publikavimo data, pavadinimas, santrauka ir lokalizuota nuoroda.
- Hero vaizdui naudojamas įkeltas `card` dydis arba patvirtintas `images.pexels.com` URL.
- Kai vaizdo nėra, rodoma stabili firminė iliustracinė kortelė be neveikiančio paveikslo.
- Kai konkrečia kalba publikuotų straipsnių nėra, visa sekcija paslepiama ir nepalieka tuščio bloko.
- Pagrindinio puslapio CMS ir naujausių gidų užklausos vykdomos lygiagrečiai.
- Straipsnio puslapis ir pagrindinio puslapio kortelė naudoja tą patį saugų vaizdo parinkimo pagalbininką.

## Patikra

- Naujausių gidų, navigacijos ir publikavimo testai: 9 testai PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Vercel production-mode build: PASS, 72 puslapiai sugeneruoti.
- NO pagrindiniame puslapyje rodomi 2 faktiniai published įrašai teisinga naujausio-pirmiausia tvarka.
- EN pagrindiniame puslapyje sekcija nerodoma, nes nėra pilnai publikuotų EN vertimų.
- `Se alle råd og guider` atidaro `/no/blogg` ir teisingą katalogo H1.
- 320 ir 1440 px patikroje horizontalaus slinkimo nėra; 320 px kortelės rodomos viena kolona.
- Staging naršyklės klaidų: 0.
- Produkcija nepakeista.

## Fazės vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
