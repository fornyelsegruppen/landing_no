# Takfornyelse – FULL audito trūkumų šalinimo roadmap

**Dokumento paskirtis:** vykdomasis planas likusiems `admin-v2`, kliento ir darbuotojo kelionės trūkumams pašalinti  
**Parengta:** 2026-08-25  
**Aplinka:** tik izoliuota staging `https://takfornyelse-staging.vercel.app`  
**Produkcija:** neliečiama iki F10 fazės, uždaro Production gate ir atskiro savininko `GO`  
**Dabartinė būsena:** F0–F6 įgyvendintos ir patikrintos; F7 yra aktyvus etapas
**Vykdymo taisyklė:** vienu metu vykdoma tik viena fazė; neįvykdžius jos Definition of Done į kitą fazę nepereinama

## 1. Tikslas

Užbaigti vieną paprastą, nuoseklią ir patikimą kelionę:

```text
Klientas pateikia užklausą
→ sistema patvirtina gavimą
→ AI parengia kontroliuojamą juodraštį
→ sistema randa adresą ir galimus pastatus
→ administratorius patvirtina reikiamą pastatą arba, jei jo nustatyti negalima, ranka įveda stogo plotą
→ administratorius patvirtina kainą, pasiūlymą ir sutarties versiją
→ klientas peržiūri, klausia, atmeta arba pasirašo
→ įmonė pasirašo
→ sukuriamas, priskiriamas ir suplanuojamas darbas
→ klientas laiku informuojamas apie kiekvieną svarbų žingsnį
→ darbuotojas atlieka priešpatikrą, darbą ir dokumentaciją
→ administratorius patvirtina užbaigimą, dokumentus, sąskaitos juodraštį ir garantiją
→ byla uždaroma ir archyvuojama
```

Sistema laikoma užbaigta tik tada, kai administratorius visus įprastus ir numatytus išimčių scenarijus išsprendžia `admin-v2` aplinkoje be Payload backoffice.

## 2. Nekeičiamos taisyklės

1. AI siūlo ir rašo juodraščius; plotą, PVM, kainą, toleranciją ir maksimalų įsipareigojimą apskaičiuoja deterministinės taisyklės.
2. Joks pasiūlymas, sutartis, kainos pakeitimas ar darbų apimties pakeitimas klientui nesiunčiamas be aiškaus administratoriaus patvirtinimo.
3. Patvirtintas stogo matavimas turi nekintamą versiją ir įvestis. Automatiniame arba vizualiame režime saugomi pasirinktas pastatas, poligonas, vaizdas, šaltinis, atribucija ir hash; `manual_no_visual` režime saugomi rankinis plotas, pagrindimas, patvirtinęs administratorius ir laikas.
4. Pasiūlymas ir sutartis privalo naudoti tą pačią patvirtinto matavimo versiją. Kai matavimas turi vizualą, abu dokumentai naudoja tą patį vaizdą; pasirinkus rankinį plotą be žemėlapio, abiejuose dokumentuose vizualinis priedas praleidžiamas.
5. Pasirašytas dokumentas yra nekintamas. Pakeitus pastatą, plotą, kampą ar kainą kuriama nauja pasiūlymo ir sutarties versija.
6. Išorinio ortofoto ar žemėlapio vaizdo gedimo atveju sistema pirmiausia generuoja scheminį vaizdą iš išsaugotų pastatų poligonų. Jeigu patikimo pastato ar poligono nustatyti nepavyksta, pasiūlymas neblokuojamas: administratorius pasirenka `Rankinis plotas be žemėlapio`, privalomai įveda stogo plotą ir pagrindimą, o pasiūlymas bei sutartis generuojami be vizualinio priedo.
7. Klientui rodomas vaizdas negali klaidinamai teigti, kad tai yra tikslus konstrukcinis matavimas; dokumentuose išlieka preliminaraus matavimo, nuolydžio ir leistinos paklaidos paaiškinimas.
8. Klientų tekstai, pasiūlymai, sutartys ir laiškai lieka norvegų bokmål kalba. LT, NO ir EN naudojamos tik admin ir darbuotojo sąsajose.
9. Kiekvienas ekonominis, sutartinis, matavimo, darbuotojo paskyrimo ir bylos šalinimo veiksmas įrašomas audit trail.
10. Produkcijos duomenys ir svetainė nekeičiami iki atskiro cutover sprendimo.
11. Kiekviena aktyvi byla visada turi vieną operacinį `next action`, atsakingą asmenį, terminą ir, jei aktualu, aiškią blokavimo priežastį.
12. Rizikingos funkcijos staging ir produkcijoje valdomos atskirais feature flags, kad vieną pakeitimą būtų galima išjungti nesustabdant visos sistemos.
13. Visi lead, matavimo, pasiūlymo, sutarties ir darbo būsenų pakeitimai vykdomi per vieną centrinį server-side transition/command sluoksnį; tiesioginiai tarpusavyje nesuderinti statusų pakeitimai draudžiami.
14. El. paštas yra pagrindinis klientų komunikacijos kanalas. SMS naudojama tik kai klientas neturi tinkamo el. pašto arba el. paštas patyrė galutinį `hard bounce`; SMS turi tik trumpą su konkrečia užklausa susijusį paaiškinimą ir saugią riboto galiojimo nuorodą, niekada nenaudojama marketingui be atskiro teisėto pagrindo.
15. Kainynas, PVM, tolerancijos, garantijos ir teisiniai šablonai yra versijuojami. Istorinis pasiūlymas ar sutartis visada naudoja savo snapshot ir negali pasikeisti atnaujinus dabartines taisykles.
16. Klientui darbuotoją galima priskirti tik kai darbuotojo paskyra aktyvi ir turi pilną vardą bei telefono numerį.
17. Kiekviena išorinė integracija turi aprašytą timeout, retry, bandymų limitą, fallback, rankinį tęstinumo kelią ir administratoriaus perspėjimą.
18. Kliento atšaukimas po pasirašymo, prašymas pradėti darbus anksčiau ir bet koks ginčas sustabdo automatinį tęsimą bei sukuria administratoriaus sprendimo užduotį; sistema pati neskaičiuoja kompensacijos ar teisinio rezultato.
19. Oficialios sąskaitos išrašymas ir apmokėjimo apskaita nėra šio etapo dalis. Kol nėra patvirtintos apskaitos integracijos ir numeravimo tvarkos, visur vartojamas tik terminas `sąskaitos juodraštis`.

## 3. Fazės vykdymo protokolas

Kiekviena F0–F10 fazė vykdoma ta pačia seka:

1. **Baseline:** užfiksuojamas commit, Preview deployment, duomenų būsena ir žinomi nukrypimai.
2. **Kontraktas:** prieš kodą aprašomi įėjimai, išėjimai, leidžiamos būsenos, klaidos ir teisės.
3. **Testai:** pirmiausia papildomi unit, integraciniai ir, kur aktualu, naršyklės testai.
4. **Įgyvendinimas:** atliekamas tik fazės apimties pakeitimas ir reikalinga migracija.
5. **Vietinė verifikacija:** lint, TypeScript, fazės testai, migracijos testas ir build.
6. **Preview verifikacija:** deploy į staging, techninis smoke test ir duomenų migracijos patikra.
7. **Rankinis priėmimas:** reali admin, kliento ir/ar darbuotojo kelionė desktop ir mobile režimu.
8. **Įrodymai:** išsaugomi anonimizuoti ekrano vaizdai, dokumentai, žinučių/job ID, testų išvestis ir žinomi nukrypimai.
9. **Fazės ataskaita:** sukuriamas `docs/implementation/phase-fX-*.md`, pažymima `GO`, `NO-GO` arba `GO WITH FOLLOW-UP`.
10. **Perėjimas:** kita fazė pradedama tik esant `GO`. `NO-GO` atveju taisoma ta pati fazė arba atliekamas rollback.

Kiekviena nauja rizikinga funkcija pirmiausia diegiama išjungta. Ji įjungiama staging tik fazės testui, o produkcijoje – tik F10 metu. Feature flag išjungimas turi grąžinti ankstesnį saugų veikimą, nepanaikindamas naujai sukurtų duomenų ar audit trail.

### Neperžengiamas fazės užbaigimo vartas

Kiekvienos fazės ataskaitos pabaigoje privalo būti penki vienareikšmiai rezultatai:

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```

Tik turint visus penkis rezultatus fazė žymima `Užbaigta` ir leidžiama pereiti prie kitos. Bet kuris `FAIL`, `NO`, nepatikrintas scenarijus ar nepaaiškintas duomenų neatitikimas reiškia, kad fazė lieka atidaryta. Dokumentacijos ar vieno sėkmingo mygtuko nepakanka funkcijai laikyti veikiančia.

### Bendros automatinės komandos

Po kiekvienos fazės privaloma paleisti bent:

```bash
npm run lint
npm run typecheck
npm run test:ci:unit
npm run test:ci:migrations
npm run build
```

E2E vykdomi su autorizuotu Vercel Deployment Protection bypass arba atskira testine autentifikacija. Vien anoniminis Playwright testas nelaikomas pilnos kelionės įrodymu.

## 4. Privalomas scenarijų katalogas

Šis katalogas nėra pasirenkamas. Fazės testuoja savo dalį, o F9 pakartoja visą matricą.

### 4.1 Užklausa ir kontaktas

- teisinga užklausa su pilnu adresu ir el. paštu;
- teisinga užklausa su telefonu, bet be el. pašto;
- nepilnas arba neteisingas adresas;
- adresas su norvegiškomis raidėmis ir buto numeriu;
- pakartotinai pateikta ta pati užklausa;
- dvi skirtingos užklausos tuo pačiu adresu;
- leidžiami ir neleidžiami priedai;
- kliento patvirtinimo laiško siuntimo klaida ir retry;
- klientas neturi el. pašto, bet turi tinkamą telefoną ir gauna saugią SMS nuorodą;
- el. paštas gauna `hard bounce` ir tolesnis veiksmas saugiai perkeliamas į SMS arba rankinio kontakto eilę;
- klientas neturi nei veikiančio el. pašto, nei tinkamo telefono;
- spam, honeypot, Turnstile ir rate-limit scenarijai;
- kliento sutikimo bei UTM/referer išsaugojimas.

### 4.2 Adresas, pastatas ir matavimas

- vienas aiškiai rastas gyvenamasis pastatas;
- keli pastatai tame pačiame sklype;
- pagrindinis namas, garažas ir ūkinis pastatas;
- du labai arti esantys kaimynų pastatai;
- daugiabutis ar bendras stogo kontūras;
- pastatas nerastas;
- adresas rastas, bet poligonas nerastas;
- keistas, dalinis arba sudėtingas poligonas;
- plokščias, vidutinio nuolydžio, status ir nežinomo kampo stogas;
- žemos, vidutinės ir aukštos confidence matavimas;
- administratorius pasirenka kitą kandidatą;
- administratorius koreguoja poligoną;
- administratorius keičia kampo grupę;
- administratorius ranka įveda plotą ir priežastį;
- žemėlapio/ortofoto šaltinis laikinai nepasiekiamas;
- vaizdas pasenęs arba pastatas uždengtas;
- screenshot generavimas nepavyksta;
- keičiamas jau pasiūlymui panaudotas matavimas;
- bandoma pakeisti pasirašytame dokumente panaudotą matavimą.
- pastatas ir poligonas nerasti, todėl administratorius įveda rankinį plotą ir tęsia be vizualinio priedo;

### 4.3 Kaina, pasiūlymas ir sutartis

- bazinis pasiūlymas;
- bazinis ir rekomenduojamas papildomos paslaugos variantas;
- kainos už m² pakeitimas;
- nuolaida leidžiamose ribose ir bandymas viršyti ribą;
- minimalios kainos bei PVM skaičiavimas;
- rankinis plotas perskaičiuoja visas susijusias sumas;
- HTML, el. laiško ir PDF sumų sutapimas;
- matavimo versijos ir, kai taikoma, vaizdo sutapimas pasiūlyme bei sutartyje;
- pasibaigęs, atšauktas arba pakeistas pasiūlymas;
- klientas peržiūri, klausia, pasirenka variantą arba atmeta;
- klientas pasirašo ir vėliau pateikia atšaukimo prašymą;
- klientas prašo pradėti darbus anksčiau nei leidžia patvirtintas atsisakymo procesas;
- klientas neperžiūri arba neatsako iki pasiūlymo galiojimo pabaigos;
- kliento parašas pele ir lietimu;
- pakartotinis pasirašymo bandymas;
- neteisingas, atšauktas ar pasibaigęs token;
- įmonės kontraparašas ir dviejų parašų PDF;
- draudimas pakeisti pasirašytą dokumentą.

### 4.4 Darbas ir darbuotojas

- darbo sukūrimas iš galutinės sutarties;
- pakartotinis paspaudimas nesukuria antro darbo;
- darbas be darbuotojo;
- aktyvaus ir neaktyvaus darbuotojo paskyrimas;
- darbuotojas be vardo ar telefono;
- data ir atvykimo intervalas;
- datos, intervalo arba darbuotojo pakeitimas;
- oro sąlygų sukeltas perkėlimas;
- darbuotojo liga, neatvykimas arba skubus perskyrimas kitam darbuotojui;
- kliento informavimas apie paskyrimą ir perskyrimą;
- 48 val., tos pačios dienos, „vykstu“, „atvykau“ ir užbaigimo komunikacija;
- darbuotojas mato tik savo darbus;
- priešpatikra be nuotraukų ir su nuotraukomis;
- plotas telpa į sutarties toleranciją;
- plotas ar apimtis viršija toleranciją;
- HMS blokavimas;
- pakeitimo susitarimo sukūrimas, siuntimas, priėmimas ir atmetimas;
- darbų pradžios blokavimas iki rašytinio patvirtinimo;
- prieš/po nuotraukų ir privalomų laukų kontrolė;
- prastas arba nutrūkęs mobilus internetas pildant priešpatikrą ir keliant nuotraukas;
- nutrūkusio nuotraukos įkėlimo pakartojimas, nepaliekant dalinio failo;
- užbaigimo dokumentų pateikimas ir administratoriaus patvirtinimas.
- garantinis kreipinys susiejamas su originalia užbaigta byla ir nekeičia jos istorijos;

### 4.5 Dokumentai, archyvas ir saugumas

- pasiūlymo, sutarties, galutinės sutarties, pakeitimo, darbo, sąskaitos juodraščio ir garantijos radimas;
- vieno kliento kelių bylų atskyrimas;
- dokumento versijos, hash ir prieigos kontrolė;
- užbaigta, atšaukta, prarasta, klaidinga ir spam byla;
- uždarymas, archyvavimas, šiukšlinė, atkūrimas ir retention;
- pasirašyto dokumento galutinio ištrynimo draudimas;
- parašo dokumento hash, versija, pasirašymo laikas, laiko zona, pasirašiusio asmens tapatybės ir techniniai įrodymai;
- pavojingas, netikro tipo, per didelis arba sugadintas įkeliamas failas;
- admin, worker ir anonimo prieigos;
- dviejų administratorių vienalaikis pakeitimas;
- kainyno, PVM, tolerancijos, garantijos ir sutarties šablono pakeitimas po seno pasiūlymo sukūrimo;
- idempotency, retry, dead-letter ir pradelsto job aptikimas;
- audit trail pilnumas;
- LT, NO ir EN panelės tekstai;
- desktop, siauro telefono, klaviatūros ir ekrano skaitytuvo pagrindinės kelionės.

## 5. Įgyvendinimo fazės

### F0 – baseline, būsenų kontraktas ir rollback

**Tikslas:** prieš taisymus užfiksuoti vieną tiesos šaltinį ir saugų grįžimo tašką.

**Darbai:**

- pažymėti dabartinį Git commit ir Preview deployment;
- sukurti anonimizuotą staging duomenų kopiją testams;
- sukurti stabilų testinių bylų seed paketą: vienas pastatas, keli kandidatai, pastatas nerastas, rankinis plotas be vizualo, kliento klausimas, atmetimas, kainos pakeitimas, viršyta tolerancija, nepavykęs laiškas ir užbaigta/archyvuota byla;
- inventorizuoti visas lead, quote, contract, work, message, job ir document būsenas;
- suprojektuoti vieną centrinį state transition/command sluoksnį, per kurį eis visi būsenas keičiantys API veiksmai, su optimistic concurrency, idempotency key ir audit event;
- aprašyti leidžiamus ir neleidžiamus perėjimus;
- kiekvienai aktyviai būsenai priskirti vieną `next action`, savininką, terminą ir galimą blokavimo priežastį;
- parengti automatizuotą invariantų ataskaitą;
- patikrinti backup atkūrimą izoliuotoje bazėje;
- sukurti autorizuoto E2E vykdymo būdą, apeinant tik testinę Vercel apsaugą.
- inventorizuoti ir dokumentuoti F0–F10 naudojamus feature flags, jų saugias numatytąsias reikšmes ir rollback elgseną.
- sudaryti Gemini, Kartverket, OSM, Norgeskart/Norge i bilder, Resend, SMS provider, Vercel Blob ir cron gedimų matricą: timeout, retry, bandymų limitas, fallback, rankinis veiksmas, admin perspėjimas, quota ir free-tier riba;
- patvirtinti kontaktinio kanalo taisyklę: veikiantis el. paštas yra numatytasis, SMS – tik atsarginė nuoroda be jautraus turinio, o be abiejų kanalų byla perduodama rankiniam kontaktui;
- patvirtinti pasirašytos sutarties atšaukimo, ankstyvos darbų pradžios sutikimo, pasiūlymo galiojimo, neatsakiusio kliento, oro sąlygų/perplanavimo ir garantinio kreipinio verslo taisykles;
- apibrėžti įmonės vardu sutartį galinčių pasirašyti aktyvių naudotojų sąrašą ir offboarding elgseną;
- apibrėžti versijuojamus price book, PVM, tolerancijos, garantijos ir teisinių šablonų snapshot kontraktus;
- patvirtinti retention matricą užklausoms, priedams, žinutėms, parašams, darbo nuotraukoms, pasirašytiems dokumentams, archyvui ir šiukšlinei;
- prieš pilotą nustatyti pamatuojamus SLA/KPI ir automatinius `NO-GO` slenksčius: adresų radimą, admin korekcijų dažnį, atsakymo laiką, laiškų pristatymą, matavimo nuokrypį, būsenų klaidas ir job vėlavimą;

**Tikrinama:** esami testai, migracijų dry-run, backup/restore ir kontrolinis staging smoke.

**Definition of Done:**

- galima tiksliai atkurti pradinę būseną;
- kiekviena techninė būsena turi vieną operacinę reikšmę ir kitą veiksmą;
- invariantų ataskaita aptinka žinomas prieštaringas bylas;
- testinių bylų seed paketas atkuriamas pakartotinai ir neturi realių klientų duomenų;
- kiekviena aktyvi būsena turi vieną aprašytą kitą veiksmą, savininką ir terminą;
- kiekvienas rizikingas pakeitimas turi feature flag ir patikrintą saugų išjungimą;
- state transition/command kontraktas neleidžia tiesiogiai keisti tarpusavyje susijusių statusų;
- visos išorinės integracijos turi sutartą gedimo ir rankinio tęstinumo kelią;
- kontaktų, retention, kainų/teisinių snapshot ir piloto KPI sprendimai užrašyti prieš schemos kūrimą;
- atšaukimo, ankstyvos pradžios, neatsakymo, perplanavimo, garantijos ir įgalioto pasirašančiojo taisyklės patvirtintos prieš kuriant jų būsenas;
- E2E runner gali pasiekti apsaugotą staging be žmogaus prisijungimo;
- yra F0 įrodymų ataskaita ir `GO`.

### F1 – duomenų nuoseklumas ir senų bylų sutaikymas

**Priklausomybė:** F0  
**Tikslas:** panaikinti neįmanomas būsenas ir užtikrinti, kad jos nebegrįžtų.

**Darbai:**

- sukurti server-side invariantų validatorių visai bylai;
- perkelti visas būsenas keičiančias operacijas į centrinį transition/command sluoksnį ir uždrausti tiesioginius statusų update iš UI ar pavienių route;
- invariantų validatoriuje reikalauti vieno operacinio `next action`, atsakingo asmens ir termino visoms aktyvioms byloms; keli tarpusavyje prieštaraujantys veiksmai laikomi klaida;
- sutvarkyti atvejus „darbas dokumentuotas, bet sutartis laukia įmonės parašo“;
- sutaikyti `scheduledAt` su atvykimo intervalo pradžia;
- aptikti pasirašytą sutartį be darbo, darbą be sutarties, dokumentą be versijos ir jau išsiųstą message su pasenusiu pending job;
- reguliariai vykdyti invariantų skenerį ir automatiškai kurti `Reikia dėmesio` įrašą, jeigu pasirašyta sutartis neturi darbo, darbas neturi darbuotojo ar datos, užbaigtas darbas neturi dokumentų, trūksta įmonės parašo, vėluoja žinutė arba nesutampa matavimo versijos;
- senų bylų automatiškai nekeisti tyliai: sudaryti migracijos preview, po to audituojamą taisymą;
- konkurencinius pakeitimus valdyti optimistic locking ir idempotency, kad du administratoriai, pakartotas webhook ar dvigubas mygtuko paspaudimas nesukurtų dviejų pasiūlymų, sutarčių ar darbų;
- nepašalinamas prieštaras rodyti `Reikia dėmesio` eilėje su konkrečiu veiksmu.

**Tikrinama:** kiekvieno invarianto unit testas, migracijos testas su staging kopija, pakartotinis migracijos paleidimas ir realių probleminių bylų peržiūra.

**Definition of Done:**

- invariantų skeneris neranda nepaaiškintų kritinių neatitikimų;
- žinomos senos bylos rodo vieną teisingą būseną ir kitą veiksmą;
- migracija idempotentiška ir turi audit event;
- naujos prieštaringos būsenos blokuojamos API lygiu;
- pakartotinis arba lygiagretus command duoda tą patį saugų rezultatą arba aiškų konflikto atsakymą;
- kiekvienas nustatytas neatitikimas turi aiškų taisymo veiksmą, savininką ir terminą;
- administratoriui nereikia suprasti techninių statusų.

### F2 – licencijuotas žemėlapio vaizdas ir matavimo įrodymo modelis

**Priklausomybė:** F1  
**Tikslas:** sukurti teisiškai ir techniškai saugų nekintamą matavimo įrodymą.

**Patvirtintas šaltinių sprendimas (2026-08-25):** mūsų iš išsaugotų poligonų generuojama schema yra pagrindinis nekintamas techninis matavimo įrodymas. Kartverket viešai leidžia naudoti `norgeskart.no` ir `norgeibilder.no` žemėlapių bei aeronuotraukų ekrano vaizdus su atitinkama atribucija, todėl jie naudojami kaip papildomas kontekstinis fonas. OSM duomenis galima naudoti mūsų scheminiam atvaizdavimui su ODbL atribucija. Google Maps nelaikomas tinkamu nekintamo PDF šaltiniu, nes Google Static Maps reikalauja billing, o oficialus FAQ neleidžia išsaugoti ir pateikti jų sugeneruotų vaizdų iš mūsų serverio.

**Oficialios nuorodos:** [Kartverket naudojimo sąlygos](https://www.kartverket.no/en/api-and-data/terms-of-use), [OpenStreetMap licencija ir atribucija](https://www.openstreetmap.org/copyright), [Google Maps Platform FAQ](https://developers.google.com/maps/faq).

**Darbai:**

- visada, kai yra patikimas poligonas, generuoti mūsų nekintamą scheminį vaizdą; `norgeskart.no` arba `norgeibilder.no` žemėlapio/aeronuotraukos iškarpą su atribucija `© norgeskart.no` arba `© norgeibilder.no` naudoti tik kaip papildomą kontekstinį foną;
- nenaudoti nukopijuoto Google Maps screenshot ar išsaugoto Google Static Maps vaizdo, nes šiam nekintamo PDF scenarijui Google reikalauja billing ir riboja sugeneruotų vaizdų saugojimą bei pateikimą iš savo serverio;
- užbaigti `MapProvider` adapterį su testiniu fake provider ir aiškia šaltinių prioritetų grandine;
- sukurti nuo išorinio vaizdų serverio nepriklausomą `SchematicRoofEvidenceProvider`: jis iš išsaugoto pasirinkto ir aplinkinių pastatų poligonų sugeneruoja mūsų SVG/PNG schemą su adreso žyma, pasirinkto stogo kontūru, kandidatų numeriais, šiaure, masteliu ir duomenų šaltinio atribucija;
- numatyti kompoziciją `mūsų scheminis poligonų įrodymas + pasirenkamas Norgeskart/Norge i bilder kontekstinis fonas`; išorinio fono nebuvimas nekeičia pagrindinio įrodymo;
- kai nėra patikimo pastato poligono, leisti audituojamą `manual_no_visual` matavimo režimą su privalomu administratoriaus įvestu plotu, pagrindimu ir patvirtinimu;
- matavimo versijoje saugoti adresą, koordinates, kandidatų ID, pasirinktą building ID, poligoną, horizontalų plotą, nuolydį, intervalą, confidence, šaltinį, atribuciją, imagery datą, pasirinkusį asmenį ir laiką;
- sugeneruotą žemėlapio/satellite vaizdą saugoti kaip privatų media snapshot su hash;
- ant vaizdo aiškiai pažymėti pasirinktą stogą, kandidatų ribas, mastelį, šiaurę ir šaltinio atribuciją;
- užtikrinti, kad šaltinio API raktas nepatektų į klientui siunčiamą HTML/PDF;
- apibrėžti išorinio fono pasenimo ir nepasiekiamumo būsenas; jos pašalina tik papildomą foną, bet nekeičia mūsų scheminio įrodymo ir nestabdo pasiūlymo.

**Tikrinama:** provider contract testai, snapshot hash testas, privataus media prieigos testas, licencijos/atribucijos checklist ir vaizdo generavimo fallback.

**Definition of Done:**

- kiekvienas patvirtinamas matavimas turi atkartojamą įvestį ir nekintamą vaizdą;
- vaizdas turi aiškią atribuciją ir patvirtintą naudojimo teisę;
- pakeitus matavimą kuriama nauja versija ir naujas hash;
- scheminis įrodymas sukuriamas nepriklausomai nuo išorinio vaizdo šaltinio, jeigu yra patikimas pastato poligonas;
- jeigu nėra patikimo pastato poligono, administratorius gali įvesti rankinį plotą ir tęsti visą procesą be vizualinio priedo;
- `manual_no_visual` režimas negali būti patvirtintas be ploto, administratoriaus tapatybės, datos ir pagrindimo;
- abu vaizdo variantai turi tinkamą šaltinio atribuciją, o sistemoje saugoma, kuris variantas buvo panaudotas.

### F3 – paprastas pastato pasirinkimas ir matavimo korekcija `admin-v2`

**Priklausomybė:** F2  
**Tikslas:** administratorius vienoje aiškioje vietoje pasirenka tikrą kliento pastatą ir patvirtina skaičiavimą.

**Tikslinė sąsaja:**

- viršuje rodomas kliento adresas ir žemėlapio vaizdas;
- visi rasti pastatai pažymėti raidėmis arba numeriais;
- greta pateikiamos kandidatų kortelės su tipu, apytiksliu plotu, atstumu nuo adreso taško ir confidence;
- paspaudus kandidatą jis paryškinamas žemėlapyje ir perskaičiuojamas stogas bei kaina;
- administratorius mato „prieš“ ir „po pasirinkimo“ rezultatą, bet pakeitimas neišsaugomas be patvirtinimo;
- galima pataisyti poligoną, kampo grupę arba įvesti rankinį plotą su privaloma priežastimi;
- aiškūs veiksmai: `Pasirinkti šį pastatą`, `Perskaičiuoti`, `Patvirtinti matavimą`, `Reikia kliento patikslinimo`.

**Darbai:**

- pašalinti įprastų ADDRESS_NOT_FOUND, BUILDING_NOT_FOUND ir BUILDING_AMBIGUOUS scenarijų priklausomybę nuo Payload;
- įdiegti kandidatų sąrašą, interaktyvų pasirinkimą ir saugią server-side validaciją;
- pridėti adreso ir paslaugos korekciją;
- pridėti poligono ir kampo korekciją su before/after auditu;
- rankinį plotą aiškiai žymėti kaip administratoriaus override ir leisti pasirinkti `Rankinis plotas be žemėlapio`, kai pastato pažymėti negalima;
- rankiniam plotui reikalauti šaltinio: `pateikė klientas`, `apskaičiuota pagal brėžinį`, `administratoriaus įvertinimas` arba `išmatuota objekte`;
- tikrinti realistiškas ploto ribas ir perspėti apie galimą dešimtainio kablelio, nulio ar matavimo vieneto klaidą;
- jeigu rankinis plotas nuo automatinio ploto ar ankstesnės patvirtintos versijos skiriasi daugiau kaip 20 %, reikalauti antro aiškaus patvirtinimo ir privalomo paaiškinimo; pats skirtumas nekeičia ploto automatiškai;
- po kiekvieno pakeitimo kurti naują draft measurement versiją;
- rodyti skaičiavimo formulę ir paklaidos paaiškinimą paprasta kalba.

**Tikrinama:** visi 4.2 scenarijai, desktop/mobile, klaviatūra, dviejų administratorių konfliktas ir neleistina tiesioginė API užklausa.

**Definition of Done:**

- administratorius gali išspręsti vieno, kelių ir nerasto pastato scenarijų custom admin aplinkoje;
- nerasto pastato scenarijuje administratorius gali privalomai įvesti stogo kvadratūrą, pagrindimą ir tęsti pasiūlymo, sutarties bei darbo procesą be vaizdo;
- pasirinktas kandidatas akivaizdžiai pažymėtas ir išlieka po puslapio perkrovimo;
- plotas ir kainos preview perskaičiuojami deterministiškai;
- kiekvienas pakeitimas turi aktorių, laiką, priežastį ir ankstesnę reikšmę;
- rankinis plotas turi šaltinio klasifikaciją, o >20 % nuokrypis negali būti išsaugotas be papildomo patvirtinimo;
- Payload nereikalingas nė vienam normaliam matavimo patikslinimui.

### F4 – matavimo pagrindas pasiūlyme, sutartyje ir galutiniuose PDF

**Priklausomybė:** F2, F3  
**Tikslas:** klientas ir administratorius visuose svarbiuose dokumentuose mato tą patį patvirtintą matavimo pagrindą: pažymėtą stogą, kai jis nustatytas, arba aiškiai aprašytą administratoriaus rankinį plotą, kai vizualo nėra.

**Darbai:**

- pasiūlymo HTML ir PDF pridėti skyrių `Beregnet tak`;
- rodyti adresą, pažymėtą stogo vaizdą, pasirinkto pastato identifikaciją, horizontalų plotą, nuolydžio pagrindą, apskaičiuotą intervalą, confidence ir šaltinio atribuciją;
- `manual_no_visual` režime nerodyti tuščio vaizdo ar vizualinio priedo; vietoje jo tame pačiame skyriuje rodyti ranka įvestą plotą, kas ir kada jį patvirtino, matavimo pagrindą bei privalomą patikros objekte paaiškinimą;
- vaizdą turinčiame režime sutartyje naudoti tą patį vaizdą ir measurement version ID/hash; `manual_no_visual` režime naudoti tą patį rankinio ploto snapshot ir measurement version ID/hash;
- kai vaizdas yra, jį talpinti dokumento turinyje, ne kaip laikiną išorinę nuorodą;
- paaiškinti, kad galutinis plotas tikrinamas objekte, o reikšmingas nukrypimas sprendžiamas rašytiniu pakeitimo susitarimu prieš darbus;
- pasiūlyme ir sutartyje užrakinti price book, PVM, tolerancijos, garantijos ir teisinio šablono versijų snapshot; vėlesni nustatymų pakeitimai negali pakeisti jau sukurtos versijos;
- admin preview vienu metu rodyti būsimą el. laišką, pasiūlymą ir sutartį;
- prieš siuntimą rodyti vieną galutinės patikros ekraną su klientu, adresu, pasirinktu pastatu arba `Rankinis plotas be žemėlapio`, ploto šaltiniu, kaina už m², nuolaida, PVM, galutine ir maksimalia kaina, el. laišku, pasiūlymo PDF bei sutarties PDF;
- galutiniame ekrane turėti vieną aiškų veiksmą `Patvirtinti ir siųsti`; patvirtinimas saugo tikslų administratoriaus matytą snapshot;
- vaizdą turinčiame režime užblokuoti patvirtinimą, jeigu jo nėra arba pasiūlymo, sutarties ir matavimo versijos nesutampa; `manual_no_visual` režime tikrinti privalomą plotą, pagrindimą ir tą pačią matavimo versiją abiejuose dokumentuose;
- pakeitus matavimą automatiškai supersede ankstesnį nepasirašytą pasiūlymą ir sutartį.

**Tikrinama:** HTML/PDF vizualinė regresija, hash/version testai, mobilus kliento puslapis, atsisiųstas PDF, vaizdo šaltinio klaida ir pasirašyto dokumento nekintamumas.

**Definition of Done:**

- vaizdą turinčiame režime tas pats aiškiai pažymėtas stogas matomas admin preview, kliento pasiūlyme ir sutartyje;
- `manual_no_visual` režime pasiūlymas ir sutartis sugeneruojami be vizualinio priedo, bet su tuo pačiu rankiniu plotu, pagrindimu ir patikros objekte sąlyga;
- galutiniame dviejų parašų PDF vaizdas ir tekstas neišnyksta;
- pasiūlymo, sutarties ir measurement versijos bei hash sutampa;
- senas pasiūlymas ir sutartis po kainyno ar teisinio šablono pakeitimo išlaiko savo ankstesnius skaičius bei tekstą;
- prieš siuntimą administratorius viename ekrane patvirtina visą ekonominį, matavimo, laiško ir dokumentų snapshot;
- nėra nutrūkusių vaizdų ar nuo laikinų URL priklausančių PDF; išorinio vaizdo gedimo atveju PDF automatiškai naudoja išsaugotą scheminį įrodymą;
- klientas vienareikšmiškai supranta, kuris pastatas ir kokia paklaida įtraukti į kainą.

### F5 – visos operacinės išimtys custom admin aplinkoje

**Priklausomybė:** F3, F4  
**Tikslas:** Payload paliekamas tik techninei diagnostikai, o ne kasdieniam darbui.

**Darbai:**

- custom admin pridėti change agreement kūrimą, kainos/plotų palyginimą, preview, patvirtinimą, siuntimą, atšaukimą ir kliento atsakymą;
- blokuotame darbe rodyti tikslią priežastį ir vieną leidžiamą kitą veiksmą;
- pridėti trūkstamos informacijos užklausą klientui;
- pridėti žemos confidence, neaiškios paslaugos ir nepavykusio automatinio paketo sprendimo veiksmus;
- darbuotojui neleisti pradėti darbo, kol reikalingas pakeitimas nepriimtas;
- neleisti customer-facing paskyrimo, kol darbuotojas neturi aktyvios paskyros, pilno vardo ir telefono;
- darbuotojo mobilioje aplinkoje priešpatikrą bei tekstinius laukus laikinai saugoti kaip lokalų juodraštį, aiškiai rodant `neišsiųsta`, `siunčiama`, `išsiųsta` ar `klaida`;
- prieš įkeliant sumažinti ir tinkamai orientuoti dideles telefono nuotraukas, naudoti pakartojamus/resumable upload ir po įkėlimo tikrinti failo vientisumą;
- sukurti vieną `Perkelti darbą` command, kuris saugo priežastį, ankstesnę datą, naują datą bei intervalą, atšaukia senus priminimus ir informuoja klientą bei darbuotoją;
- darbuotojo ligos ar neatvykimo atveju leisti perskirti darbą, išsaugant visą ankstesnio paskyrimo istoriją ir išsiunčiant atnaujintą kontaktą klientui;
- po užbaigimo leisti sukurti atskirą garantinę bylą, susietą su originaliu darbu, sutartimi, nuotraukomis ir garantijos terminu, nekeičiant originalaus užsakymo istorijos;
- nepalikti kasdienių mygtukų, vedančių į Payload collection;
- technines nuorodas rodyti tik suskleistoje diagnostikos dalyje techniniam administratoriui.

**Tikrinama:** matavimo išimtys, work block, change accepted/declined/expired, pakartotinis siuntimas, neteisinga būsena ir rolės prieiga.

**Definition of Done:**

- administratorius visas numatytas išimtis išsprendžia `admin-v2`;
- darbuotojas negali apeiti patvirtinimo tiesioginiu API kvietimu;
- klientui visada rodoma viena aktuali dokumento versija;
- kiekvienas blokavimas turi aiškų savininką, terminą ir veiksmą;
- techninis backoffice nereikalingas priėmimo scenarijams.
- nutrūkus internetui darbuotojas nepraranda užpildytos priešpatikros, o nepilnas failas nelaikomas priimta nuotrauka;
- perplanavimas ar perskyrimas nepalieka aktyvių senos datos priminimų, o garantinė byla turi savo atsakingą asmenį, veiksmą ir terminą;

### F6 – tiksli, idempotentiška komunikacija ir darbų planuoklis

**Priklausomybė:** F1  
**Tikslas:** klientas laiku gauna tik teisingas ir nepasikartojančias žinutes.

**Darbai:**

- operational jobs vykdyti pakankamai dažnai 48 val. ir tos pačios dienos priminimams;
- laiko taisykles skaičiuoti `Europe/Oslo`, įskaitant DST;
- event-driven būdu nedelsiant apdoroti užklausos gavimą, paskyrimą, perskyrimą, „vykstu“, „atvykau“, užbaigimą ir kontraparašą;
- atšaukti senus job pakeitus datą, intervalą ar darbuotoją;
- oro sąlygų, darbuotojo ligos ar kitos administratoriaus patvirtintos priežasties atveju siųsti vieną aiškią perkėlimo žinutę su nauju planu arba pažadu susisiekti dėl naujos datos;
- pridėti overdue pending, retry ir dead-letter aptikimą;
- kasdienis invariantų skeneris negali pakeisti event-driven komunikacijos; jis naudojamas tik praleistiems ar prieštaringiems procesams aptikti ir perduoti į `Reikia dėmesio`;
- pranešimuose rodyti darbuotojo pilną vardą ir telefoną; jei jų nėra, neleisti customer-facing paskyrimo ir sukurti administratoriui užduotį papildyti darbuotojo profilį;
- Payload delivery status atnaujinti pagal Resend webhook;
- el. paštą naudoti kaip pagrindinį pasiūlymo, sutarties ir darbų komunikacijos kanalą;
- SMS siųsti tik kai nėra tinkamo el. pašto arba gautas galutinis `hard bounce`; SMS nesiunčia dokumento ar jautrių duomenų, tik trumpą norvegišką tekstą ir pasirašytą, atšaukiamą, riboto galiojimo HTTPS nuorodą;
- jei nėra nei veikiančio el. pašto, nei tinkamo telefono, nesiųsti automatiškai ir sukurti aiškią `Rankinis kontaktas` admin užduotį;
- priimti tiesioginius kliento el. pašto atsakymus per unikalų bylos `Reply-To` arba inbound webhook, saugiai susieti juos su byla ir sukurti admin užduotį;
- pasiūlymui ar sutarčiai neatsakius siųsti tik iš anksto patvirtintą priminimų skaičių, po galiojimo termino sustabdyti nuorodą ir perkelti bylą į aiškią `Neatsakė / reikalingas sprendimas` būseną;
- įgyvendinti F0 gedimų matricos timeout, retry, quota ir fallback taisykles visiems komunikacijos bei automatizacijos provider;
- admin rodyti suplanuotą, išsiųstą, pristatytą, bounce, failed ir atšauktą būseną be klaidinančių žymų.

**Tikrinama:** fake-clock testai, DST, reschedule, retry, provider timeout, duplicate event, bounce webhook ir realūs staging laiškai į kontrolinę dėžutę.

**Definition of Done:**

- 48 val. ir tos pačios dienos žinutės išsiunčiamos numatytame tolerancijos lange;
- 08:00 vizito tos pačios dienos žinutė negali būti išsiųsta po vizito pradžios;
- joks reschedule ar retry nesukuria dvigubos žinutės;
- pradelstas job per sutartą laiką tampa matomas `Reikia dėmesio`;
- klientas gauna teisingą darbuotojo ir atvykimo informaciją.
- klientas negauna dubliuojančios SMS, kai el. paštas veikia; SMS fallback nuoroda atidaro tą pačią aktualią kliento versiją ir gali būti atšaukta;
- be jokio veikiančio kontakto byla nepametama, o patenka į rankinio kontakto eilę.
- tiesioginis el. pašto `Reply` matomas toje pačioje kliento byloje ir negali būti priskirtas kitam klientui;
- pasibaigęs pasiūlymas nebegali būti priimtas ar pasirašytas, o pakartotinis aktyvavimas sukuria naują galiojančią versiją;

### F7 – paprasta ir tiksli administratoriaus darbo vieta

**Priklausomybė:** F1, F5, F6  
**Tikslas:** visos kortelės, sąrašai, datos, dokumentai ir veiksmai reiškia tai, ką administratorius tikisi.

**Darbai:**

- `Naujos užklausos` grįsti administratoriaus peržiūros žyma, ne techniniu statusu;
- kiekvienos bylos viršuje visada rodyti vieną `Kitas veiksmas`, jo savininką, terminą ir blokavimo priežastį; negalima vienu metu rodyti dviejų prieštaringų pagrindinių veiksmų;
- atskirti `Pasirašyta – sukurti darbą`, `Laukia darbuotojo`, `Reikia suplanuoti`, `Artimiausi`, `Aktyvūs`, `Užbaigimo patikra` ir `Reikia dėmesio`;
- pašalinti pradėtus darbus iš `Artimiausi`, jeigu jie jau priklauso aktyviai eigai;
- darbų sąrašuose rodyti vizito datą, atvykimo intervalą ir darbuotoją, o ne `updatedAt`;
- sutvarkyti laiko juostos nuorodas į invoices, warranties ir dokumentus;
- išplėsti vieningą paiešką į archyvą, šiukšlinę, dokumentų, sąskaitų ir garantijų numerius;
- sujungti uždarymo ir archyvavimo kelią į aiškią vedamą formą su klasifikacija ir priežastimi;
- iš aktyvių pasiūlymų pašalinti uždarytų bylų įrašus;
- admin nustatymuose rodyti integracijų būklę, production gate ir paaiškinimą, kaip ištaisyti trūkumą;
- sveikatos ekrane rodyti Gemini, Kartverket, OSM, Norgeskart/Norge i bilder, Resend, SMS, Blob ir cron būklę, paskutinį sėkmingą vykdymą, quota perspėjimus, vėluojančius/failed job ir paskutinio patikrinto backup datą;
- aiškiai atskirti bylos vadybininką nuo darbui priskirto darbuotojo.
- visur vartoti `sąskaitos juodraštis`, kol F0 sprendimų registre nėra patvirtintos oficialios apskaitos integracijos ir numeravimo tvarkos;
- garantines bylas rodyti atskiroje veiksmų eilėje, bet kartu aiškiai susieti su originalaus kliento darbo dokumentais.

**Tikrinama:** skaitiklio–eilės paritetas, visų kortelių filtrai, realūs scenarijai, paieška, archyvas/restore, mobilus ir desktop UI, LT/NO/EN.

**Definition of Done:**

- nė viena veiksmo laukianti byla nepradingsta;
- kiekviena aktyvi byla turi vieną suprantamą pagrindinį veiksmą, savininką ir terminą;
- kiekvienos kortelės skaičius sutampa su atidaromos eilės įrašais;
- kiekviena data ir statusas turi aiškų pavadinimą bei verslo reikšmę;
- dokumentų ir laiko juostos nuorodos atidaro tikslų objektą;
- administratorius vienoje vietoje mato integracijų, job, laiškų ir backup būklę be Payload;
- administratorius įprastoje kelionėje neatidaro Payload.
- sąsaja niekur neklaidina, kad vidinis dokumentas yra oficiali išrašyta ar apmokėta sąskaita;

### F8 – AI atsakymai, kliento klausimai ir atmetimo gelbėjimas

**Priklausomybė:** F5, F6  
**Tikslas:** kiekvienas kliento atsakymas sukuria aiškią administratoriaus užduotį ir saugų Gemini juodraštį.

**Darbai:**

- kliento klausimas automatiškai enqueue AI reply draft;
- inbound el. pašto atsakymas naudoja tą patį klausimo, admin užduoties ir AI juodraščio procesą kaip saugus kliento puslapis;
- būsena turi reikšti, kad atsakymo laukia klientas, ne klaidinančiai `waiting_customer`;
- Gemini naudoja bylos santrauką, patvirtintą matavimą, kainos snapshot ir kliento klausimą, bet nekuria naujų kainų;
- administratoriui rodyti originalią žinutę, AI juodraštį, faktų patikros perspėjimus, redagavimą ir `Patvirtinti bei siųsti`;
- kliento atmetimas saugo struktūrinę priežastį ir automatiškai parengia mandagų follow-up juodraštį;
- kliento atšaukimo prašymas po pasirašymo sustabdo darbų sukūrimą ar pradžią, saugo originalų prašymą ir laukia tik administratoriaus sprendimo;
- administratorius gali siųsti pakeistą pasiūlymą, pažymėti `prarasta` arba uždaryti/archyvuoti bylą;
- išsaugoti visą komunikacijos ir pasiūlymų versijų istoriją.

**Tikrinama:** klausimas, keli klausimai, atmetimo priežastys, netinkamas AI tekstas, draft regeneravimas, siuntimo klaida ir uždaryta byla.

**Definition of Done:**

- naujas kliento klausimas per sutartą laiką sukuria juodraštį ir admin užduotį;
- AI negali pakeisti patvirtintų skaičių ar pažadėti datos;
- juodraštis niekada neišsiunčiamas be administratoriaus veiksmo;
- atmetimo byla turi vieną aiškų kitą veiksmą;
- atšaukimo ir ankstyvos darbų pradžios prašymai negali būti automatiškai patvirtinti AI ar darbuotojo;
- išgelbėtas, prarastas ir uždarytas užsakymas turi pilną audit trail.

### F9 – saugumas, observability ir pilnas autentifikuotas E2E

**Priklausomybė:** F1–F8  
**Tikslas:** įrodyti ne tik happy path, bet ir visas numatytas klaidas, teises bei atkūrimą.

**Darbai:**

- automatizuoti kliento → admin → kliento → įmonės parašo → darbuotojo → admin → kliento E2E;
- kiekvieną E2E paleidimą pradėti nuo stabilaus F0 testinių bylų seed paketo ir patikrinti, kad testas nepalieka nepaaiškintų aktyvių job ar bylų;
- naudoti tikrą testinę DB, fake AI/map/email režimą CI ir kontroliuojamas realias integracijas staging;
- patikrinti admin/worker/anonymous objektų prieigas ir privačius failus;
- tikrinti įkeliamo failo MIME pagal turinį, dydį ir leidžiamą formatą, taikyti malware scan arba karantiną iki patikros, atmesti pavojingus ar sugadintus failus, pašalinti nereikalingus EXIF vietos duomenis ir privačius failus pateikti tik autorizuotomis arba riboto galiojimo nuorodomis;
- patikrinti token expiry, revoke, replay, CSRF/origin ir rate limiting;
- įtraukti Turnstile ir serverless-safe rate-limit būklę į platform health;
- testuoti provider timeout, dalinį gedimą, retry, idempotency ir konkurenciją;
- kiekvienam F0 inventorizuotam feature flag patikrinti `off`, `on`, klaidos ir rollback režimus;
- atlikti accessibility, responsive ir PDF visual regression;
- patikrinti retention matricą: automatinį archyvavimą, anonimizavimą, atkūrimą, pasirašytų dokumentų apsaugą ir saugų galutinį ištrynimą tik leistinais atvejais;
- patikrinti parašo įrodymų paketą: dokumento hash ir versiją, pasirašymo laiką bei laiko zoną, pasirašiusio vardą, įgaliotą įmonės atstovą, sutikimo įrodymą ir proporcingus techninius duomenis;
- deaktyvavus darbuotoją ar įmonės pasirašantį asmenį išsaugoti istorinių dokumentų įrodymą, bet neleisti jam atlikti naujų veiksmų;
- patikrinti staging ir production bazių, Blob konteinerių, domenų, webhook bei secrets atskyrimą;
- pakartoti backup/restore su nauja schema;
- pašalinti Windows ARM64 build priklausomybės spragą arba dokumentuoti patikimą Linux build vartus.

**Tikrinama:** visas 4 skyriaus scenarijų katalogas ir automatiniai komandų vartai.

**Definition of Done:**

- visi kritiniai E2E scenarijai praeina be rankinių Payload pataisymų;
- visi seed scenarijai gali būti pakartoti nepriklausomai ir duoda tą patį laukiamą rezultatą;
- kiekvienas feature flag saugiai išjungia savo naują elgseną, nepažeisdamas duomenų;
- nėra P0/P1 saugumo ar duomenų vientisumo defektų;
- visi automatiniai vartai žali oficialioje build aplinkoje;
- backup sėkmingai atkurtas ir patikrintas;
- retention ir aplinkų izoliacijos testai neturi duomenų nutekėjimo ar neleistino pasirašytų dokumentų ištrynimo;
- failų, parašų ir offboarding testai neleidžia suklastoti versijos, įkelti pavojingo failo ar atlikti naujo veiksmo deaktyvuotu naudotoju;
- yra pilna anonimizuota F9 testų ir audito ataskaita.

### F10 – staging pilotas ir Production gate

**Priklausomybė:** F9  
**Tikslas:** tik įrodymais pagrįstai nuspręsti, ar sistemą galima aktyvuoti gyvai.

**Darbai:**

- pakeisti staging-only teisinius tekstus tik teisininko / savininko patvirtintais norvegiškais šablonais;
- patvirtinti norvegišką kliento atšaukimo po pasirašymo, ankstyvos darbų pradžios ir garantinio kreipinio tekstą bei procesą;
- įdėti tikrą standartinę atsisakymo formą ir galiojančias nuorodas;
- gauti pricing, signature, contract, communication ir worker mobile QA patvirtinimus;
- atlikti 20–30 anonimizuotų pilotinių užklausų skirtingais scenarijais;
- pagal F0 patvirtintus SLA/KPI stebėti adresų automatinio radimo dalį, matavimo tikslumą, admin korekcijų dažnį, užklausos patvirtinimo ir pasiūlymo parengimo laiką, laiškų pristatymą, job vėlavimą, klaidingas būsenas ir užsakymų konversiją;
- automatiškai sustabdyti production `GO`, jeigu viršijamas bent vienas iš anksto patvirtintas P0/P1 ar duomenų vientisumo slenkstis;
- užpildyti visas `docs/operations/release-gate-register.md` nuorodas realiais įrodymais;
- parengti cutover, monitoring ir rollback planą;
- gauti atskirą savininko production `GO`.

**Tikrinama:** pilot report, restore report, teisinių tekstų patvirtinimas, platform health, production-like migration rehearsal ir galutinis smoke planas.

**Definition of Done:**

- nė vienas release gate įrodymas nėra `Ikke utført` arba `Avslått`;
- staging sutartis yra teisiškai patvirtintas dokumentas, ne testinis placeholder;
- pilotas neturi neišspręstų P0/P1 problemų;
- kiekvienas F0 nustatytas KPI turi rezultatą, imtį, paaiškinimą ir aiškų `PASS` arba `FAIL`;
- monitoring, incident ir rollback atsakomybės paskirtos;
- produkcija aktyvuojama tik po rašytinio savininko patvirtinimo.

## 6. Bendras funkcijos užbaigimo standartas

Funkcija negali būti pažymėta užbaigta vien todėl, kad mygtukas matomas arba vienas testas žalias. Ji laikoma veikiančia tik kai:

- verslo būsena ir leidžiami perėjimai aprašyti;
- server-side API neleidžia apeiti UI taisyklių;
- unit ir integraciniai testai apima sėkmę, klaidą, retry ir pakartotinį veiksmą;
- migracija patikrinta su produkciją primenančia duomenų kopija;
- admin/worker/customer teisės patikrintos;
- veikia desktop ir mobile;
- LT/NO/EN panelės tekstai aiškūs, o klientų tekstai yra norvegų kalba;
- realioje staging aplinkoje žmogus užbaigia scenarijų be techninio Payload;
- įvykis, dokumentas ir žinutė matomi audit trail;
- klaidos matomos administratoriui ir turi taisomą kitą veiksmą;
- yra rollback ir fazės įrodymų ataskaita;
- ankstesnių fazių regresijos testai lieka žali.

## 7. Prioritetas ir draudimas trumpinti seką

Fazių tvarka yra privaloma:

```text
F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10
```

- F1 atliekama prieš naują UI, kad sąsaja nerodytų prieštaringų duomenų.
- F2–F4 atliekamos kaip viena kritinė matavimo įrodymo grandinė, bet turi atskirus testavimo vartus.
- F5 užbaigia išimtis prieš kosmetinį administratoriaus eilių poliravimą.
- F6 atliekama prieš galutinį E2E, nes netikslus scheduler gali sugadinti teisingą verslo kelionę.
- F9 negalima pakeisti vien rankiniu testu.
- F10 negalima pradėti, kol F0–F9 neturi `GO`.

## 8. Sąmoningai neįtraukiama į šį etapą

- Google Ads ir Meta kampanijų valdymas;
- oficiali apskaitos sistema ar mokėjimų surinkimas;
- pažangus darbuotojų maršrutų optimizavimas;
- papildomos vidinės rolės;
- automatinis kainos ar sutarties siuntimas be administratoriaus patvirtinimo;
- automatinis darbų saugos sprendimas naudojant AI.

Šie darbai gali būti planuojami tik užbaigus F10 arba kaip atskiri projektai, kad nekeltų rizikos pagrindinei užsakymų kelionei.
