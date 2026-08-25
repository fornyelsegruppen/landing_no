# F10 realaus piloto įrodymų šablonas

Šis dokumentas pildomas tik realiais, anonimizuotais rezultatais. Jame negali būti kliento vardo, el. pašto, telefono, pilno adreso, prieigos tokeno ar paslapčių. Kiekvienos bylos pirminiai duomenys lieka apsaugotoje admin sistemoje; čia naudojamas tik vidinis bylos numeris ir apibendrintas scenarijus.

## Piloto ribos

- Imtis: 20–30 realių užklausų.
- Administratorius prieš siuntimą patvirtina kiekvieną kainą, tekstą, pasiūlymą ir sutartį.
- Bent 3 reprezentatyvūs stogai gauna fizinį kontrolinį matavimą.
- Bet koks P0/P1, duomenų nutekėjimas, neteisinga kaina, neleistinas parašas arba klaidingas automatinis siuntimas stabdo pilotą ir išjungia susijusį flagą.
- Visi laikai fiksuojami Europe/Oslo laiko zonoje.

## Rekomenduojama 20–30 bylų aprėptis

| Grupė | Mažiausia imtis | Reikalingi variantai |
|---|---:|---|
| Aiškus adresas ir vienas pastatas | 5 | skirtingi regionai ir paslaugos |
| Keli pastatai / administratoriaus pasirinkimas | 4 | namas, garažas, arti esantis kaimynas |
| Rankinis plotas be vizualo | 2 | privalomas pagrindimas ir perskaičiavimas |
| Papildomos paslaugos variantas | 3 | bazinis ir rekomenduojamas pasiūlymas |
| Kliento klausimas / atmetimas / gelbėjimas | 3 | draugiškas admin patvirtintas atsakymas |
| Sutartis → įmonės parašas → darbuotojas | 3 | desktop ir mobile |
| Komunikacijos arba provider išimtis | 2 | retry, idempotency, ne dubliuotas laiškas |

Grupių imtys gali persidengti, tačiau bendras unikalių realių bylų skaičius turi būti 20–30.

## Vienos bylos registras

| Laukas | Reikšmė |
|---|---|
| Vidinis anoniminis bylos ID |  |
| Data / regiono grupė |  |
| Paslauga ir scenarijaus grupė |  |
| Gavimas patvirtintas per, min. |  |
| Adresas/pastatas rastas automatiškai | taip / ne |
| Matavimo confidence | low / medium / high / manual |
| Admin keitė pastatą, poligoną, kampą ar plotą |  |
| Automatinis plotas / fizinis plotas / paklaida % |  |
| Pasiūlymas parengtas per, min. |  |
| Kaina, PVM ir PDF sutampa | taip / ne |
| Kliento veiksmas | priėmė / klausė / atmetė / neatsakė |
| Sutarties ir parašų įrodymas | pass / n/a / fail |
| Darbuotojo mobile kelionė | pass / n/a / fail |
| Laiškų pristatymas ir dubliai |  |
| Rankinis taisymas / incidentas |  |
| Galutinis rezultatas | PASS / FAIL / BLOCKED |

## Suvestinė po piloto

| KPI | Imtis | Rezultatas | Iš anksto patvirtintas slenkstis | PASS / FAIL |
|---|---:|---:|---:|---|
| Patvirtinimo laiško pristatymo dalis |  |  |  |  |
| Mediana iki gavimo patvirtinimo |  |  |  |  |
| Mediana iki admin paruošto pasiūlymo |  |  |  |  |
| Automatiškai rastų tinkamų pastatų dalis |  |  |  |  |
| Matavimų, kuriuos admin koregavo, dalis |  |  |  |  |
| Fizinių kontrolinių matavimų absoliuti ir procentinė paklaida |  |  |  |  |
| Klaidingų kainų / PVM / PDF neatitikimų skaičius |  |  | 0 |  |
| Neleistinų automatinių siuntimų skaičius |  |  | 0 |  |
| Dubliuotų laiškų ar job skaičius |  |  | 0 |  |
| Neišspręstų P0/P1 skaičius |  |  | 0 |  |

## Patvirtinimai

| Sritis | Vardas / vaidmuo | Data | Dokumento ar vidinės užduoties nuoroda |
|---|---|---|---|
| Piloto vykdytojas |  |  |  |
| Kainų patvirtinimas |  |  |  |
| Stogo matavimo patvirtinimas |  |  |  |
| Sutarties / parašo patvirtinimas |  |  |  |
| Komunikacijos patvirtinimas |  |  |  |
| Produkto savininko galutinis sprendimas |  |  |  |

