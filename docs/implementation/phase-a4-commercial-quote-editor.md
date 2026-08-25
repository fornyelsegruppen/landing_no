# A4 – pasiūlymo redaktorius ir komercinės alternatyvos

**Būsena:** užbaigta 2026-08-25

## Pasiektas rezultatas

- Custom bylos puslapyje administratorius mato kainą be PVM, PVM, kainą su PVM, maksimalią kainą ir PDF peržiūrą.
- Galima audituojamai pakeisti kainą už m², pritaikyti procentinę arba fiksuotą nuolaidą ir įrašyti privalomą pagrindimą.
- PVM, nuolaida ir maksimalios kainos tolerancija skaičiuojami deterministiškai, ne Gemini tekstu.
- Saugos riba blokuoja didesnę nei 20 % nuolaidą, kainą žemiau patvirtinto minimumo ir vieneto kainą už 80–200 % patvirtintos taisyklės intervalo.
- Kiekvienas pakeitimas sukuria naują nekintamą kainos, pasiūlymo ir sutarties versiją; ankstesni atviri juodraščiai pažymimi kaip pakeisti.
- Administratorius gali pridėti rekomenduojamą paslaugą kaip atskirą komercinį variantą. Sistema kuria dvi atskiras kainos ir sutarties versijas.
- Abu variantai patvirtinami kartu ir išsiunčiami viename profesionaliame laiške kaip du aiškūs asmeniniai pasirinkimai.
- Kiekviena kliento nuoroda aiškiai pažymėta „Opprinnelig forespørsel“ arba „Anbefalt alternativ“; galima pasirašyti tik pasirinktą sutartį.
- Pasirašius vieną variantą, kito varianto sutartis pakeičiama, o jo prieigos nuoroda atšaukiama.
- Nepagrįsti teiginiai apie kaimynus ar visus patenkintus klientus nenaudojami.

## Duomenų schema

- `quotes.option_group`
- `quotes.option_kind`
- `quotes.sibling_quote_id`
- `quotes.selected_option_quote_id`
- migracija `20260825_170000_commercial_quote_options`

## Patikra

- `npm run lint` ir `npm run typecheck` – praėjo.
- 6 tiksliniai failai / 42 testai – praėjo.
- visas rinkinys: 123 failai / 378 testai – praėjo.
- PDF sumos naudoja tą patį nekintamą quote snapshot kaip HTML ir pasirašymo procesas.

## Sąmoningas UX sprendimas

Du pasirinkimai pateikiami viename laiške dviem asmeninėmis nuorodomis. Taip kiekviena sutartis nuo pat peržiūros turi nekintamą kainos snapshot ir dokumento hash, o pasirinkimas negali tyliai pakeisti jau rodyto dokumento.
