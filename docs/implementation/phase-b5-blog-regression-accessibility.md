# B5 — blogo regresija, prieinamumas ir performance

**Data:** 2026-08-26  
**Aplinka:** tik Vercel Preview / staging  
**Commit:** `3d0ed0e`  
**Deployment:** `dpl_FszRRLA8tnPw5CV4MrQwZT9rNbjY`  
**Preview:** `https://landing-gw6kahmcw-darbasnorvegija4-8212s-projects.vercel.app`  
**Staging alias:** `https://takfornyelse-staging.vercel.app`

## Automatiniai vartai

| Patikra | Rezultatas |
|---|---|
| `npm run test:ci:unit` | PASS — 160 failų, 536 testai |
| `npm run test:ci:migrations` | PASS — 19 failų, 32 testai |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| Vercel production build Preview aplinkoje | PASS — 72 statiniai puslapiai sugeneruoti, TypeScript PASS |

ARM kompiuteryje viena PGlite integracinė migracija stabiliai užtruko apie 7 sekundes, todėl tik šiam testui nustatytas 15 sekundžių limitas. Testo logika nekeista; izoliuotas ir visas migracijų rinkinys po pakeitimo PASS.

## Responsive ir prieinamumo matrica

Patikrinti puslapiai:

- `/no`;
- `/en`;
- `/no/blogg`;
- `/en/blogg`;
- `/no/blogg/takfornying-alesund-kystklima`.

Kiekvienas puslapis patikrintas ties `320`, `375`, `768`, `1280` ir `1440` px — iš viso 25 kombinacijos.

Visose kombinacijose:

- tik vienas H1;
- nėra horizontalaus puslapio perslinkimo;
- nėra vaizdų be `alt` atributo;
- nėra tuščių nuorodų ar mygtukų be prieinamo vardo;
- `Råd og guider` / `Advice & guides` atrandama viešoje navigacijoje;
- mobilusis meniu atsidaro kaip semantinis išskleidžiamas mygtukas, gauna matomą fokusą ir rodo blogo nuorodą.

## Viešas blogas ir SEO

- NO pagrindiniame puslapyje matomi du realiai publikuoti straipsniai.
- EN pagrindiniame puslapyje neparodomos nepilnos ar neegzistuojančios EN straipsnių versijos.
- `/no/blogg` ir `/en/blogg` veikia su lokalizuotais pavadinimais.
- Faktinis NO straipsnis veikia mobile ir desktop, turi vieną H1, CTA, alt tekstus ir be konsolės klaidų.
- Sitemap turi abu katalogo URL ir tik dvi viešas NO straipsnių versijas; EN straipsnių URL nėra.
- Navigacijos pagalbinė funkcija testais įrodo sisteminės blogo nuorodos pridėjimą bei dublių pašalinimą.
- `getSiteContent` klaidos šaka grąžina projekto fallback turinį, todėl CMS sutrikimas nepašalina bazinio turinio; vieša blogo nuoroda po to deterministiškai pridedama navigacijos pagalbine funkcija.

## Performance patikra

- naujausias gidų blokas yra serverinis komponentas ir neprideda naujos `use client` ribos;
- kortelių vaizdai naudoja `next/image`, responsive `sizes` ir nėra žymimi `priority`;
- be hero vaizdo naudojamas vietinis CSS/SVG fallback, todėl nėra broken image ar papildomos nuotolinės užklausos;
- Vercel build užbaigtas be kompiliavimo ar puslapio generavimo klaidų.

## Admin V2 read-only regresija

Prisijungus staging aplinkoje patikrinta:

- `/admin-v2` — apžvalgos skaitikliai ir eilės matomos;
- `/admin-v2/cases/15` — aktyvi `K-15-V2` byla, galiojanti sutartis, suma ir kitas veiksmas rodomi vienoje darbo aplinkoje;
- `/admin-v2/blog` — du publikuoti straipsniai matomi ir turi redagavimo kelią.

Visi trys puslapiai turi vieną H1, neturi horizontalaus perslinkimo ir naršyklės klaidų.

## Žinomi neblokuojantys build perspėjimai

Vercel build pakartojo anksčiau buvusius Payload perspėjimus dėl nenaudojamo bendro email adapterio ir `private-media` storage adapterio. Viešo blogo paketas jų nesukūrė, viešų vaizdų ar straipsnių veikimo jie neblokuoja. Prieš produkcijos paleidimą jie lieka bendro infrastruktūros checklist dalimi.

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
SECURITY_AND_PRIVACY=PASS
ROLLBACK_READY=YES
NEXT_PHASE_ALLOWED=YES
```
