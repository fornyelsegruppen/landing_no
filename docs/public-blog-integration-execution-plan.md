# Takfornyelse — viešo „Råd og guider“ integracijos planas

**Parengta:** 2026-08-26  
**Aplinka:** pirmiausia tik `https://takfornyelse-staging.vercel.app`  
**Produkcija:** neliečiama be atskiro savininko `GO`  
**Būsena:** vykdoma; B0–B2 užbaigti, B3 yra kitas aktyvus etapas  
**Vykdymo taisyklė:** vienu metu vykdoma tik viena fazė; nauja fazė nepradedama, kol ankstesnė neturi visų PASS įrodymų

## 1. Tikslas

Prijungti jau veikiantį AI ir administratoriaus valdomą tinklaraščio variklį prie viešos Takfornyelse svetainės taip, kad lankytojas lengvai rastų naudingus straipsnius, o Google aiškiai suprastų jų ryšį su paslaugomis.

Tai nėra naujo blogo kūrimas. Užduotis yra saugiai ir nuosekliai atverti jau sukurtą sistemą per viešą navigaciją, pagrindinį puslapį ir esamus SEO paviršius.

## 2. Patvirtintas pavadinimas ir maršrutai

| Elementas | Norvegų kalba | Anglų kalba |
|---|---|---|
| Meniu pavadinimas | `Råd og guider` | `Advice & guides` |
| Katalogo H1 | `Takguide for boligeiere` | `Roof guide for homeowners` |
| Esamas URL | `/no/blogg` | `/en/blogg` |
| Straipsnio URL | `/no/blogg/{slug}` | `/en/blogg/{slug}` tik jei yra patvirtintas pilnas EN tekstas |

`/blogg` maršrutas nekeičiamas. Taip išlaikoma esama canonical, preview, sitemap, atribucijos ir vidinių nuorodų logika, nereikia redirect migracijos.

## 3. Jau veikianti bazė

Auditas patvirtino, kad projekte jau yra:

- Payload `posts` kolekcija su draft, AI QA, human review, approved, scheduled ir published būsenomis;
- administratoriaus blogo valdymas `/admin-v2/blog`;
- AI juodraščių generavimas ir Pexels licencijuotų stock vaizdų parinkimas;
- `/no/blogg`, `/en/blogg` ir lokalizuoti straipsnių puslapiai;
- tik publikuotų įrašų viešos užklausos, o draft preview veikia per apsaugotą preview režimą;
- canonical, Open Graph, hreflang, `BlogPosting`, `WebPage`, breadcrumb ir FAQ schema;
- publikuotų straipsnių įtraukimas į sitemap;
- autoriaus, redaktoriaus, šaltinių, hero vaizdo ir Pexels atribucijos rodymas;
- susijusių straipsnių, susijusių paslaugų ir konversijos CTA komponentai;
- blogo lead attribution ir publikavimo saugos testai;
- footer nuoroda į `/blogg`, šiuo metu pavadinta `Takguide`.

Pagrindinės realios spragos:

1. `/blogg` nėra garantuotai matomas viršutiniame desktop ir mobile meniu.
2. CMS navigacijos nustatymai gali visiškai pakeisti fallback meniu, todėl vien fallback pataisos neužtenka.
3. Pagrindiniame puslapyje nėra naujausių publikuotų straipsnių bloko.
4. `Takguide`, `Blogg` ir būsimas `Råd og guider` pavadinimai nėra suvienodinti vartotojo navigacijoje.
5. Nėra atskiros regresijos matricos, įrodančios visą viešą kelią nuo publikavimo iki meniu, home, sitemap ir užklausos atribucijos.

## 4. Apimties taisyklės

### Privaloma šiame pakete

- vienoda `Råd og guider` / `Advice & guides` nuoroda desktop, mobile ir footer;
- nuoroda negali dingti, kai Payload `site-settings.navItems` yra užpildytas;
- nuoroda negali dubliuotis, jei administratorius ją jau pridėjo per CMS;
- pagrindinio puslapio blokas su trimis naujausiais konkrečiai kalbai publikuotais straipsniais;
- tvarkingas fallback, kai publikuotų straipsnių nėra arba CMS laikinai nepasiekiamas;
- išsaugotas AI draft-only ir žmogaus patvirtinimo principas;
- SEO, sitemap, schema, CTA, nuotraukų licencijos ir atribucija patikrinami su faktiniu staging straipsniu;
- desktop, mobile, klaviatūros, prieinamumo ir performance patikra;
- bendras blogo bei Admin V2 regresijos vartas prieš produkciją.

### Sąmoningai nedaroma šiame pakete

- nekeičiama `/blogg` URL struktūra;
- nekuriama nauja blogo duomenų bazė ar antras CMS;
- nepridedamas automatinis publikavimas be administratoriaus;
- nekuriamos atskiros EN publikacijos, jei nėra pilnai peržiūrėto EN turinio;
- nedaromas bendras svetainės dizaino perrašymas;
- nepridedama sudėtinga kategorijų taksonomija ar paieška, kol straipsnių kiekis nedidelis;
- nepublikuojama į produkciją be atskiro savininko `GO`.

## 5. Fazės vykdymo protokolas

Kiekviena fazė uždaroma tik atlikus:

1. tikslinius unit ir integracinius testus;
2. `npm run typecheck` ir `npm run lint`;
3. aktualaus puslapio desktop ir mobile smoke;
4. SEO ar publikavimo duomenų patikrą, jei fazė juos liečia;
5. staging deploy ir matomo rezultato patikrą, jei fazė keičia vartotojo UI;
6. fazės įrodymų ataskaitą `docs/implementation/` kataloge.

Privalomas fazės rezultato blokas:

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```

Bet kuris `FAIL`, nepatikrintas publikavimo scenarijus, matomas draft arba klaidinanti navigacija palieka fazę atidarytą.

## 6. Įgyvendinimo fazės

### B0 — baseline, faktinis turinys ir rollback

**Vykdymo būsena:** PASS — 2026-08-26; įrodymai `docs/implementation/phase-b0-public-blog-baseline.md`.

**Tikslas:** užfiksuoti esamą blogo, navigacijos ir produkcijos būseną prieš pakeitimus.

**Darbai:**

- užfiksuoti Git commit, staging deployment ir produkcijos rollback tašką;
- suskaičiuoti staging published, draft ir scheduled įrašus;
- patikrinti esamus `/no/blogg`, `/en/blogg`, dviejų publikuotų straipsnių, preview ir sitemap atsakymus;
- užfiksuoti desktop/mobile navbar, footer ir home ekrano vaizdus;
- nustatyti faktinį CMS `navItems` turinį ir įrodyti, kodėl fallback pakeitimo vieno neužtenka;
- pasirinkti vieną anoniminį staging straipsnį visam B1–B6 testų keliui.

**Fazė baigta, kai:**

- visiems viešiems ir privatiems blogo paviršiams yra baseline;
- aiškus rollback commit ir deployment;
- pasirinktas testinis published bei draft įrašas;
- produkcija nepakeista;
- įrašytas B0 `GO`.

### B1 — publikavimo ir matomumo saugos vartas

**Vykdymo būsena:** PASS — 2026-08-26; įrodymai `docs/implementation/phase-b1-blog-publication-visibility.md`.

**Priklausomybė:** B0  
**Tikslas:** prieš plečiant matomumą įrodyti, kad viešai negali patekti nepatvirtintas turinys.

**Darbai:**

- suvienodinti vieną autoritetingą `published` filtrą katalogui, home teaser, sitemap ir tiesioginiam straipsniui;
- patikrinti, kad `draft`, `ai_qa`, `human_review`, `approved` ir būsima `scheduled` publikacija iki termino viešai nerodoma;
- tiesioginiam draft URL anoniminiam vartotojui grąžinti 404, o ne turinio fragmentą;
- palikti apsaugotą administratoriaus preview;
- užtikrinti, kad trūkstamas EN turinys nesukuria tuščio EN straipsnio, hreflang ar sitemap įrašo;
- testais užrakinti publikavimo, preview ir sitemap taisykles.

**Fazė baigta, kai:**

- tik žmogaus patvirtintas ir faktiškai publikuotas įrašas gali būti viešas;
- draft nėra kataloge, home, sitemap ar per tiesioginį anoniminį URL;
- preview lieka pasiekiamas tik autorizuotam administratoriui;
- visi B1 testai PASS;
- įrašytas B1 `GO`.

### B2 — vieninga desktop, mobile ir footer navigacija

**Vykdymo būsena:** PASS — 2026-08-26; įrodymai `docs/implementation/phase-b2-public-guide-navigation.md`.

**Priklausomybė:** B1  
**Tikslas:** lankytojas iš bet kurios svetainės vietos vienu aiškiu veiksmu randa `Råd og guider`.

**Darbai:**

- pridėti sisteminę `/blogg` nuorodą į desktop ir mobile navbar;
- teisingai sujungti ją su CMS `navItems`: pridėti, jei trūksta, ir nedubliuoti, jei jau yra;
- footer `Takguide` pavadinimą suvienodinti į `Råd og guider` / `Advice & guides`;
- išlaikyti lokalizuotą maršrutizavimą ir kalbos perjungimą tame pačiame straipsnyje arba kataloge;
- užtikrinti matomą active/focus/hover būseną ir klaviatūros pasiekiamumą;
- patikrinti, kad papildoma nuoroda nesugadina desktop pločio ir mobile meniu aukščio.

**Patikra:** navbar su tuščiu ir užpildytu CMS meniu, jau įrašyta `/blogg` nuoroda, desktop, mobile, NO ir EN.

**Fazė baigta, kai:**

- desktop, mobile ir footer rodo vieną nedubliuotą nuorodą;
- nuoroda visada atidaro teisingą lokalizuotą katalogą;
- nėra horizontalaus slinkimo, uždengto CTA ar nepasiekiamo fokusavimo;
- staging vizualinė patikra PASS;
- įrašytas B2 `GO`.

### B3 — naujausių straipsnių blokas pagrindiniame puslapyje

**Priklausomybė:** B2  
**Tikslas:** publikuotas turinys gauna vidines nuorodas ir matomumą iš stipriausio svetainės puslapio.

**Darbai:**

- sukurti serverinį `LatestGuidesSection` komponentą;
- rodyti daugiausia tris naujausius konkrečiai kalbai publikuotus straipsnius;
- kortelėje rodyti hero vaizdą arba tvarkingą fallback, kategoriją, datą, pavadinimą, trumpą santrauką ir `Les mer`;
- pridėti pagrindinę nuorodą `Se alle råd og guider`;
- bloką dėti žemiau pagrindinių paslaugų ir pasitikėjimo turinio, bet prieš galutinį kontaktų CTA;
- užtikrinti, kad blokas nesiunčia draft, neapkrauna LCP ir neužklausia daugiau duomenų nei reikia;
- kai straipsnių nėra, nerodyti tuščios sekcijos arba rodyti stabilų rankinių temų fallback pagal patvirtintą dizainą.

**Fazė baigta, kai:**

- home rodo tiksliai naujausius publikuotus lokalės straipsnius;
- draft ir trūkstamo vertimo įrašai nepatenka;
- vaizdai turi teisingą dydį, alt ir licencijos duomenys lieka straipsnyje;
- mobili bei desktop staging patikra PASS;
- įrašytas B3 `GO`.

### B4 — katalogo, straipsnio ir SEO nuoseklumo užbaigimas

**Priklausomybė:** B3  
**Tikslas:** visas viešas kelias atrodo kaip viena profesionali žinių bazė ir perduoda teisingus SEO signalus.

**Darbai:**

- vartotojo tekstuose suvienodinti `Råd og guider`, nekeičiant techninio `/blogg` URL;
- patikrinti hero vaizdus, alt, Pexels atribuciją, autorių, faglig kontrolę, datą ir skaitymo hierarchiją;
- išlaikyti straipsnio CTA, lead attribution ir susijusių paslaugų/straipsnių nuorodas;
- patikrinti canonical, hreflang, Open Graph, `BlogPosting`, breadcrumb ir FAQ schema su faktiniu įrašu;
- įrodyti, kad sitemap turi katalogą ir tik published straipsnius;
- patikrinti, kad vidinės nuorodos nekannibalizuoja paslaugų puslapių: informacinis straipsnis turi vesti į komercinį paslaugos CTA, o ne jį pakeisti;
- ilgam pavadinimui, trūkstamam hero ir nuliniam related content palikti tvarkingą UI.

**Fazė baigta, kai:**

- vartotojo kelias `meniu → katalogas → straipsnis → paslauga/užklausa` neturi aklavietės;
- visi SEO URL, schema ir sitemap nurodo tą patį published dokumentą;
- lead attribution iš straipsnio išlieka teisinga;
- nėra klaidingų garantijų, kainų ar nepatikrintų AI teiginių viešame testiniame straipsnyje;
- įrašytas B4 `GO`.

### B5 — regresija, prieinamumas ir performance

**Priklausomybė:** B4  
**Tikslas:** įrodyti, kad integracija nesugadino svetainės, blogo variklio ar ankstesnio Admin V2 paketo.

**Darbai:**

- paleisti visą unit, migracijų, TypeScript, lint ir production build rinkinį;
- patikrinti `/no`, `/en`, `/no/blogg`, `/en/blogg`, faktinį straipsnį, sitemap ir robots;
- atlikti 320, 375, 768, 1280 ir 1440 px patikrą;
- patikrinti klaviatūros fokusą, vieną H1, antraščių hierarchiją, link/button vardus ir vaizdų alt;
- patikrinti, kad home ir navbar nedidina kritinio JS bei neblogina LCP dėl blogo vaizdų;
- patikrinti CMS sutrikimo fallback: svetainės navigacija ir pagrindinės paslaugos turi išlikti veikiančios;
- pakartoti Admin V2 login ir bylos read-only smoke, nes leidimas bus bendras.

**Fazė baigta, kai:**

- visi automatiniai ir responsive testai PASS;
- nėra P0/P1 SEO, prieinamumo, performance ar duomenų nutekėjimo defekto;
- Admin V2 regresija PASS;
- staging konsolėje nėra naujų klaidų;
- įrašytas B5 `GO`.

### B6 — galutinis staging priėmimas ir bendras release kandidatas

**Priklausomybė:** B5  
**Tikslas:** sujungti blogo integraciją ir Admin V2 į vieną aiškiai identifikuotą produkcijos kandidatą.

**Darbai:**

- deployinti vieną galutinį staging commit;
- anoniminiame lange pereiti `home → Råd og guider → published straipsnis → CTA → užklausos forma`;
- administratoriaus lange pereiti `AI draft → preview → human publish → viešas katalogas → sitemap`;
- patikrinti, kad publikavimo cache/revalidation per sutartą laiką parodo straipsnį be rankinio redeploy;
- užfiksuoti anonimizuotus įrodymus, deployment ID ir rollback commit;
- pateikti savininkui vieną staging nuorodų rinkinį ir aiškų GO/NO-GO rezultatą;
- įtraukti patvirtintą commit į bendrą produkcijos backup, migracijų, secrets ir post-deploy planą.

**Fazė baigta, kai:**

- visas viešas ir administratoriaus blogo kelias PASS;
- draft nebuvo viešai atskleistas nė viename etape;
- matomas straipsnis, sitemap ir administratoriaus būsena sutampa;
- Admin V2 bei blogo paketai turi vieną rollback-ready release commit;
- savininkas staging aplinkoje įrašo B6 `GO`;
- produkcija vis dar nepakeista iki atskiro bendro Production GO.

## 7. Privalomi scenarijai

| ID | Scenarijus | PASS kriterijus |
|---|---|---|
| BLOG-01 | Published NO straipsnis | matomas home, kataloge, tiesioginiu URL ir sitemap |
| BLOG-02 | Draft straipsnis | nematomas home, kataloge, sitemap ir anoniminiam tiesioginiam URL |
| BLOG-03 | EN tekstas neegzistuoja | nesukuriamas tuščias EN straipsnis ar klaidingas hreflang |
| BLOG-04 | CMS navbar tuščias | `Råd og guider` vis tiek matomas |
| BLOG-05 | CMS navbar užpildytas be blogo | sisteminė nuoroda pridedama vieną kartą |
| BLOG-06 | CMS navbar jau turi `/blogg` | nuoroda nedubliuojama |
| BLOG-07 | 320/375 px mobile menu | nuoroda pasiekiama, nėra horizontalaus slinkimo ar uždengto CTA |
| BLOG-08 | Trūksta hero vaizdo | kortelė ir straipsnis lieka profesionalūs, be broken image |
| BLOG-09 | Pexels stock vaizdas | veikia alt, source ir photographer atribucija |
| BLOG-10 | Straipsnio CTA | atidaro teisingą lokalizuotą užklausą ir išsaugo content source |
| BLOG-11 | Publikavimas be redeploy | po revalidation straipsnis atsiranda kataloge ir sitemap |
| BLOG-12 | CMS laikinas sutrikimas | pagrindinė svetainė ir navigacija nesulūžta; rodomas saugus fallback |
| BLOG-13 | Bendras release smoke | blogas, vieša forma ir Admin V2 viename staging commit veikia kartu |

## 8. Vykdymo eiliškumas

```text
B0 baseline
  → B1 publikavimo sauga
  → B2 navigacija
  → B3 home straipsnių blokas
  → B4 viešas UX ir SEO
  → B5 pilna regresija
  → B6 staging priėmimas
  → bendras Production GO procesas
```

Jeigu fazėje randamas defektas, taisymas ir pertestavimas vyksta toje pačioje fazėje. Negalima kompensuoti nebaigto ankstesnio vartų kriterijaus vėlesniu testu.

## 9. Galutinis priėmimo apibrėžimas

Paketas laikomas techniškai baigtu tik kai:

```text
PUBLIC_BLOG_INTEGRATION=PASS
EDITORIAL_SAFETY=PASS
NAVIGATION_DISCOVERY=PASS
HOME_DISCOVERY=PASS
SEO_AND_SITEMAP=PASS
MOBILE_AND_DESKTOP=PASS
ADMIN_V2_REGRESSION=PASS
ROLLBACK_READY=YES
OWNER_STAGING_APPROVAL=GO
PRODUCTION_GO=NOT_YET
```

Tik po šio rezultato blogo integracija pridedama prie jau parengto bendro produkcijos išleidimo proceso. Produkcijos deploy vis tiek reikalauja naujo, aiškaus savininko patvirtinimo.
