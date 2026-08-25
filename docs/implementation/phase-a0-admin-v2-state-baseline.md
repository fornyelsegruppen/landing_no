# A0 – admin-v2 būsenų kontraktas ir baseline

**Fazė:** A0  
**Statusas:** užbaigta su dokumentuota vietinės aplinkos build išimtimi  
**Pradėta:** 2026-08-25  
**Branch:** `codex/master-platform-implementation`  
**Pradinis commit / rollback taškas:** `83f24f8785b1144cd716d3fb00d0069dff73fbf9`  
**Pradinė staging nuoroda:** `https://takfornyelse-staging.vercel.app`  
**Produkcija:** neliečiama

## Tikslas

Užfiksuoti vieną operacinį būsenų ir veiksmų kontraktą prieš keičiant `admin-v2` eiles. Šis dokumentas atskiria techninius collection statusus nuo administratoriui rodomų darbų eilių.

## Esami techniniai statusai

### Lead

`new`, `draft_ready`, `waiting_customer`, `qualified`, `measuring`, `quoted`, `converted`, `closed`, `contacted`.

Svarbi išvada: `lead.status` vienas pats neapibrėžia administratoriaus darbo. Automatika gali perkelti naują lead į `measuring`, nors administratorius dar neatliko pirmosios peržiūros.

### Matavimas

`draft`, `review_required`, `blocked`, `approved`, `superseded`.

### Kainos skaičiavimas

`draft`, `ready`, `blocked`, `superseded`.

### Pasiūlymas

`draft`, `approved`, `sent`, `viewed`, `accepted`, `declined`, `expired`, `revoked`, `superseded`.

### Sutartis

`draft`, `issued`, `signed`, `declined`, `revoked`, `superseded`.

`signed` gali reikšti dvi skirtingas operacines būsenas:

- klientas pasirašė, bet `companySignedAt` nėra – laukia įmonės parašo;
- `companySignedAt` yra – sutartis galutinė ir galima kurti darbo užsakymą.

### Darbo užsakymas

`unassigned`, `assigned`, `scheduled`, `on_way`, `arrived`, `precheck`, `ready`, `blocked`, `in_progress`, `completed`, `documented`, `cancelled`.

Leidžiami perėjimai lieka apibrėžti `src/lib/work-orders/workflow.ts`. `unassigned` nėra aktyvus vykdymas – tai administratoriaus laukiamas paskyrimo veiksmas.

### Žinutė

`draft`, `approved`, `queued`, `sent`, `delivered`, `failed`, `attention`, `cancelled`.

`cancelled` žinutė nėra aktyvi problema ir neturi būti rodoma kaip klaidinantis išsiųstas atsakymas.

## Operacinių eilių kontraktas A1 fazei

| Eilės raktas          | Administratoriaus reikšmė            | Pagrindinė atrankos taisyklė                                                                                                            |
| --------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `new-leads`           | Naujos / neperžiūrėtos užklausos     | Lead dar neturi administratoriaus peržiūros įrodymo; A1 naudoja saugų išvestinį kriterijų, kol A2 įves aiškų peržiūros lauką            |
| `reply-drafts`        | Atsakymų juodraščiai                 | Aktyvi `draft` žinutė, kuri nėra automatinės paketo peržiūros pakaitalas                                                                |
| `quote-review`        | Matavimas / pasiūlymas patvirtinimui | Neužbaigta automatinė paketo arba atskiro pasiūlymo administratoriaus peržiūra                                                          |
| `contract-signing`    | Laukia mūsų parašo                   | `contract.status = signed` ir nėra `companySignedAt`                                                                                    |
| `signed-without-work` | Pasirašyta – sukurti darbą           | Galutinai abiejų pusių pasirašyta sutartis, bet nėra darbo užsakymo                                                                     |
| `unassigned-work`     | Laukia darbuotojo paskyrimo          | `work-order.status = unassigned`                                                                                                        |
| `needs-scheduling`    | Reikia suplanuoti                    | Darbas turi darbuotoją, bet neturi `scheduledAt` ir dar nepradėtas                                                                      |
| `active-work`         | Aktyviai vykdomi darbai              | `scheduled`, `on_way`, `arrived`, `precheck`, `ready`, `in_progress`; neįtraukiami `unassigned`, `completed`, `documented`, `cancelled` |
| `completion-review`   | Užbaigimo patikra                    | `work-order.status = completed`                                                                                                         |
| `upcoming-work`       | Artimiausi 72 val.                   | Yra data intervale ir darbas nėra atšauktas, užbaigtas ar dokumentuotas                                                                 |
| `attention`           | Reikalauja dėmesio                   | Blokuotas darbas, klaidos, pradelstas laukimas arba kitas aiškus operacinis blokavimas                                                  |

## Kito veiksmo kontraktas

`deriveCaseNextAction` yra bylos pagrindinio mygtuko šaltinis. A1 eilė ir bylos pagrindinis veiksmas privalo sutapti:

| `CaseNextActionKind`    | Operacinė reikšmė                                          |
| ----------------------- | ---------------------------------------------------------- |
| `generate_reply`        | Paruošti atsakymą arba tęsti automatinę paketo ruošą       |
| `prepare_package`       | Paruošti matavimą, kainą, pasiūlymą ir sutarties juodraštį |
| `approve_package`       | Patikrinti ir patvirtinti automatinį paketą                |
| `approve_measurement`   | Patvirtinti arba koreguoti matavimą                        |
| `measurement_required`  | Rankinis pastato / matavimo sprendimas                     |
| `calculate_price`       | Paleisti deterministinį kainos skaičiavimą                 |
| `create_quote`          | Sukurti pasiūlymo versiją                                  |
| `approve_quote`         | Patvirtinti pasiūlymą                                      |
| `issue_quote`           | Išsiųsti patvirtintą pasiūlymą                             |
| `wait_customer`         | Laukti kliento sprendimo                                   |
| `follow_up_decline`     | Peržiūrėti atmetimo priežastį ir nuspręsti dėl tęsinio     |
| `company_sign_contract` | Įmonės vardu kontrapasirašyti sutartį                      |
| `create_work_order`     | Sukurti darbo užsakymą iš galutinės sutarties              |
| `assign_worker`         | Paskirti darbuotoją                                        |
| `approve_message`       | Patvirtinti aktyvų žinutės juodraštį                       |
| `retry_message`         | Saugiai pakartoti nepavykusį siuntimą                      |
| `none`                  | Nėra bylos lygio pagrindinio veiksmo                       |

## Kontroliniai scenarijai

| ID  | Pradinė situacija                                                   | Laukiama eilė                          | Laukiamas kitas veiksmas              |
| --- | ------------------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| S01 | Nauja forma ką tik pateikta, automatika dar nepradėjo               | Naujos / neperžiūrėtos                 | Paruošti atsakymą arba paketą         |
| S02 | Automatika sukūrė matavimą, kainą, pasiūlymą ir sutarties juodraštį | Matavimas / pasiūlymas patvirtinimui   | Patvirtinti paketą                    |
| S03 | Adresas nepakankamas arba pastato confidence žema                   | Reikalauja dėmesio / matavimo patikra  | Rankinis matavimo sprendimas          |
| S04 | Pasiūlymas išsiųstas ir neatidarytas                                | Laukiama kliento                       | Laukti kliento                        |
| S05 | Klientas atsiuntė klausimą                                          | Atsakymų juodraščiai arba dėmesio eilė | Patvirtinti / paruošti atsakymą       |
| S06 | Klientas atmetė pasiūlymą                                           | Reikalauja dėmesio                     | Peržiūrėti atmetimą                   |
| S07 | Klientas pasirašė, įmonė ne                                         | Laukia mūsų parašo                     | Įmonės kontraparašas                  |
| S08 | Abi šalys pasirašė, darbo nėra                                      | Pasirašyta – sukurti darbą             | Sukurti darbo užsakymą                |
| S09 | Darbas sukurtas be darbuotojo                                       | Laukia darbuotojo paskyrimo            | Paskirti darbuotoją                   |
| S10 | Darbuotojas paskirtas, datos nėra                                   | Reikia suplanuoti                      | Nustatyti datą                        |
| S11 | Darbas suplanuotas ir vykdomas                                      | Aktyvūs darbai                         | Darbuotojo proceso veiksmas           |
| S12 | Darbuotojas pažymėjo `completed`                                    | Užbaigimo patikra                      | Administratoriaus baigiamoji kontrolė |
| S13 | Darbas `documented`                                                 | Dokumentai / sąskaita / garantija      | Paruošti trūkstamus galutinius įrašus |
| S14 | Klaidinga ar spam užklausa                                          | Aktyvi iki A7, vėliau archyvas         | Archyvuoti / atkurti                  |

## A0 automatinio baseline rezultatai

| Patikrinimas        | Rezultatas                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | Praėjo be klaidų                                                                                                                               |
| `npm run typecheck` | Praėjo be klaidų                                                                                                                               |
| `npm test`          | 117 testų failų, 349 testai – visi praėjo                                                                                                      |
| `npm run build`     | Kompiliacija ir TypeScript praėjo; vietinis Windows ARM64 page-data etapas sustojo dėl neprieinamo `@libsql/win32-arm64-msvc` optional modulio |

Build išimtis jau žinoma iš ankstesnių patikrinimų ir nėra aplikacijos kodo regresija. Pradinis commit `83f24f8` yra sėkmingai sukompiliuotas Vercel Preview aplinkoje. Kiekvienos kitos fazės galutinė gate vis tiek reikalaus sėkmingo Vercel Preview build.

## Žinomi produkciniai sprendimai

- A4: minimali leidžiama kaina / marža ir nuolaidos patvirtinimo riba.
- A4: patvirtintos paslaugų kombinacijos ir papildomo pasiūlymo taisyklės.
- A6: oficiali apskaitos sistema ir sąskaitų numeravimo procesas.
- A6: patvirtintos garantijos sąlygos pagal paslaugą.
- A7: konkretūs teisiniai saugojimo terminai.

Šie sprendimai nestabdo A0–A3 staging implementacijos.

## A0 gate

- [x] Pradinis commit ir staging taškas identifikuoti.
- [x] Techniniai statusai ir operacinės eilės atskirti.
- [x] Kontroliniai scenarijai aprašyti.
- [x] Produkciniai sprendimai užregistruoti.
- [x] Lint praeina.
- [x] Typecheck praeina.
- [x] Visi testai praeina.
- [x] Vietinė kompiliacija ir TypeScript praeina; platformos build išimtis dokumentuota, Vercel baseline veikia.
- [x] A0 rezultatas įrašytas į pagrindinio plano statuso registrą.
