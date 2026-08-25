# A2 – visos bylos ir bylos darbo vieta

**Būsena:** užbaigta 2026-08-25  
**Aplinka:** `codex/master-platform-implementation`, tik Vercel Preview/staging

## Pasiektas rezultatas

- Sukurtas `/admin-v2/cases` visų klientų bylų registras.
- Veikia paieška pagal klientą, kontaktus, adresą, bylos numerį bei susijusių pasiūlymų, sutarčių ir darbų numerius.
- Veikia filtrai pagal bylos būseną, kitą veiksmą, darbuotoją ir sukūrimo datą.
- Kiekvienoje eilutėje rodoma tikra kita užduotis, jos terminas, darbuotojas ir darbo būsena.
- Pradelstas terminas rodomas kaip „Dabar“, o ne kaip klaidinanti ankstesnio etapo data.
- Bylos viršuje pridėta greita navigacija tarp kliento, matavimo, komercijos, žinučių, sutarties, darbo, dokumentų ir laiko juostos.
- Kasdienės navigacijos punktas „Visos bylos“ nebeveda į techninį Payload sąrašą.
- Techninės esybės nuorodos paslėptos po suskleista „Išplėstinė techninė peržiūra“ dalimi.
- Laiko juostos įrašai, turintys susijusį objektą, lieka paspaudžiami.

## Patikra

- `npm run lint` – praėjo.
- `npm run typecheck` – praėjo.
- Tiksliniai `case-list` ir `case-read-model` testai – 29/29 praėjo.
- Visas `npm test` rinkinys – 118 failų, 368 testai praėjo.
- Prieigos kontrolę išlaiko `requireAdminUser`; anonimas ir darbuotojas negali atverti administratoriaus duomenų.

## Sąmoningai perkelta į vėlesnes fazes

- dokumentų numerių paieškos išplėtimas atliekamas A5, kai bus sukurtas normalizuotas dokumentų centras;
- darbuotojo paskyrimas ir datos keitimas pačioje byloje atliekamas A3;
- techninių nuorodų prieinamumas pagal atskirą techninio administratoriaus teisę galutinai sutvarkomas A8.
