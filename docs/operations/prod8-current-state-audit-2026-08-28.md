# PROD-8 faktinės būsenos auditas

Data: 2026-08-28
Šaltiniai: Production byla `#10`, Vercel deployment būklė, GitHub Quality Gate, savininko UAT pranešimai ir tik skaitymo DB diagnostika.
Principas: žmogaus nepatikrintas rezultatas nėra `PASS`.

## Santrauka

- `PROD-8.0` ir `PROD-8.1` lieka `PASS`.
- `PROD-8.2` yra **VERIFYING / READY FOR OWNER UAT**, ne `PASS`.
- `PROD-8.3` yra **VERIFYING / READY FOR OWNER UAT**, ne `PASS`.
- `PROD-8.4` yra **PRECHECK**, ne `PASS`: priminimų ir SEO scheduler flagai nepatvirtinti kaip aktyvūs, o Production `CRON_SECRET` turi būti patikrintas savininko.
- `PROD-8.5` ir `GO_FULL_AUTOMATION` nepradėti.

## PROD-8.2 — kliento komercinis kelias

| Kriterijus | Faktinė būsena | Įrodymas / likęs veiksmas |
|---|---|---|
| Automatinis matavimas, kaina, pasiūlymas ir sutarties juodraštis | ĮRODYTA AUTOMATIŠKAI IR UAT | Production byla `#10`; dokumentų grandinė išliko vientisa. |
| Rankinis plotas ir kainos paketo perskaičiavimas | SAVININKO UAT PASS | Savininkas patvirtino rankinio ploto išsaugojimą ir paketo išsiuntimą. |
| Vienas bendras pasiūlymo ir sutarties dokumentas | SAVININKO UAT PASS | `T-10-V1` ir `K-10-V1` rodo tą pačią sumą, maksimalią kainą ir matavimo versiją. |
| Kliento ir įmonės parašai ant tos pačios versijos | SAVININKO UAT PASS | Production `K-10-V1` turi abi parašo stadijas ir galutinį dokumentą. |
| Dokumentų, kainos, maksimalios kainos ir hash vientisumas | ĮRODYTA TIK SKAITYMU | DB ir UI grandinė sutikrinta; dublikatų nenustatyta. |
| Pasiūlymo klausimas | REIKIA SAVININKO UAT | Reikia vieno kontroliuojamo klausimo savininko el. paštu. |
| Pasiūlymo atmetimas ir gelbėjimo klasifikacija | REIKIA SAVININKO UAT | Reikia atskiros sintetinės bylos; negalima keisti pasirašytos `#10` bylos. |
| Sutarties nutraukimas / atsisakymas | REIKIA SAVININKO UAT | Reikia atskiros sintetinės bylos ir patikrinti galutinį admin patvirtinimą. |
| Neteisingas, pakeistas, pasibaigęs ir atšauktas tokenas | ĮRODYTA TESTAIS; GYVAS UAT NEBAIGTAS | Automatiniai neigiami testai yra žali; savininkui paliekamas vienas gyvas saugios nuorodos patikrinimas. |
| `mark_reviewed` incidentas | SAVININKO PREVIEW UAT PASS | Pataisa `c2989a1`; 13/13 tikslinių, 581/581 vienetinių testų ir Linux CI run `33120965793` PASS; Preview `dpl_2mBbVwymveu5Jjgw5qc39X7U3dPj` READY. 2026-08-28 savininkas atidarė neperžiūrėtą sintetinę bylą `#4`, atnaujino puslapį ir patvirtino, kad klaida nepasikartojo. |

## PROD-8.3 — darbas ir darbuotojo eiga

| Kriterijus | Faktinė būsena | Įrodymas / likęs veiksmas |
|---|---|---|
| Darbo užsakymo sukūrimas iš pasirašytos sutarties | SAVININKO UAT PASS | Production byla `#10`; sukurtas vienas darbo užsakymas. |
| Darbuotojo paskyrimas, data ir intervalas | SAVININKO UAT PASS | Paskyrimas išliko, darbuotojas mato darbą. |
| Darbuotojo priskyrimo laiškas | DALINIS PASS | Darbuotojo ir kliento siuntimo klaidos buvo pataisytos; savininkas patvirtino pristatymus. Reikia sutikrinti galutinius job/audito įrašus. |
| Darbuotojas mato tik savo darbą | ĮRODYTA TESTAIS IR DALINIU UAT | Reikia neigiamo svetimo darbo URL UAT arba automatizuoto Preview įrodymo. |
| `vykstu` → `atvykau` → patikra → pradėta → užbaigta | REIKIA SAVININKO UAT | Production byloje `#10` pilna seka dar neužbaigta. |
| ETA ir kliento operaciniai pranešimai | REIKIA SAVININKO UAT | Tikrinti kontroliuojamoje sintetinėje eigoje, ne realiam klientui. |
| Galutinis matavimas ir tolerancija | REIKIA SAVININKO UAT | Patikrinti darbuotojo portale. |
| Pakeitimo susitarimas virš maksimumo | REIKIA SAVININKO UAT | Naudoti atskirą sintetinę bylą. |
| Užbaigimo dokumentai ir garantija | REIKIA SAVININKO UAT | Reikia pilno darbo užbaigimo scenarijaus. |

## PROD-8.4 — priminimai ir tinklaraščio automatika

| Priklausomybė / kriterijus | Faktinė būsena | Pastaba |
|---|---|---|
| Gemini | READY | Production kintamojo buvimas patvirtintas neatskleidžiant reikšmės. |
| Pexels | OWNER ACTION REQUIRED | Dabartiniame Production kintamųjų pavadinimų inventoriuje `PEXELS_API_KEY` nerastas; prieš 8.4 aktyvaciją pridėti kaip Production secret. |
| Resend | READY | Production el. pašto siuntimas patikrintas. |
| Turnstile ir Upstash rate limit | READY | Production health skydelis rodė abi integracijas paruoštas. |
| `CRON_SECRET` | OWNER ACTION REQUIRED | Production health skydelyje `Jobs` buvo neparuoštas; reikšmės kurti ar keisti naktį negalima. |
| SEO juodraščio generavimas | ĮRODYTA TESTAIS / REIKIA KONTROLIUOJAMO UAT | Publikavimas turi likti tik administratoriaus veiksmu. |
| Mokėjimo priminimas | ĮRODYTA TESTAIS / REIKIA KONTROLIUOJAMO UAT | Privaloma tos dienos banko patikra ir atskiras administratoriaus patvirtinimas. |
| Automatinių operacinių siuntimų avarinė pauzė | READY | Kodo ir administravimo kontrolė egzistuoja; prieš 8.4 įjungimą dar kartą patikrinti. |

## Nekeičiamos išvados

1. Production lieka **kontroliuojamu pilotu**.
2. Jokia komercinė išvestis ar mokėjimo priminimas negali būti siunčiamas be administratoriaus patvirtinimo.
3. `GO_FULL_AUTOMATION` negalimas iki 20–30 realių bylų piloto ir mažiausiai trijų fizinių matavimų palyginimo.
4. Pasirašyta byla `#10` nenaudojama destruktyviems ar atmetimo scenarijams.
5. `c2989a1` Preview UAT kliūtis uždaryta; Production diegimas galimas tik kartu su žaliu naujausio kandidato Linux CI ir užfiksuotu rollback.
