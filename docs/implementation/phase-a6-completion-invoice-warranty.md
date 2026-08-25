# A6 – užbaigimo patikra, sąskaitos juodraštis ir garantija

**Būsena:** techniškai užbaigta 2026-08-25; bendra staging patikra atliekama A9

## Pasiektas rezultatas

- Darbuotojui pateikus galutines nuotraukas ir pastabą, darbas lieka `completed` ir laukia administratoriaus patikros. Klientui niekas nebesiunčiama apeinant kontrolę.
- Custom kliento byloje rodomas galutinės patikros ekranas su prieš/po nuotraukų kiekiu, faktiniu plotu, galutine suma ir darbuotojo pastaba.
- Administratorius privalomai patvirtina dokumentaciją bei kainos pagrindą, įrašo vidinę patikros pastabą ir konkrečiai bylai nustato garantijos trukmę bei apimtį.
- Galutinė kaina blokuojama, jei viršija pasirašytą maksimalią kainą be kliento priimto pakeitimų susitarimo arba nesutampa su priimto pakeitimo suma.
- Patvirtinus sukuriamas audituojamas `invoice-records` įrašas su savininku, suma, PVM, siūlomu terminu, būsena ir PDF.
- Sąskaitos PDF aiškiai pažymėtas `FAKTURAUTKAST – IKKE BOKFØRT`; sistema neapsimeta oficialia apskaitos sistema.
- Sąskaitos būsena custom byloje valdoma saugia seka. Eksportui ir vėlesnėms būsenoms būtina išorinės apskaitos nuoroda.
- Sukuriamas `warranties` įrašas bei firminis garantijos PDF su administratoriaus patvirtinta apimtimi, pradžia ir pabaiga.
- Sąskaitos ir garantijos snapshot turi SHA-256 dokumento ID; finansinis pagrindas ir aktyvios garantijos apimtis nebegali būti tyliai pakeisti.
- Darbas pažymimas `documented` tik per patikimą administratoriaus užbaigimo veiksmą. Tiesioginis būsenos pakeitimas blokuojamas.
- Tik po galutinės patikros klientui išsiunčiamas užbaigimo laiškas su galutine sutartimi, garantija ir darbų nuotraukomis. Sąskaitos juodraštis klientui nesiunčiamas.
- Sąskaitos juodraštis ir garantija rodomi kliento byloje, dokumentų centre ir laiko juostoje.

## Duomenų schema

- naujos kolekcijos `invoice-records` ir `warranties`;
- `work-orders.completionReviewedBy`, `completionReviewedAt`, `completionReviewNote`;
- `private-media.classification`: `invoice`, `warranty`;
- migracija `20260825_190000_completion_invoice_warranty`.

## Saugos ir verslo ribos

- Garantijos trukmė nėra automatiškai išgalvojama: administratorius kiekvienoje byloje privalo nurodyti mėnesius ir patvirtintą apimtį.
- Sąskaitos ruošinys nėra mokėjimo reikalavimas. Oficialus numeris ir siuntimas priklausys nuo pasirinktos apskaitos sistemos bei patvirtinto proceso.
- Priimta kaina, dokumento hash ir garantijos faktai išlaikomi audito grandinėje.

## Patikra

- `npm run typecheck` – praėjo.
- `npm run lint` – praėjo.
- PostgreSQL migracijų rinkinys: 13 failų / 25 testai – praėjo.
- visas rinkinys: 128 failai / 387 testai – praėjo.

## Gate

Techninis A6 gate praėjo. Autentifikuota administratoriaus ir darbuotojo staging kelionė, tikro Resend laiško priedai bei PDF peržiūra tikrinami bendrame A9 E2E.
