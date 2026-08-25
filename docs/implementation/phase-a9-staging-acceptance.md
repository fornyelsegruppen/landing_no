# A9 — Staging priėmimas ir produkcinė gate

**Būsena:** staging techninė ir vizualinė gate praėjo 2026-08-25; Production gate lieka uždaryta iki atskiro savininko patvirtinimo.

## Priimta versija

- Git šaka: `codex/master-platform-implementation`;
- priėmimo commit: `1fe53d0`;
- Vercel Preview: `dpl_8mimMugGAKBVLdioogeD26wikshR`;
- stabilus staging adresas: `https://takfornyelse-staging.vercel.app`;
- galutinis Preview adresas: `https://landing-b85kgjhdf-darbasnorvegija4-8212s-projects.vercel.app`;
- Vercel būsena: `Ready`, target `preview`.

Production deploy nebuvo vykdomas.

## Automatinė patikra

- `npm run typecheck` — praėjo;
- `npm run lint` — praėjo be perspėjimų;
- `npm run test:ci:unit` — 118 testų failų / 373 testai praėjo;
- `npm run test:ci:migrations` — 13 migracijų failų / 25 testai praėjo;
- Vercel Linux production build — praėjo, sukompiliuoti visi vieši, administratoriaus, kliento ir darbuotojo maršrutai;
- staging migracijos — įvykdytos be klaidų;
- naršyklės konsolė tikrintuose `/admin-v2` ir viešuose puslapiuose — klaidų bei perspėjimų nėra.

Anoniminis Playwright CLI bandymas į stabilų staging domeną buvo nukreiptas į Vercel Deployment Protection prisijungimą. Tai nėra aplikacijos regresija. Dėl to autentifikuota vizualinė ir būsenų patikra atlikta prisijungusioje staging naršyklėje, naudojant tą patį Playwright DOM sluoksnį.

## Autentifikuota administratoriaus patikra

Patikrintos visos kasdienės custom administratoriaus skiltys:

1. `/admin-v2`;
2. `/admin-v2/cases`;
3. `/admin-v2/offers`;
4. `/admin-v2/contracts`;
5. `/admin-v2/work`;
6. `/admin-v2/documents`;
7. `/admin-v2/archive`;
8. `/admin-v2/blog`;
9. `/admin-v2/employees`;
10. `/admin-v2/settings`.

Visi pagrindiniai punktai lieka custom aplinkoje. Payload rodomas tik suskleistame techniniame fallback. Administratoriaus kalba LT patikrinta; klientų laiškai, pasiūlymai ir sutartys lieka norvegų kalba.

## Bylos ir proceso įrodymai

### Dabartinės eigos byla Nr. 8

Vienoje custom byloje patikrinta:

- gauta užklausa ir išsiųstas profiliuotas gavimo patvirtinimas;
- DI santrauka be trūkstamų duomenų;
- `TM-8-V1`, `high` patikimumas ir patvirtintas 93,5–102,3 m² intervalas;
- deterministinė kaina, PVM ir maksimali sutarties kaina;
- priimtas `T-8-V1` pasiūlymas;
- išsiųstos pasiūlymo, kliento parašo gavimo ir galutinės sutarties žinutės;
- `K-8-V1` pasirašyta kliento ir Takfornyelse;
- sukurtas `A-K-8-V1` darbo užsakymas;
- kitas veiksmas tiksliai rodomas kaip darbuotojo paskyrimas;
- dokumentai ir paspaudžiama laiko juosta rodomi toje pačioje byloje.

### Darbuotojo užbaigimo įrodymas

Sintetinė byla Nr. 2 turi dokumentuotą darbuotojo kelionę: paskyrimą, datą, prieš ir po nuotraukas, patvirtintą matavimą, užbaigtą darbą ir išsiųstą baigiamųjų dokumentų žinutę. Ši byla sukurta iki R6 kontraparašo taisyklės, todėl jos istorinis sutarties statusas nenaudojamas naujos eigos teisinei gate įrodyti. Naujos bylos darbo kūrimas leidžiamas tik po abiejų šalių parašų; tai padengta domeno ir API regresijos testais bei dabartine byla Nr. 8.

## Desktop, telefonas ir prieinamumas

- vieša `/no` svetainė patikrinta 390×844 ir 1440×900 dydžiais;
- `/admin-v2/cases/8` patikrinta tais pačiais dydžiais;
- horizontalaus puslapio slinkimo reikšmė abiem dydžiais yra `0`;
- administratoriaus puslapyje nėra baltų fonų ar baltų didelių paviršių;
- ilgi PDF failų vardai, darbuotojo planavimo laukai ir ilgi el. laiškų tekstai nebeišplečia puslapio;
- visiems administratoriaus nuorodų, mygtukų, formų laukų ir `summary` elementams įdėtas vienodas aiškus geltonas `focus-visible` kontūras;
- mobilus meniu, kalbos pasirinkimas, veiksmo kortelės ir skilties navigacija išlieka pasiekiami;
- viešoje svetainėje patvirtintos 99, 138 ir 337 kainos, užklausos forma ir pagrindiniai CTA.

## A9 metu rasti ir ištaisyti defektai

1. Per silpnas arba nematomas klaviatūros fokusas custom administratoriaus nuorodose — ištaisyta `967bc46`.
2. Ilgi dokumentų pavadinimai ir siauras darbo planavimo blokas sukėlė desktop slinkimą — ištaisyta `74686f4`.
3. Ilgos kliento žinutės ir URL sukėlė telefono slinkimą — ištaisyta `1fe53d0`.

Po paskutinio diegimo desktop ir telefono slinkimas pakartotinai išmatuotas kaip `0`, o konsolės klaidų nėra.

## Rollback ir Production apsauga

- nuotolinis GitHub tag `backup-live-before-master-2026-08-23^{}` rodo į `380f64d`, tą patį commit kaip dabartinis `upstream/main`;
- atskiras rollback tag `rollback/pre-custom-admin-r1-2026-08-24` išsaugo vėlesnį techninį kontrolinį tašką;
- A0–A9 darbai lieka atskiroje `codex/master-platform-implementation` šakoje;
- staging turi atskirą duomenų bazę ir Preview secrets;
- jokio `vercel --prod`, `main` merge arba produkcinės duomenų bazės pakeitimo neatlikta.

## Gate sprendimas

A0–A9 kodas, duomenų schema, custom administratoriaus aplinka ir staging vizualinė patikra yra užbaigti. Kritinių arba aukšto prioriteto techninių defektų nenustatyta.

Toliau reikalingas tik atskiras savininko sprendimas dėl Production publikavimo. Prieš jį savininkas staging aplinkoje gali dar kartą peržiūrėti bylą Nr. 8, dokumentus ir darbo paskyrimą. Production publikavimas nėra šios gate dalies automatinis veiksmas.
