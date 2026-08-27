# Incidentas — administratoriaus bylos peržiūros žymos 500

Data: 2026-08-28
Būsena: **LOKALI PATAISA PASS — laukiama Preview ir Linux CI įrodymo**
Prioritetas: **P1 administravimo darbo eigos tikslumui; nėra viešos svetainės sutrikimo**

## Santrauka

Production žurnaluose užfiksuoti du `POST /api/admin/leads/10` atsakymai su HTTP 500. Abu įvykiai sekė iškart po sėkmingo `GET /admin-v2/cases/10` ir atitinka kliento komponento `CaseViewedMarker` automatinį veiksmą `mark_reviewed`.

Vieša svetainė, prisijungimas ir bylos skaitymas veikia. Bylos komercinė grandinė, dokumentai, parašai ir darbo užsakymo informacija nebuvo pakeisti šių nesėkmingų užklausų metu.

## Įrodymai

- aktyvus Production deployment: `dpl_CvS7U3tgY16XmLss8aAciiKtZzK5`;
- aktyvus commit: `9c8f29b`;
- ankstesnis READY rollback kandidatas: `dpl_FQW24KoJryQ3iAw1gRd3qrWWQ4bi`;
- GitHub Quality Gate run `33116393482`: `PASS`;
- vieši patikrinimai `/no`, `/no/blogg`, `/admin/login`: HTTP 200;
- 500 koreliacijos:
  - `735ad8b6-280d-4e2c-bf40-c51d849b4cde`;
  - `d9c97bee-f570-4d6d-9546-07a654959d04`;
- read-only Production DB patikra parodė:
  - `leads.id = 10` turi `admin_reviewed_at = NULL` ir `admin_reviewed_by_id = NULL`;
  - nėra `lead.mark_reviewed` audito įrašo;
  - būtinos DB kolonos, indeksai, FK ir migracijos yra įdiegtos;
  - galiojantys administratoriaus vartotojų ID egzistuoja.

## Poveikis

- byla nėra pažymima kaip pirmą kartą peržiūrėta;
- `new-leads` skaitiklis ir eilė gali rodyti jau peržiūrėtą bylą kaip naują;
- administratorius gali matyti netikslų darbų prioritetą;
- kliento dokumentų, sutarčių, parašų, kainos ir komunikacijos turinys nuo šio gedimo nenukenčia.

## Tikėtina vykdymo vieta

1. `src/components/admin-v2/case-viewed-marker.tsx` atidarius neperžiūrėtą bylą siunčia `POST` su `action: mark_reviewed`.
2. `src/app/api/admin/leads/[id]/route.ts` bando įrašyti `adminReviewedAt` ir `adminReviewedBy`, tada sukurti audito įvykį.
3. Production duomenys rodo, kad operacija nepasiekė patvaraus įrašo.

Vercel žurnale klaida sąmoningai sanitarizuota iki `Error`, todėl tiksli išimties žinutė šiuo metu neužfiksuota. Dėl to priežasties negalima sąžiningai laikyti galutinai nustatyta.

## Saugus ryto taisymo kelias

1. Lokaliai pridėti tikslinį `mark_reviewed` route testą: sėkmė, idempotentinis pakartojimas, neegzistuojantis vartotojas, audito klaida ir DB atnaujinimo klaida.
2. Pakeisti klaidos diagnostiką taip, kad serverio logas rodytų sanitarizuotą klaidos kodą ir žinutę be klientų duomenų.
3. Preview aplinkoje su testine byla pakartoti atidarymą ir įrodyti:
   - HTTP 200;
   - `adminReviewedAt` įrašytas;
   - sukurtas vienas audito įrašas;
   - antras atidarymas nesukuria dublikato.
4. Paleisti TypeScript, ESLint, tikslinius ir pilnus testus bei Linux CI.
5. Tik gavus savininko patvirtinimą atlikti Production hotfix deploy.
6. Po deploy su kontroliuojama sintetine byla atlikti vieną savininko UAT ir 30 minučių stebėti 5xx.

## Įgyvendinta lokaliai

- `mark_reviewed` perkeltas į centrinį `executeCaseCommand` sluoksnį;
- įrašas dabar gauna monotoniškai didinamą `caseRevision`, patikimą `trustedCaseCommand` kontekstą ir vieną `case.mark_reviewed` audito įvykį;
- pastovi idempotency reikšmė neleidžia dubliuoti pirmos peržiūros;
- jau peržiūrėta byla grąžinama be naujo DB ar audito rašymo;
- pridėti helper ir API regresijos testai;
- tiksliniai testai: 13/13 PASS;
- pilni unit testai be migracijų: 581/581 PASS;
- TypeScript ir ESLint: PASS;
- pilnas Windows ARM `npm test` buvo sustabdytas dėl žinomo migracijų/PGlite aplinkos strigimo; galutinis migracijų ir Linux build vartas paliktas CI.

## Taisymo ir STOP sąlyga

Kol Preview neįrodo idempotentinio veikimo ir nėra žalio CI, Production deploy, DB taisymas ar rankinis peržiūros žymos įrašymas neatliekamas. Po visų automatinių ir Preview vartų leidžiamas tik siauras, rollback paruoštą turintis Production hotfix. `STOP` taikomas tik jeigu pataisos nepavyksta saugiai įrodyti arba būtinas savininko sprendimas, secret, finansinis ar teisinis veiksmas.
