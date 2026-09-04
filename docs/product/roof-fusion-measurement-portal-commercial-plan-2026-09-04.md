# Roof Fusion matavimų portalo komercinis planas

**Owner:** PLATFORM  
**Technologijos savininkas:** RF  
**Statusas:** CONCEPT / PLANNING ONLY  
**Data:** 2026-09-04  
**Įgyvendinimas:** nepradėtas  
**Production:** neliečiama; šis dokumentas nesuteikia leidimo diegti, keisti
kainodaros ar pradėti pardavimų

## 1. Strateginė mintis

Roof Fusion variklį galima išauginti iš vidinio Takfornyelse Norge matavimo
įrankio į atskirą mokamą B2B paslaugą: rangovas pateikia adresą, gauna aiškią
stogo geometriją, šlaitų plotus, nuolydžius, kraštinių ilgius, įrodymus ir
eksportuojamą ataskaitą.

Pirmoji rinka būtų Norvegija. Vėliau produktas plečiamas į kitas šalis tik per
atskirus duomenų, licencijų ir tikslumo vartus. RF lieka vienas skaičiavimo
branduolys, o šalių duomenų šaltiniai, ataskaitos ir komercinės taisyklės tampa
adapteriais.

Tai yra atskira pajamų kryptis, ne dabartinio pasiūlymų proceso pervadinimas.
Vidinis RF naudojimas leidžia pirmiausia sukaupti tikslumo, kainos ir operatorių
darbo duomenis, o tik tada saugiai pasiūlyti paslaugą išorės klientams.

## 2. Rinkos modelis, kurį verta perimti

[GAF QuickMeasure](https://www.gaf.com/en-us/resources/business-services/quickmeasure)
rodo suprantamą komercinį modelį: užsakomas konkretaus pastato matavimas,
pateikiami vaizdai, plotai, nuolydžiai ir stogo elementai, o rezultatas gali būti
naudojamas sąmatai. Jų
[ataskaitos pavyzdys](https://www.gaf.com/en-us/document-library/documents/brochures-%26-literature/quick_measure_sample_roof_report.pdf)
atskiria bendrą vaizdą, projekciją, kraštines, nuolydžius, plotus ir santrauką.

RF neturi kopijuoti GAF dizaino ar saugomų sprendimų. Verta perimti patį rinkoje
patikrintą principą: **adresas → patikrintas matavimas → aiški ataskaita → sąmata
ar pasiūlymas**.

Papildomi naudingi orientyrai:

- [Roofr Measurements](https://roofr.com/qxo/measurements): trumpas kelias nuo
  adreso iki matavimo ir tolesnio pasiūlymo;
- [HOVER Measurements mode](https://help.hover.to/en/articles/13153983-introducing-measurements-mode):
  interaktyvus modelis, kuriame konkretus paviršius ir jo reikšmės lieka vienoje
  darbo erdvėje.

## 3. RF produkto pažadas

> Iš vieno adreso gauti paaiškinamą, patikrinamą ir darbui paruoštą stogo
> matavimą, neapsimetant tiksliu tada, kai duomenų nepakanka.

Pagrindiniai skirtumai nuo paprastos automatinės ploto skaičiuoklės:

- kiekvienas skaičius siejamas su konkrečiu šlaitu ir vaizdiniu įrodymu;
- rodoma duomenų kilmė, versija, tikslumas ir pasitikėjimo lygis;
- paprasti stogai skaičiuojami automatiškai, sudėtingi perduodami peržiūrai;
- naudojama saugi rezultatų kopėčia, o ne klaidingas automatinis tikslumas;
- patvirtintas rezultatas vienu veiksmu gali tapti sąmatos ar pasiūlymo įvestimi;
- palaikomas auditas, pakartojamumas ir nekintančios matavimo versijos.

## 4. Tiksliniai klientai

Pirmajame etape:

- maži ir vidutiniai stogų rangovai Norvegijoje;
- medžiagų tiekėjai ir franšizės, kurioms reikia vienodo matavimo proceso;
- renovacijos, saulės modulių ir draudiminių apžiūrų komandos;
- įmonės, kurios neturi savo GIS ar stogo matavimo operatorių.

Vėlesniame etape:

- draudikai ir žalų administratoriai;
- dideli rangovų tinklai;
- statybos programinės įrangos tiekėjai per API;
- balto ženklo partneriai kitose šalyse.

## 5. Paslaugų paketai

### 5.1 Automatinis matavimas

Skirtas paprastam stogui, kai vaizdo, kontūro ir aukščio duomenys praeina
tikslumo vartus.

Rezultatas:

- bendras ir horizontalus plotas;
- plotas bei nuolydis pagal šlaitus;
- perimetras ir palaikomos stogo linijos;
- ortofoto, schema, šaltiniai ir pasitikėjimo lygis;
- PDF ir struktūrizuotas eksportas.

### 5.2 RF Verified

Automatinis rezultatas, kurį peržiūri operatorius. Šis paketas taikomas
sudėtingiems stogams, nepakankamiems duomenims arba klientui pasirinkus didesnį
patikimumą.

Papildomai:

- rankinis kontūro ir stogo linijų patikslinimas;
- aiškus patikrinusio asmens bei revizijos įrašas;
- pristatymo laiko įsipareigojimas;
- taisymo ir pakartotinio pateikimo taisyklės.

### 5.3 RF Pro priedai

- preliminarus medžiagų kiekis ir atliekų koeficientai;
- istorinių vaizdų palyginimas, jei leidžia licencija;
- kliento nuotraukų ar drono medžiagos įrodymai;
- 3D ar interaktyvus šlaitų modelis;
- DXF, XML, JSON/API ir integracijos su sąmatų sistemomis;
- balto ženklo ataskaita;
- prioritetinė rankinė peržiūra.

## 6. Pajamų modelis

Galimi tarpusavyje derinami modeliai:

1. mokestis už vieną automatinę arba patikrintą ataskaitą;
2. mėnesinis planas su įtrauktu ataskaitų kiekiu;
3. įmonės planas su vartotojais, SLA, auditu ir administravimu;
4. API mokestis už užklausą arba sėkmingą rezultatą;
5. balto ženklo licencija tiekėjams ir partneriams;
6. mokami priedai: operatoriaus QA, medžiagų žiniaraštis, papildomi eksportai,
   istoriniai vaizdai ir skubus pristatymas.

Kainos negali būti nustatytos vien pagal konkurentų puslapius. Pirma reikia
išmatuoti vienos ataskaitos duomenų, operatoriaus, infrastruktūros ir klientų
aptarnavimo savikainą bei patikrinti norą mokėti su Norvegijos rangovais.

## 7. Kodėl pradėti Norvegijoje

- jau kuriama RF darbo eiga ir sukauptos vietinio stogų verslo žinios;
- integruojami vietiniai adresų, pastatų, ortofoto ir aukščio šaltiniai;
- vidinis Takfornyelse Norge srautas gali tapti kontroliuojamu tikslumo poligonu;
- galima tiesiogiai stebėti, ar matavimas sutrumpina pasiūlymo parengimą ir
  sumažina perskaičiavimus;
- pirmuosius pilotinius klientus lengviau aptarnauti rankiniu būdu ir surinkti
  kokybišką grįžtamąjį ryšį.

Norvegijos duomenų prieinamumas nesuteikia automatinės teisės juos perparduoti.
Prieš išorinį paleidimą turi būti atskirai patikrintos kiekvieno šaltinio
licencijos, kaupimo, ekrano kopijų, ataskaitų ir komercinio naudojimo sąlygos.

## 8. Plėtra į kitas šalis

Kiekviena šalis turi praeiti atskirą `country readiness` patikrą:

- adresų ir geokodavimo kokybė;
- pastatų kontūrų aprėptis ir naudojimo teisės;
- ortofoto raiška, naujumas, kaina ir licencija;
- DTM/DSM/LiDAR ar kitų aukščio duomenų prieinamumas;
- koordinatės, vienetai ir lokalūs pastatų ypatumai;
- privatumo, vartotojų teisių, mokesčių ir sąskaitų reikalavimai;
- lokalizuota ataskaita, valiuta, kalba ir pagalba;
- atskiras tikslumo etalonas su vietiniais stogais.

Šalis aktyvuojama tik tada, kai jos duomenų adapteris atitinka bendrą RF
matavimo sutartį ir pasiekia nustatytą tikslumo bei vieneto ekonomikos slenkstį.

## 9. Ką būtina sustiprinti platformoje

Prieš komercinį savitarnos paleidimą reikia:

- organizacijų, vartotojų, rolių ir daugiaklientės izoliacijos;
- užsakymo, bylos, pastato ir matavimo revizijos modelio;
- mokėjimų, kreditų, sąskaitų ir grąžinimų;
- kiekvieno duomenų teikėjo licencijos bei savikainos žurnalo;
- nekintančių geometrijos, šaltinių, skaičiavimo ir ataskaitos versijų;
- operatorių peržiūros eilės, prioritetų ir SLA;
- PDF bei mašininio eksporto generatoriaus;
- kliento portalo ir balto ženklo ataskaitų;
- šalių adapterių, lokalizacijos ir matavimo vienetų sluoksnio;
- tikslumo etalonų rinkinio ir realių matavimų palyginimo programos;
- saugumo, privatumo, audito, incidentų ir duomenų saugojimo politikos;
- stebėsenos, palaikymo ir aiškios netinkamo rezultato kompensavimo tvarkos.

RF One Card v2 yra būsimo portalo darbo erdvės pagrindas, tačiau komercinis
produktas papildomai reikalauja užsakymų, klientų, atsiskaitymo ir paslaugos
valdymo sluoksnių.

## 10. Kokybės ir saugos kopėčia

RF turi visada pasirinkti geriausią pagrįstą rezultatą šia tvarka:

1. automatinis patikimas šlaitų modelis;
2. asistuojamas modelis su operatoriaus pataisymais;
3. RF Verified rankinė peržiūra;
4. aiškiai pažymėtas senasis plotas + žinomas nuolydis fallback;
5. atsisakymas pateikti tikslų komercinį rezultatą, jei patikimumo nepakanka.

Fallback rezultatas negali atrodyti lygiavertis patikrintam matavimui. Ataskaita
turi parodyti metodą, prielaidas, pasitikėjimą ir tai, kam rezultatą leidžiama
naudoti.

## 11. Siūlomi etapai

### M0 — verslo patikra

- 10–20 pokalbių su Norvegijos rangovais ir tiekėjais;
- jų dabartinio matavimo laiko, kainos, klaidų ir pirkimo kriterijų analizė;
- trijų paketų bei preliminarios kainodaros testas;
- duomenų licencijų ir perpardavimo teisinė patikra;
- pradinis vienos ataskaitos savikainos modelis.

### M1 — vidinis RF sukietinimas

- užbaigti One Card v2;
- atlikti įvairių stogų tipų tikslumo testus;
- standartizuoti ataskaitos rezultatą ir įrodymus;
- išmatuoti automatikos, operatoriaus laiko ir klaidų rodiklius.

### M2 — uždaras mokamas Norvegijos pilotas

- ribotas klientų skaičius;
- pirmiausia RF Verified ataskaitos;
- aiškus SLA, taisymo procesas ir atsakomybės ribos;
- rankinis klientų aptarnavimas ir savaitinė kokybės peržiūra.

### M3 — Norvegijos savitarna

- registracija, kreditai arba prenumerata;
- automatinis ir patikrintas paketas;
- klientų portalas, istorija, eksportai ir pagalba;
- savikainos bei maržos kontrolė realiu laiku.

### M4 — partneriai ir API

- integracijos su sąmatomis, CRM ir medžiagų tiekėjais;
- balto ženklo modelis;
- sutartiniai limitai, auditai ir įmonių SLA.

### M5 — tarptautinė plėtra

- viena šalis vienu metu;
- joks paleidimas be duomenų/licencijos/tikslumo vartų;
- bendras RF branduolys, atskiri šalies adapteriai.

## 12. Pagrindiniai KPI ir vieneto ekonomika

- laikas nuo adreso iki ataskaitos;
- automatiškai užbaigtų matavimų dalis;
- rankinės peržiūros dalis ir minutės vienai bylai;
- perskaičiavimų, grąžinimų ir klaidų dalis;
- duomenų teikėjų bei infrastruktūros kaina vienai ataskaitai;
- bendroji marža pagal paketą;
- bandomojo kliento konversija į mokantį;
- ataskaitų kiekis vienai organizacijai;
- prenumeratos išlaikymas ir klientų praradimas;
- kiek matavimų virsta sąmata ar pasiūlymu;
- klientų įsigijimo kaina ir kliento gyvavimo vertė.

## 13. Didžiausios rizikos ir stabdymo sąlygos

- šaltinių licencijos neleidžia komercinio perpardavimo;
- automatinis tikslumas per silpnas, o rankinė peržiūra sunaikina maržą;
- ataskaita atrodo tikslesnė, nei leidžia duomenys;
- skirtingų šalių duomenys paverčia RF nevaldomų išimčių rinkiniu;
- produktas per anksti sujungiamas su kainodara ar kliento pasiūlymu;
- nėra realių matavimų etalono ir klaidų atsakomybės proceso;
- portalas statomas prieš patvirtinant klientų norą mokėti.

Komercinis pilotas nepradedamas, kol nėra patvirtintos šaltinių teisės,
ataskaitos formato, tikslumo slenksčio, operatoriaus peržiūros proceso ir vienos
ataskaitos savikainos.

## 14. Klausimai kitam PLATFORM pokalbiui

1. Kas pirmasis moka: rangovas, tiekėjas, draudikas ar programinės įrangos
   partneris?
2. Kokią problemą parduodame pirmiausia: greitį, mažesnę kainą, didesnį tikslumą
   ar sąmatos automatizavimą?
3. Ar Norvegijos MVP yra tik RF Verified, ar saugu iškart siūlyti automatinį
   paketą?
4. Kokia priimtina ploto ir linijų paklaida pagal stogo tipą?
5. Kiek operatoriaus minučių leidžia išlaikyti norimą maržą?
6. Kokie eksportai būtini pirmiems penkiems pilotiniams klientams?
7. Ar RF turi būti atskiras prekės ženklas, Takfornyelse produktas ar balto
   ženklo infrastruktūra?
8. Kuri antra šalis turi geriausią duomenų, kainos ir klientų poreikio santykį?

## 15. Artimiausias sprendimas

Dabar nepradėti atskiro portalo kūrimo. Pirmiausia užbaigti dabartinį RF
matavimo ir One Card v2 patikimumo darbą, o PLATFORM pokalbyje lygiagrečiai
parengti M0 verslo patikros paketą: klientų interviu scenarijų, licencijų
kontrolinį sąrašą, vieneto ekonomikos lentelę ir mokamo Norvegijos piloto
hipotezę.

Šis atskyrimas leidžia dabartinį RF variklį tobulinti taip, kad jis vėliau taptų
komercinio portalo branduoliu, bet neleidžia naujai verslo idėjai sutrikdyti
aktyvaus matavimo patikros ir Production saugos.
