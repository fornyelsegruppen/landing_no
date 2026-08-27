# Takfornyelse — vienos dienos Production GO planas

Data: 2026-08-26  
Vykdymo aplinka iki cutover: `https://takfornyelse-staging.vercel.app`  
Pradinė būsena: **Kontroliuojamas Production pilotas aktyvus; pilna automatika NO-GO**
Šiandienos tikslas: **GO kontroliuojamam produkciniam pilotui**, ne neprižiūrimai pilnai automatikai.

## 1. Ką šiandien vadiname GO

`GO_CONTROLED_PRODUCTION_PILOT` galima suteikti tik tada, kai:

- techniniai, saugos ir kritiniai vartotojo keliai yra PASS;
- produkcijos backup ir rollback yra realiai patikrinti;
- įmonės savininkas patvirtino kainodarą, sutarties kandidatą, komunikaciją ir privatumo informaciją;
- visos klientui siunčiamos kainos, pasiūlymai, sutartys ir AI tekstai lieka su administratoriaus patvirtinimu;
- sąskaita lieka juodraščiu / eksportu į patvirtintą apskaitos sistemą, kol nepatvirtinta teisėta nekintama numeracija ir buhalterinė eiga;
- veikia greitas susijusios funkcijos išjungimas ir ankstesnio deploy rollback;
- pirmos realios bylos stebimos rankiniu būdu.

`GO_FULL_AUTOMATION` šiandien nesuteikiamas vien techniniu testu. Jam toliau reikės 20–30 realių bylų piloto, bent 3 fizinių stogo matavimų palyginimo ir užregistruotos teisinės peržiūros.

## 2. Nekeičiamos STOP taisyklės

Bet kuris iš šių atvejų reiškia NO-GO arba nedelsiamą atitinkamo feature flag išjungimą:

1. Netinkamam klientui atskleidžiama byla, nuotrauka, dokumentas ar tokenas.
2. Klientui be administratoriaus patvirtinimo išsiunčiama kaina, sutartis ar naujas AI teiginys.
3. Kaina, PVM, maksimali kaina arba dokumento versija skiriasi admin, web, PDF ir el. laiške.
4. Sutartis laikoma galutine be kliento ir įmonės parašų ar be tikslaus dokumento hash.
5. Darbuotojas gali pradėti darbą be patikros arba apeiti HMS / kainos nuokrypio blokavimą.
6. Tas pats kliento veiksmas, laiškas, sutartis ar finansinis dokumentas sukuriamas du kartus.
7. Neveikia produkcijos backup, restore arba rollback.
8. Nėra aiškaus atsakingo žmogaus incidentui ir pirmos dienos stebėjimui.

## 3. Fazių seka

Kiekviena fazė uždaroma tik tada, kai įrašyta faktinė išvada, įrodymo nuoroda ir atsakingo žmogaus patvirtinimas. Nepavykus fazei taisome trūkumą ir kartojame ją; į kitą fazę neiname.

### Komandinio darbo protokolas

- Asistentas atlieka kodo, dokumentų, testų, duomenų logikos, auditų ir rezultatų analizę.
- Savininkas atlieka prisijungimus, 2FA, CAPTCHA, slaptų raktų sukūrimą/įvedimą, sąskaitos ar teisinių sprendimų patvirtinimą ir kitus veiksmus, kuriems būtina žmogaus tapatybė ar slaptas duomuo.
- Kai reikalingas savininko veiksmas, asistentas nedelsdamas atidaro tikslų langą ir pateikia trumpą instrukciją: kur spausti, ką pasirinkti ir kokio rezultato laukti.
- Slaptažodžiai, OTP, API raktai ir klientų duomenys nekopijuojami į pokalbį ar repozitoriją.
- Savininkas parašo `atlikta` arba `prisijungta`; asistentas iškart patikrina rezultatą ir tęsia nuo sustojimo vietos.
- Išorinis negrįžtamas veiksmas (produkcijos deploy, viešas publikavimas, tikro kliento laiškas, feature flag įjungimas, duomenų trynimas) visada turi atskirą veiksmo momento patvirtinimą.

### P0 — apimtis, įmonės duomenys ir atsakomybės

**Oficialiai patikrinta 2026-08-26 per Brønnøysund Enhetsregister API**

- juridinis pavadinimas: `FORNYELSE GRUPPEN AS`;
- org. nr.: `916 693 168`;
- registruotas adresas: `Lyngveien 28, 1182 OSLO`;
- registruota `Merverdiavgiftsregisteret`: taip;
- registruota `Foretaksregisteret`: taip;
- dabartinė pagrindinė veiklos klasė: `41.000 Oppføring av bygninger`.

Dokumentuose pardavėjo eilutė turi būti rašoma kaip `Fornyelse Gruppen AS, org.nr. 916 693 168 MVA, registrert i Foretaksregisteret`, nebent buhalteris ar teisininkas nurodo tikslesnį privalomą formatą.

**Savininko patvirtinta 2026-08-26**

- produkcijos, incidentų, kainų ir dokumentų patvirtinimo atsakingas: įmonės savininkas;
- oficialios sąskaitos išrašomos tik per `Fiken`;
- klientų kontaktai: `post@takfornyelse.as` ir `+47 47 73 58 88`;
- kontroliuojamo piloto metu administratorius privalo patvirtinti kiekvieną komercinę išvestį prieš ją siunčiant klientui.

**Veiksmai**

- patvirtinti juridinį pardavėją, org. nr., registruotą adresą, klientų el. paštą ir telefoną;
- patvirtinti, ar įmonė registruota MVA registre ir kaip tiksliai tai turi būti rodoma dokumentuose;
- paskirti produkcijos savininką, incidentų atsakingą, kainų tvirtintoją ir sutarties/privatumo tvirtintoją;
- sutarti, kuri apskaitos sistema išduoda oficialią sąskaitą ir kaip originalas patenka į admin archyvą;
- patvirtinti paleidimo apimtį: administratoriaus peržiūra privaloma visoms komercinėms išvestims.

**PASS**

- visi penki sprendimai įrašyti šiame dokumente arba susietame patvirtinimo lape;
- nėra prieštaringų įmonės rekvizitų svetainėje, laiškuose ir PDF.

### P1 — sutarties ir oficialių dokumentų paketas

**Paruošiami ir peržiūrimi norvegiški dokumentai**

1. `Tilbud og håndverkerkontrakt` — darbo apimtis, neįtraukti darbai, medžiagos, objekto adresas, pradžios/užbaigimo planas, kaina, PVM, tolerancija, maksimali kaina, mokėjimas, prieiga, kliento ir rangovo pareigos, vėlavimas, trūkumai, atšaukimas, ginčai.
2. `Angrerettinformasjon` ir standartinis `angreskjema` — klientui pateikiami iki pasirašymo ir išsaugomame PDF.
3. Atskiras ankstyvos darbų pradžios prašymas — neprivalomas, neužžymėtas iš anksto, fiksuojamas tik jei darbas pradedamas per 14 dienų.
4. `Endringsavtale` — pradinė ir nauja apimtis, plotas, priežastis, sena/nauja kaina, PVM, rašytinis kliento patvirtinimas prieš tęsiant darbus.
5. `Ordrebekreftelse / signert kontrakt` — abi šalys, datos, dokumento versija ir hash vienoje kopijoje.
6. `Ferdigdokumentasjon` — atlikti darbai, prieš/po nuotraukos, faktinis plotas, nukrypimai ir garantijos ribos.
7. `Garantibevis` — aiški apimtis, pradžia, pabaiga, išimtys ir kreipimosi būdas; negali sumažinti įstatyminių kliento teisių.
8. `Fakturagrunnlag` — iki apskaitos integracijos aiškiai žymimas kaip juodraštis, ne oficiali faktūra.
9. `Personvernerklæring` — tikslai, teisiniai pagrindai, saugojimas, AI/kartografijos/el. pašto/hostingo tiekėjai, perdavimai, teisės ir kontaktas.
10. `Databehandleroversikt` — Vercel, duomenų bazė, Blob, Resend, Gemini, Upstash, analytics/ads ir jų DPA / regionai.

**Teisinės kontrolės minimumas**

- kaina vartotojui rodoma su PVM; aiškiai atskiriama fiksuota kaina, maksimali kaina ir kainos pasiūlymas;
- jei vartojamas `prisoverslag`, Håndverkertjenesteloven § 32 15 % taisyklė negali būti apeinama neaiškiu tekstu;
- papildomas darbas ir padidėjusi kaina negali būti vykdomi be dokumentuoto pagrindo ir, kai reikia, rašytinio kliento patvirtinimo;
- elektroninio užsakymo galutinis mygtukas aiškiai nurodo mokėjimo prievolę;
- 14 dienų atsisakymo informacija ir forma pateikiamos patvarioje laikmenoje;
- ankstyvos pradžios pasirinkimas yra atskiras, aiškus ir įrodomas;
- pieštas parašas apibūdinamas tik kaip sistemos parašo ir audito įrodymas, ne kaip kvalifikuotas eID parašas;
- privatumo sutikimas, sutarties sąlygos ir duomenų tvarkymo teisinis pagrindas nėra suplakti į vieną privalomą sutikimą.

**PASS**

- klientas prieš įsipareigojimą gali perskaityti ir išsisaugoti visą paketą;
- web ir PDF tekstai bei versijos sutampa;
- savininkas patvirtina dokumento turinį kaip verslo sprendimą;
- galutinė dokumento būsena pažymima kaip `savininko patvirtintas kontroliuojamo piloto kandidatas`; savininkas nusprendė nereikalauti išorinės teisininko peržiūros.

> Pastaba: savininko patvirtinimas leidžia testuoti kontroliuojamą pilotą, bet nėra nepriklausomo Norvegijos teisininko konsultacijos pakaitalas.

### P2 — kainodara ir matavimo taisyklės

**Veiksmai**

- patvirtinti kiekvienos paslaugos vieneto kainą be PVM, 25 % PVM, minimalią kainą, toleranciją ir maksimalią kainą;
- patvirtinti avanso procento lauką: `0 %` pagal nutylėjimą, administratoriaus aiškus pasirinkimas prieš siuntimą, vienodas skaičiavimas visose išvestyse, dviejų kalendorinių dienų terminas po abiejų parašų ir užskaitymas galutinėje Fiken sąskaitoje;
- patvirtinti, kada naudojamas automatinis pastatas, administratoriaus pasirinktas pastatas ir rankinis plotas be vizualo;
- patvirtinti kampų koeficientus ir apvalinimą;
- nustatyti, kas vyksta faktiniam plotui esant mažesniam, tolerancijoje ir virš maksimumo;
- uždrausti AI savarankiškai keisti skaičius — Gemini tik paaiškina deterministiškai apskaičiuotą rezultatą.

**PASS**

- ta pati įvestis visur duoda tą pačią kainą;
- administratorius gali pagrįstai pakeisti pastatą/plotą ir gaunama nauja versija;
- plotas virš maksimumo blokuoja darbą iki rašytinio pakeitimo;
- mažesnis faktinis plotas perskaičiuojamas pagal patvirtintą taisyklę.

### P3 — pilnas rankinis UAT scenarijų paketas

Visi scenarijai atliekami staging aplinkoje. Naudojami sintetiniai duomenys ir kontroliuojami el. pašto adresai.

| ID | Realus scenarijus | Tikrinama | PASS kriterijus |
|---|---|---|---|
| UAT-01 | Aiškus adresas, vienas pastatas | gavimas → AI santrauka → matavimas → pasiūlymas | administratorius mato paruoštą, taisomą paketą; klientui nieko komercinio neišsiųsta be patvirtinimo |
| UAT-02 | Viename sklype keli pastatai | galimų pastatų vizualas ir pasirinkimas | administratorius aiškiai pasirenka teisingą kontūrą; PDF rodo būtent pasirinktą įrodymą |
| UAT-03 | Žemėlapis/adresas nepadeda | rankinis plotas be vizualo | admin įveda plotą ir pagrindimą; pasiūlymas neblokuojamas, PDF aiškiai nurodo rankinį metodą |
| UAT-04 | Klaidingas ar nepilnas adresas | trūkstamos informacijos eiga | klientui siunčiamas aiškus klausimas; kaina negeneruojama iš spėjimo |
| UAT-05 | Klientas prašo tik plovimo | bazinis ir rekomenduojamas variantai | bazinis pasiūlymas lieka; papildoma paslauga rodoma kaip neprivaloma alternatyva |
| UAT-06 | Klientas klausia prieš priimdamas | saugus susirašinėjimas | klausimas matomas byloje, atsakymas patvirtinamas admin, nuoroda ir būsena išlieka teisinga |
| UAT-07 | Klientas atmeta pasiūlymą | atmetimo ir gelbėjimo eiga | priežastis užfiksuojama, siunčiamas draugiškas patvirtinimas, byla neparodoma kaip aktyvus darbas |
| UAT-08 | Mobilus priėmimas ir pasirašymas | mokėjimo mygtukas, sąlygos, forma, parašai | klientas gauna kopiją; įmonė kontrapasirašo tą pačią versiją; PDF abu parašai tame pačiame lape |
| UAT-09 | Netinkamas, pasibaigęs ir atšauktas tokenas | prieigos kontrolė | turinys neatskleidžiamas; teisingas tokenas veikia tik savo bylai |
| UAT-10 | Darbuotojo paskyrimas ir laikas | data, intervalas, kontaktai, laiškai | paskyrimas išsisaugo; klientas informuojamas vieną kartą; darbuotojas mato tik savo darbą |
| UAT-11 | Faktinis plotas tolerancijoje | precheck ir kainos patvirtinimas | leidžiama pradėti tik po patikros; galutinė suma atitinka sutartį |
| UAT-12 | Faktinis plotas virš maksimumo | STOP ir endringsavtale | darbo pradžia blokuojama, kol admin ir klientas nepatvirtina naujo dokumento |
| UAT-13 | HMS / prieigos problema | darbuotojo saugos STOP | būsena blokuota, admin mato priežastį, klientas negauna klaidinančio „darbas pradėtas“ |
| UAT-14 | Darbo užbaigimas | prieš/po nuotraukos, užbaigimas, garantija | be privalomų įrodymų užbaigti negalima; dokumentai matomi vienoje kliento byloje |
| UAT-15 | El. pašto laikinas sutrikimas | retry ir idempotency | klaida matoma dėmesio eilėje; pakartojus siunčiama vieną kartą, ne dublikatas |
| UAT-16 | Rolės ir privatūs failai | admin/worker/customer/anon prieigos | kiekvienas mato tik leistiną turinį; tiesioginės svetimos nuorodos atmetamos |
| UAT-17 | Blogo AI juodraštis | generavimas, redagavimas, preview, publish | AI pats nepublikuoja; tik norvegiškas administratoriaus patvirtintas straipsnis patenka į sitemap |
| UAT-18 | Archyvas ir šiukšlinė | klaidinga užklausa, restore, galutinis trynimas | byla netrukdo aktyviai eilei; atkūrimas veikia; galutinis trynimas ribotas ir audituotas |
| UAT-19 | Pasiūlymas su ir be avanso | admin pasirenka procentą, sutartis, vidinė mokėjimo užklausa, apmokėjimo būsena, galutinis užskaitymas ir grąžinimas | `0 %` pagal nutylėjimą; pasirinktas procentas ir suma visur sutampa; terminas skaičiuojamas po abiejų parašų; įprasta išankstinė MVA sąskaita negeneruojama; registruojant mokėjimą suma ir data privalomos, banko nuoroda neprivaloma; darbas blokuojamas iki mokėjimo arba audituoto admin sprendimo; galutiniame Fiken pagrinde avansas atimtas vieną kartą |
| UAT-20 | Originalios Fiken sąskaitos importas | PDF įkėlimas iš bylos, metaduomenų nuskaitymas, patvirtinimas, siuntimas ir archyvas | originalas susietas tik su pasirinkta byla; numeris/hash nedubliuojami; automatiškai nuskaityti laukai neįsigalioja be admin patvirtinimo; klientui išsiunčiamas nepakeistas PDF; būsena ir laiko juosta sutampa |
| UAT-21 | Mokėjimo ir vėlavimo kontrolė | rankinis banko patikrinimas, mokėjimo registracija ir priminimo kladė | suma ir data privalomos, banko nuoroda neprivaloma; priminimo mygtukas blokuotas be tos dienos banko patikros; laiškas siunčiamas tik po admin patvirtinimo ir tik vieną kartą |
| UAT-22 | Mėnesio buhalterijos eksportas | mėnesio filtras, PDF/CSV paketas, kreditinės ir mokėjimai | pakete tik pasirinkto mėnesio bylos; originalūs dokumentai ir kontrolinės sumos sutampa; eksportas audituotas ir nekeičia sąskaitų būsenų |

#### Faktinės UAT išvados

| ID | Rezultatas | Faktinis įrodymas | Patvirtino | Laikas |
|---|---|---|---|---|
| UAT-01 | PASS | Staging byla `#13`: gautas tik gavimo patvirtinimas; Gemini sukūrė santrauką be trūkstamų duomenų; `TM-13-V1` automatiškai nustatė pasirinktą pastatą, horizontalų 86,7 m² plotą ir 93,5–102,3 m² stogo intervalą su `high` patikimumu; `T-13-V1` ir `K-13-V1` liko juodraščiai. PDF turi prekės ženklą, matavimo vizualą, 99,00 kr/m² be MVA, 12 659,63 kr su MVA ir 14 558,58 kr maksimalią kainą; admin kortelėje tos pačios sumos rodomos suapvalintos. | Įmonės savininkas ir techninė patikra | 2026-08-26 08:55 CEST |

**P3 PASS**

- UAT-01–UAT-22 turi faktinę PASS išvadą arba aiškiai dokumentuotą `N/A` su savininko sprendimu;
- nėra atviro P0/P1 defekto;
- kiekvienas rastas P2 defektas turi priimtą riziką, workaround arba yra pataisytas ir pertestuotas.

### P4 — produkcijos infrastruktūra, backup ir sauga

**Veiksmai**

- patikrinti, kad Production naudoja savo `DATABASE_URL`, `PAYLOAD_SECRET`, Resend, Blob, Upstash, Turnstile ir kitus raktus;
- užregistruoti patikrintą siuntėjo domeną ir produkcinį laiškų adresą;
- paimti šviežią DB snapshot ir privataus Blob inventorių;
- izoliuotai atkurti kopiją ir palyginti eilučių bei pagrindinių ryšių skaičius;
- patikrinti admin MFA / stiprų slaptažodį, darbuotojų paskyras ir deaktyvavimą;
- patikrinti rate limit, privatų media, tokenų galiojimą, auditą ir logų PII maskavimą;
- paskirti monitoringo ir incidento atsakingą žmogų.

**PASS**

- restore įrodytas, ne tik backup sukurtas;
- rollback komanda/ankstesnis deploy ir atsakingas žmogus žinomi;
- `/api/admin/platform-health` neturi nepaaiškinto kritinio gedimo;
- produkcijoje nėra staging testinių paskyrų, duomenų ar raktų.

### P5 — kontroliuojamas cutover

**Eiliškumas**

1. Galutinis kodo commit ir CI PASS.
2. Deploy su rizikingais feature flags išjungtais.
3. Viešos svetainės, formos, admin prisijungimo, el. pašto ir observability smoke.
4. Įjungti lead priėmimą ir gavimo patvirtinimą; patikrinti vieną kontroliuojamą užklausą.
5. Įjungti matavimo/pasiūlymo juodraščius tik su admin patvirtinimu.
6. Įjungti klientų pasiūlymus ir sutartį tik po P1/P2 PASS.
7. Įjungti worker portalą tik po UAT-10–UAT-14 PASS.
8. Blogui įjungti tik draft generavimą; automatinio publikavimo neįjungti.
9. Pirmos realios bylos metu stebėti kiekvieną job, laišką, dokumentą ir audit event.

**PASS**

- viena kontroliuojama produkcinė užklausa nueina iki pasirinktos paleidimo ribos be klaidos ir be dublio;
- nėra nepaaiškintų 5xx, failed delivery, invariant ar access-control perspėjimų;
- savininkas po smoke raštu įrašo `GO_CONTROLED_PRODUCTION_PILOT`.

### P6 — pirmos dienos ir piloto kontrolė

- kiekviena pirmųjų 20–30 bylų peržiūrima administratoriaus;
- bent 3 reprezentatyvūs automatiniai matavimai palyginami su fizine kontrole;
- fiksuojamas atsakymo laikas, pasiūlymo laikas, admin korekcijos, matavimo paklaida, laiškų klaidos ir dubliai;
- P0/P1 atveju susijęs flag išjungiamas, byla apsaugoma, paleidžiamas incidento planas;
- tik užbaigus pilotą sprendžiama dėl `GO_FULL_AUTOMATION`.

## 4. Defektų klasifikacija

| Lygis | Pavyzdys | Sprendimas |
|---|---|---|
| P0 | duomenų nutekėjimas, netinkamas gavėjas, nekontroliuojama finansinė išvestis | STOP, rollback / feature off |
| P1 | klaidinga kaina, PVM, sutarties hash, parašas, neapeinamas kliento kelias | NO-GO iki pataisymo ir pertestavimo |
| P2 | paini admin eiga, neteisingas statusas, neblokuojantis komunikacijos defektas | pataisyti šiandien arba raštiškai priimti ribotam pilotui |
| P3 | kosmetika, nekritinis tekstas | registruoti, gali būti po cutover |

## 5. Šiandienos įrodymų registras

| Gate | Rezultatas | Įrodymas | Patvirtino | Laikas |
|---|---|---|---|---|
| P0 Apimtis ir atsakomybės | PASS | Brønnøysund API: rekvizitai, MVA ir Foretaksregisteret patikrinti; savininkas patvirtino atsakomybes, Fiken ir klientų kontaktus | Įmonės savininkas | 2026-08-26 |
| P1 Dokumentai ir teisinė kontrolė | OWNER-APPROVED PILOT | Aktyvi `PRODUCTION-PILOT-V1`; išorinė teisininko peržiūra savininko sprendimu neatliekama; tai nėra nepriklausoma teisinė išvada | Įmonės savininkas | 2026-08-27 |
| P2 Kainodara ir matavimas | PASS KONTROLIUOJAMAM PILOTUI | Patvirtintos kainos ir matavimo taisyklės; Gemini nekeičia deterministinių skaičių | Įmonės savininkas ir techninė patikra | 2026-08-27 |
| P3 Rankinis UAT | IN_PROGRESS | Pagrindiniai Staging ir Production keliai įrodyti; likę scenarijai registruoti [PROD-8 faktinės būsenos audite](./prod8-current-state-audit-2026-08-28.md) | Savininkas ir techninė patikra | 2026-08-28 |
| P4 Infrastruktūra / backup / sauga | PASS KONTROLIUOJAMAM PILOTUI | Atskiros DB/Blob, restore repeticija, rollback, Turnstile ir Upstash įrodyti; 8.4 cron dar neaktyvuojamas | Savininkas ir techninė patikra | 2026-08-28 |
| P5 Cutover smoke | PASS KONTROLIUOJAMAM PILOTUI | Vieša svetainė, forma, admin, laiškas ir pirmos sintetinės bylos patikrintos | Savininkas ir techninė patikra | 2026-08-27 |
| Produkto savininko sprendimas | GO_CONTROLLED_PRODUCTION_PILOT | `GO_FULL_AUTOMATION` lieka nepatvirtintas iki realių bylų ir fizinių matavimų piloto | Įmonės savininkas | 2026-08-27 |

## 6. Oficialūs kontrolės šaltiniai

- Lovdata, Håndverkertjenesteloven: https://lovdata.no/nav/lov/1989-06-16-63
- Lovdata, Angrerettloven: https://lovdata.no/nav/lov/2014-06-20-27
- Forbrukerrådet, bruk av håndverker: https://www.forbrukerradet.no/forside/bolig/bruk-av-handverker/
- Datatilsynet, databehandleravtale: https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/hvordan-lage-en-databehandleravtale/
- Datatilsynet, digitale tjenester og personopplysninger: https://www.datatilsynet.no/personvern-pa-ulike-omrader/kundehandtering-handel-og-medlemskap/digitale-tjenester-og-forbrukeres-personopplysninger/
- Skatteetaten, fakturakrav: https://www.skatteetaten.no/bedrift-og-organisasjon/starte-og-drive/rutiner-regnskap-og-kassasystem/gode-rutiner-for-daglig-drift/inntekter/

## 7. Galutinis sprendimas

Galimi tik trys rezultatai:

- `GO_CONTROLED_PRODUCTION_PILOT` — visos P0–P5 sąlygos PASS, admin kontrolė įjungta;
- `GO_TECHNICAL_ONLY` — sistema techniškai paruošta, bet teisiniai / verslo / backup vartai neuždaryti, produkcija nejungiama;
- `NO-GO` — yra P0/P1 arba neįrodytas backup/rollback.

Sprendimą pasirašo produkto savininkas tik po to, kai lentelėje nelieka nepaaiškinto `PENDING`.
