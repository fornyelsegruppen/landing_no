# A7 — Archyvas, šiukšlinė ir retention

## Rezultatas

Kasdienėje `/admin-v2` aplinkoje aktyvios bylos atskirtos nuo archyvuotų ir šiukšlinėje esančių bylų. Administratorius bylos apačioje gali:

- archyvuoti bylą su privaloma klasifikacija ir priežastimi;
- perkelti bylą į šiukšlinę, kur nustatomas 30 dienų laukimo terminas;
- atkurti archyvuotą arba šiukšlinėje esančią bylą;
- tik pasibaigus laukimo terminui inicijuoti galutinį trynimą, papildomai įvedant tikslų bylos numerį.

Archyvas pasiekiamas per `/admin-v2/archive`. Numatytoji bylų paieška, apžvalgos kortelės ir operacinės eilės rodo tik `active` bylas.

## Apsaugos

- Aktyvus arba neužbaigtas darbo užsakymas blokuoja archyvavimą ir perkėlimą į šiukšlinę.
- Pasirašyta sutartis arba priimtas pasiūlymas turi būti užbaigtas per darbo srautą arba tvarkingai atšauktas.
- Pasirašyta sutartis, priimtas pasiūlymas, bet koks darbo užsakymas, sąskaitos įrašas arba garantija visada blokuoja galutinį lead trynimą.
- Tiesioginis trynimas techniniame Payload administravime užrakintas. Galutinis trynimas leidžiamas tik su `trustedLeadPurge` kontekstu po lifecycle patikrų.
- Archyvuojant ankstyvą, komercinio įsipareigojimo neturinčią bylą, neišsiųstos žinutės atšaukiamos, atviri pasiūlymai / sutartys / pakeitimų susitarimai atšaukiami ir klientų prieigos nuorodos uždaromos.
- Visi lifecycle veiksmai registruojami nekintamame audite. Auditui nesaugoma archyvavimo priežasties tekstinė PII kopija.

## Retention cron pakeitimas

`/api/cron/purge-leads` daugiau nerenka senų aktyvių bylų pagal jų sukūrimo datą. Jis pasirenka tik:

1. `recordState = trashed`;
2. `purgeAfter <= dabar`;
3. bylas, kurioms nėra nė vieno teisiškai ar operaciškai saugotino įrašo.

Aktyvios ir tik archyvuotos bylos automatiškai netrinamos.

## Duomenų modelis

Lead papildytas laukais:

- `recordState`: `active | archived | trashed`;
- `archiveClassification`: `completed | declined | lost | invalid | spam | duplicate | other`;
- `archiveReason`, `archivedAt`, `archivedBy`;
- `trashedAt`, `trashedBy`, `purgeAfter`.

Migracija: `20260825_210000_lead_archive_trash`.

## Patikra

- Lifecycle vienetų testai tikrina archyvavimą, aktyvaus darbo blokavimą, šiukšlinę, atkūrimą, pasirašytų bylų apsaugą ir dvigubą trynimo patvirtinimą.
- Bylų sąrašo ir dashboard testai tikrina, kad numatytasis vaizdas yra tik aktyvus.
- Migracijų grandinė patikrinta abiem kryptimis izoliuotoje Postgres testų bazėje.
- Pilna regresija vykdoma A7 gate ir dar kartą A9.

## Dar ne produkcinis teisinis sprendimas

30 dienų laikotarpis yra techninis šiukšlinės apsaugos langas, ne įmonės teisinių dokumentų saugojimo terminas. Konkrečius sutarčių, apskaitos, garantijų, HMS ir audito terminus turi patvirtinti atsakingas asmuo prieš produkcinį automatinį minimizavimą ar valymą.
