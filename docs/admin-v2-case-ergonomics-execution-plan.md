# Takfornyelse — `admin-v2` bylos ergonomikos pataisymo planas

**Parengta:** 2026-08-26  
**Aplinka:** tik `https://takfornyelse-staging.vercel.app`  
**Produkcija:** neliečiama be atskiro savininko `GO`  
**Būsena:** savininko patvirtinta; vykdoma nuosekliai staging aplinkoje  
**Vykdymo taisyklė:** vienu metu vykdoma viena fazė; nepasiekus jos PASS kriterijų į kitą fazę nepereinama

## 1. Tikslas

Pertvarkyti esamą `/admin-v2/cases/[id]` bylos darbo vietą taip, kad paprastas administratorius visada aiškiai matytų:

- su kuriuo klientu ir byla dirba;
- kuri pasiūlymo bei sutarties versija dabar nagrinėjama;
- kuri sutartis šiuo metu teisiškai galioja;
- kuri nauja versija laukia veiksmo ir ką ji pakeis;
- kokią paslaugą, kainą ir dokumentą administratorius tvirtina;
- koks yra vienas aktualus kitas veiksmas ir kas įvyks jį atlikus.

Sprendimas kuriamas esamame `admin-v2`. Naujas `admin-v3`, antras backend arba dubliuota valdymo sistema nekuriami.

## 2. Patvirtinta dabartinio pataisymo apimtis

1. Puslapio viršuje rodoma pilna bylos suvestinė.
2. Slenkant lieka automatiškai prisegta kompaktiška valdymo juosta.
3. Kompiuterio juostoje rodoma byla, klientas, vykdoma/galiojanti dokumento versija, suma, būsena ir vienas aktualus veiksmas.
4. Telefono juosta yra maždaug 60–70 px aukščio, neuždengia turinio ir rodo tik būtiniausią informaciją; papildoma informacija laikinai išskleidžiama paspaudus juostą ar rodyklę.
5. Atskiro `prisegti / atsegti` nustatymo nėra.
6. Rodoma aiški versijų grandinė, pavyzdžiui `K-15-V1 → K-15-V2`.
7. Veiksmų pavadinimuose įrašoma konkreti versija, pavyzdžiui `Pasirašyti K-15-V2`.
8. Paspaudus dokumento versiją atidaroma būtent tos versijos peržiūra arba PDF.
9. Prieš rizikingą veiksmą rodoma trumpa kontrolinė suvestinė: klientas, paslauga, dokumentas, versija, kaina, maksimali kaina, avansas ir pakeičiama versija.
10. Serveris neleidžia patvirtinti pasenusio dokumento iš seniai atidaryto puslapio ar kito naršyklės skirtuko.
11. Po sėkmingo veiksmo puslapis automatiškai atsinaujina, parodo rezultatą ir naują kitą veiksmą.
12. Įmonės parašo vardas lieka administratoriaus įvedamas; laukas aiškiai vadinamas `Takfornyelse vardu pasirašantis asmuo`.

## 3. Svarbi versijų taisyklė

Sąsaja negali visų naujausių dokumentų klaidinamai vadinti `aktyviais`.

- **Vykdoma versija** — naujausia versija, su kuria dabar atliekamas veiksmas.
- **Galiojanti sutartis** — naujausia sutartis, kurią jau pasirašė abi šalys.
- Kol `K-15-V2` laukia kliento arba Takfornyelse parašo, juostoje rodoma:
  - `Vykdoma: K-15-V2 · laukia parašo`;
  - `Dabar galioja: K-15-V1`.
- Kai abi šalys pasirašo `K-15-V2`, rodoma:
  - `Galiojanti: K-15-V2`;
  - `Pakeičia K-15-V1`;
  - `K-15-V1 · istorinė`.
- Pasirašyta istorinė versija nekeičiama ir netrinama.

## 4. Nekeičiama saugos ir UX tvarka

1. Vienas ekranas vienu metu turi vieną pagrindinį `Kitas veiksmas`.
2. Mygtuko tekstas turi pasakyti konkretų veiksmą ir konkretų dokumentą.
3. Spalva negali būti vienintelis būsenos paaiškinimas; visada rodomas tekstas.
4. Techniniai ID ir hash pagal nutylėjimą slepiami po `Techninė informacija`.
5. Pasirašymo, kainos, darbo sukūrimo ir versijos pakeitimo veiksmai tikrinami serveryje, ne vien naršyklėje.
6. Dvigubas paspaudimas ar puslapio pakartotinis siuntimas negali sukurti dublikato.
7. Juosta turi veikti su klaviatūra, ekrano skaitytuvu, siauru telefonu ir dideliu naršyklės šriftu.
8. Juosta negali uždengti antraštės, kalbos pasirinkimo, atsijungimo, klaidų, formos laukų ar pagrindinio CTA.
9. Visi LT, NO ir EN panelės tekstai turi vienodą operacinę reikšmę.
10. Produkcijos duomenys ir vieša svetainė šiame etape nekeičiami.

## 5. Fazės vykdymo protokolas

Po kiekvienos fazės atliekama:

1. tiksliniai unit ir integraciniai testai;
2. `npm run typecheck` ir `npm run lint`;
3. aktualaus puslapio desktop bei mobile smoke patikra;
4. staging deploy tik užbaigus vietinę patikrą;
5. savininko rankinis priėmimas, kai fazė keičia matomą administratoriaus darbą;
6. rezultato ir įrodymų įrašymas fazės ataskaitoje.

Fazė uždaroma tik kai jos ataskaitoje yra:

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```

Bet kuris `FAIL`, nepatikrintas scenarijus arba klaidinanti būsena palieka fazę atidarytą.

## 6. Įgyvendinimo fazės

### E0 — baseline, informacijos architektūra ir rollback

**Vykdymo būsena:** PASS — 2026-08-26; įrodymai `docs/implementation/phase-e0-case-ergonomics-baseline.md`.

**Tikslas:** prieš keičiant UI užfiksuoti dabartinę būseną ir vienareikšmiškai aprašyti, ką juosta turi rodyti kiekvienoje bylos stadijoje.

**Darbai:**

- užfiksuoti Git commit, staging deployment ir dabartinius desktop/mobile ekrano vaizdus;
- inventorizuoti dabartinį `case-read-model`, bylos puslapio komponentus, action API ir dokumentų nuorodas;
- sudaryti būsenų matricą nuo naujos užklausos iki užbaigto darbo;
- kiekvienai būsenai nustatyti `vykdomą versiją`, `galiojančią sutartį`, rodomą sumą, būseną ir vieną kitą veiksmą;
- atskirai aprašyti kontroliuojamą pakeitimą `V1 → V2`;
- parengti saugų grįžimą į dabartinę `/admin-v2` versiją.

**Patikra:** matrica patikrinama su bent šiomis bylomis: nauja užklausa, pasiūlymo juodraštis, išsiųstas pasiūlymas, kliento pasirašyta sutartis, abiejų šalių pasirašyta sutartis, `V1 → V2`, darbas be darbuotojo, aktyvus ir užbaigtas darbas.

**Fazė baigta, kai:**

- nėra būsenos, kuriai neaišku, ką juosta turi rodyti;
- aiškiai atskirta vykdoma ir galiojanti versija;
- dabartinį UI galima atkurti vienu rollback;
- nėra pakeistas nei UI, nei produkcija;
- įrašytas E0 `GO`.

### E1 — vienas autoritetingas bylos ir versijų modelis

**Vykdymo būsena:** PASS — 2026-08-26; įrodymai `docs/implementation/phase-e1-case-commercial-context.md`.

**Priklausomybė:** E0  
**Tikslas:** serveris ir UI gauna vieną teisingą bylos kontekstą, o ne atskirai spėja pagal pavienius įrašus.

**Darbai:**

- išplėsti `case-read-model`, kad grąžintų pilnos juostos duomenis;
- deterministiškai apskaičiuoti vykdomą pasiūlymą, vykdomą sutartį, galiojančią sutartį ir versijų grandinę;
- grąžinti dokumento būseną, sumą, maksimalią sumą, avansą ir pakeičiamą versiją;
- pažymėti istorines, laukiančias, galiojančias, pakeistas ir atmestas versijas;
- pridėti serverio `expected version / expected document hash` kontrolę rizikingiems veiksmams;
- pasenusiam veiksmui grąžinti aiškią `409` klaidą su dabartine versija, o ne atlikti veiksmą.

**Patikra:** unit ir integraciniai testai apima `V1`, laukiančią `V2`, pilnai pasirašytą `V2`, lygiagrečius naršyklės skirtukus ir bandymą patvirtinti seną versiją.

**Fazė baigta, kai:**

- ta pati byla visose admin vietose turi tą pačią vykdomą ir galiojančią versiją;
- neįmanoma serveryje patvirtinti pasenusios versijos;
- istoriniai pasirašyti dokumentai išlieka nekintami;
- visi E1 testai PASS;
- įrašytas E1 `GO`.

### E2 — pilna bylos suvestinė ir prisegta kompaktiška juosta

**Vykdymo būsena:** techninė ir staging patikra PASS — 2026-08-26; 320, 375, 768 ir 1280 px, lipni juosta bei horizontalus plotis patikrinti E6. Įrodymai `docs/implementation/phase-e2-case-summary-command-bar.md` ir `docs/implementation/phase-e6-regression-staging-acceptance.md`.

**Priklausomybė:** E1  
**Tikslas:** administratorius visada žino, kurioje byloje ir dokumento versijoje dirba.

**Darbai:**

- sukurti pilną viršutinę bylos suvestinę;
- sukurti `position: sticky` kompaktišką valdymo juostą po pagrindine admin antrašte;
- desktop juostoje rodyti bylą, klientą, versiją, sumą, būseną ir kitą veiksmą;
- telefone rodyti tik `#byla`, versiją, trumpą būseną ir kitą veiksmą;
- telefone pridėti laikiną informacijos išskleidimą, bet ne pin/unpin nustatymą;
- pridėti tinkamą `z-index`, `scroll-margin`, safe-area ir turinio viršutinį tarpą;
- neleisti juostai uždengti fokusą, validacijos klaidas ir antraštę.

**Patikra:** 320 px, 375 px, 768 px, 1280 px ir didesnis ekranas; 200 % naršyklės mastelis; klaviatūra; ilgas kliento vardas; ilga LT/NO/EN būsena; slinkimas iki puslapio apačios.

**Fazė baigta, kai:**

- pilna suvestinė matoma puslapio pradžioje;
- slenkant kompaktiška juosta visada matoma ir rodo teisingą kontekstą;
- telefone juosta neužima daugiau nei būtina ir neuždengia veiksmų;
- nėra horizontalaus slinkimo ar turinio šuolio;
- savininkas priima desktop ir mobile staging vaizdą;
- įrašytas E2 `GO`.

### E3 — versijų grandinė ir tiesioginė dokumento peržiūra

**Vykdymo būsena:** techninė ir staging patikra PASS — 2026-08-26; įrodymai `docs/implementation/phase-e3-document-version-chain.md` ir `docs/implementation/phase-e6-regression-staging-acceptance.md`.

**Priklausomybė:** E2  
**Tikslas:** administratorius vienu žvilgsniu supranta dokumentų istoriją ir vienu paspaudimu patikrina konkrečią versiją.

**Darbai:**

- rodyti aiškią `V1 → V2 → V3` grandinę pasiūlymams ir sutartims;
- tekstu pažymėti `vykdoma`, `galiojanti`, `istorinė`, `laukia parašo`, `pakeista`, `atmesta`;
- kiekvieną versiją padaryti paspaudžiamą;
- atidaryti tos pačios versijos administratoriaus peržiūrą arba PDF;
- peržiūroje rodyti dokumento numerį, būseną, sumą, sukūrimo ir parašų laiką;
- pagal nutylėjimą slėpti techninį hash, bet leisti jį pamatyti išskleidus techninę informaciją.

**Patikra:** atidarant `K-15-V1` ir `K-15-V2` negali būti sukeisti PDF, suma, paslauga ar būsena; pasirašyta istorinė versija turi likti pasiekiama tik skaitymui.

**Fazė baigta, kai:**

- kiekviena rodoma versija atidaro būtent savo dokumentą;
- aišku, kuri versija galioja ir kurią ji pakeitė;
- nėra klaidinančio bendro mygtuko be versijos numerio;
- desktop ir mobile patikra PASS;
- įrašytas E3 `GO`.

### E4 — kontekstinis kitas veiksmas ir kontrolinė suvestinė

**Vykdymo būsena:** techninė ir staging patikra PASS — 2026-08-26; įrodymai `docs/implementation/phase-e4-contextual-action-preflight.md` ir `docs/implementation/phase-e6-regression-staging-acceptance.md`.

**Priklausomybė:** E3  
**Tikslas:** administratorius prieš paspausdamas aiškiai mato, ką tvirtina ir kas bus atlikta.

**Darbai:**

- visus pagrindinius CTA pavadinti konkrečiai: `Patvirtinti T-15-V2`, `Siųsti T-15-V2`, `Pasirašyti K-15-V2`, `Sukurti darbą pagal K-15-V2`;
- šalia veiksmo rodyti klientą, paslaugą, dokumentą, sumą, maksimalią sumą, avansą ir pakeičiamą versiją;
- rizikingiems veiksmams pridėti aiškų galutinį patvirtinimą;
- įmonės parašo lauką pavadinti `Takfornyelse vardu pasirašantis asmuo`;
- veiksmo užklausai siųsti laukiamą dokumento ID, versiją ir hash;
- serveryje prieš veiksmą dar kartą patikrinti, kad versija tebėra vykdoma;
- blokuoti veiksmą, jei dokumentas pasikeitė, ir parodyti nuorodą į dabartinę versiją.

**Patikra:** teisinga versija, pasenusi versija, dvigubas paspaudimas, du skirtukai, ilgas veiksmas, serverio klaida ir tinklo nutrūkimas.

**Fazė baigta, kai:**

- prieš kiekvieną ekonominį ar sutartinį veiksmą aišku, kas bus patvirtinta;
- mygtuko ir kontrolinės suvestinės versijos visada sutampa;
- pasenusi ar lygiagrečiai pakeista versija saugiai blokuojama;
- veiksmo pakartojimas nesukuria dublio;
- savininkas staging aplinkoje be techninės pagalbos teisingai pasirenka ir patvirtina dokumentą;
- įrašytas E4 `GO`.

### E5 — automatinis rezultatas, atsinaujinimas ir tęstinumas

**Vykdymo būsena:** techninė ir staging patikra PASS — 2026-08-26; įrodymai `docs/implementation/phase-e5-action-feedback-refresh.md` ir `docs/implementation/phase-e6-regression-staging-acceptance.md`.

**Priklausomybė:** E4  
**Tikslas:** po paspaudimo administratorius iš karto žino, ar veiksmas suveikė ir ką daryti toliau.

**Darbai:**

- veiksmo metu rodyti aiškią vykdymo būseną ir išjungti pakartotinį paspaudimą;
- po sėkmės automatiškai atnaujinti bylos read model;
- pilnoje suvestinėje ir sticky juostoje iš karto pakeisti būseną, versiją ir kitą veiksmą;
- rodyti trumpą sėkmės patvirtinimą su dokumento numeriu;
- klaidos atveju išlaikyti įvestus duomenis, parodyti suprantamą priežastį ir saugų pakartojimo kelią;
- jeigu veiksmas priimtas, bet komunikacija laukia retry, rodyti `Veiksmas išsaugotas · pranešimas eilėje`, o ne bendrą klaidą.

**Patikra:** sėkmė, validacijos klaida, `409 stale`, `500`, timeout, komunikacijos queue ir pakartotinis puslapio atidarymas.

**Fazė baigta, kai:**

- administratorius neprivalo ranka perkrauti puslapio, kad suprastų rezultatą;
- būsena ir kitas veiksmas po operacijos yra teisingi;
- nėra klaidingo įspūdžio, kad nesuveikęs veiksmas suveikė arba atvirkščiai;
- retry nesukuria dublikato;
- visi E5 testai ir staging priėmimas PASS;
- įrašytas E5 `GO`.

### E6 — regresija, prieinamumas ir galutinis staging priėmimas

**Vykdymo būsena:** techninė patikra PASS — 2026-08-26; savininko galutinis vizualinis `GO` laukiamas, produkcija nepakeista. Įrodymai `docs/implementation/phase-e6-regression-staging-acceptance.md`.

**Priklausomybė:** E5  
**Tikslas:** įrodyti, kad ergonomikos pataisymas nepakeitė verslo logikos ir veikia visame bylos cikle.

**Darbai:**

- paleisti visą unit, integracinių, migracijų, lint, TypeScript ir build patikrą;
- atlikti autorizuotą staging E2E kelią nuo naujos užklausos iki darbo sukūrimo;
- atskirai atlikti `V1 → V2` pakeitimo kelią;
- patikrinti desktop ir tikrą siauro telefono vaizdą;
- patikrinti klaviatūros fokusą, semantines antraštes, mygtukų pavadinimus ir ekrano skaitytuvo etiketes;
- patikrinti LT, NO ir EN panelės tekstus;
- palyginti pasiūlymo, sutarties, PDF ir juostos versijas bei sumas;
- užfiksuoti anonimizuotus įrodymus ir rollback tašką.

**Privalomi rankiniai scenarijai:**

1. Nauja `V1` byla iki abiejų parašų.
2. `V1` galioja, o `V2` tik ruošiama.
3. `V2` laukia kliento parašo.
4. `V2` laukia Takfornyelse parašo.
5. `V2` pasirašyta abiejų šalių ir pakeičia `V1`.
6. Bandymas iš seno skirtuko pasirašyti arba patvirtinti `V1`.
7. Darbo sukūrimas tik pagal galiojančią naujausią sutartį.
8. Telefono ekrane slinkimas per visą ilgą bylą.

**Fazė baigta, kai:**

- visi privalomi scenarijai PASS;
- juosta, dokumentų grandinė, kontrolinė suvestinė ir kitas veiksmas visur rodo tą pačią versiją;
- nė vienas pasenusios versijos veiksmas neįvykdomas;
- nėra P0/P1 UX, prieigos ar duomenų nuoseklumo defekto;
- rollback patikrintas;
- savininkas staging aplinkoje įrašo E6 `GO`.

## 7. Kas šiame pakete sąmoningai nedaroma

- nekuriamas `/admin-v3`;
- neperrašomas veikiantis užklausų, matavimo, kainos, sutarčių ar darbų backend;
- nekeičiamas viešas kliento puslapis, išskyrus atvejį, jei regresijos testas aptinka tiesiogiai susijusią kritinę klaidą;
- nekeičiami jau pasirašytų dokumentų snapshot, PDF ar parašų įrodymai;
- neatliekamas bendras visų dashboard puslapių vizualinis redesign;
- neįjungiama produkcija;
- nepridedamos naujos marketingo, Fiken ar SMS funkcijos.

Šie darbai gali būti planuojami tik užbaigus E0–E6 arba nustačius kritinį blokuojantį ryšį.

## 8. Galutinis priėmimo apibrėžimas

Pataisymo paketas laikomas baigtu tik tada, kai paprastas administratorius gali, neskaitęs techninės dokumentacijos:

1. atidaryti bylą ir iš karto įvardyti klientą, vykdomą bei galiojančią dokumento versiją;
2. vienu paspaudimu atidaryti konkrečios versijos dokumentą;
3. suprasti, ką konkrečiai pakeis nauja versija;
4. prieš patvirtindamas pamatyti paslaugą, sumą, maksimumą, avansą ir dokumento numerį;
5. negalėti netyčia patvirtinti pasenusios versijos;
6. po veiksmo iš karto pamatyti rezultatą ir kitą žingsnį;
7. atlikti tą patį siaurame telefono ekrane be uždengto turinio ar neaiškaus CTA.

Tik tada visas paketas gauna:

```text
ADMIN_CASE_ERGONOMICS=PASS
VERSION_SAFETY=PASS
DESKTOP_ACCEPTANCE=PASS
MOBILE_ACCEPTANCE=PASS
OWNER_APPROVAL=GO
```
