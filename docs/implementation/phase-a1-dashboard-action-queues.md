# A1 – teisingos apžvalgos kortelės ir veiksmų eilės

**Fazė:** A1  
**Statusas:** techniškai įgyvendinta; Vercel Preview veikia; autentifikuotas staging patikrinimas dalinai atliktas
**Data:** 2026-08-25  
**Aplinka:** `codex/master-platform-implementation`; produkcija nepakeista

## Tikslas

Užtikrinti, kad administratoriaus apžvalgoje nė viena veiksmų laukianti byla nepradingtų keičiantis sutarčių ar darbo būsenoms, o skirtingi proceso etapai nebūtų sumaišyti vienoje kortelėje.

## Įgyvendinta

- pridėta pagrindinė eilė `Pasirašyta – sukurti darbą`;
- galutinai pasirašyta sutartis lieka eilėje tol, kol tai sutarčiai realiai sukuriamas darbo užsakymas;
- `Laukia darbuotojo paskyrimo` perkelta į pagrindines proceso korteles;
- pridėtos atskiros eilės `Reikia suplanuoti` ir `Baigta – reikia galutinės patikros`;
- aktyvūs darbai dabar apima tik suplanuotus ir realiai vykdomus darbus;
- `unassigned`, `assigned` be datos ir `completed` nebemaišomi su aktyviais darbais;
- artimiausių 72 valandų sąrašas nebeįtraukia `completed` darbų;
- `Reikia dėmesio` papildyta blokuotais matavimais, kainos skaičiavimais ir SEO job klaidomis;
- užfiksuotos LT, EN ir NO naujų kortelių antraštės;
- bylos `Kitas veiksmas` dabar atskiria darbuotojo paskyrimą, planavimą, blokavimo kontrolę ir galutinę darbo patikrą;
- keičiantis darbo būsenai atnaujinamas lead `nextAction` ir `nextActionAt`, todėl neberodoma ankstesnio parašo data kaip dabartinio veiksmo terminas;
- darbo sukūrimas be darbuotojo iš karto nustato paskyrimo veiksmą;
- darbuotojo paskyrimas be datos nustato planavimo veiksmą;
- suplanuotas ar vykdomas darbas neberodo klaidingo administratoriaus termino;
- užbaigtas arba blokuotas darbas iš karto sukuria aiškų administratoriaus veiksmą.

## Automatiniai įrodymai

| Patikrinimas                                       | Rezultatas                                            |
| -------------------------------------------------- | ----------------------------------------------------- |
| Tiksliniai dashboard, bylos ir darbo būsenų testai | 3 failai, 24 testai – praėjo                          |
| `npm run lint`                                     | Praėjo                                                |
| `npm run typecheck`                                | Praėjo                                                |
| `npm test`                                         | 117 testų failų, 364 testai – visi praėjo             |
| `git diff --check`                                 | Praėjo                                                |
| Vercel Preview build                               | Praėjo, deployment `dpl_4xAL4JWzuUugY5rQgyx2ecxnvRou` |

Pridėti regresijos testai:

- galutinė sutartis lieka eilėje iki darbo užsakymo sukūrimo;
- galutinė sutartis iš eilės pašalinama tik radus susietą darbą;
- `unassigned`, `assigned` ir `completed` turi atskiras eiles;
- aktyvių darbų filtras neįtraukia paskyrimo ir užbaigimo etapų;
- darbo būsenos generuoja teisingą lead kitą veiksmą ir terminą;
- nauji eilių raktai negali būti pakeisti nežinomu URL parametru.

## Staging priėmimo scenarijus

Po Preview deployment reikia patikrinti:

1. atidaryti apžvalgą lietuvių kalba;
2. patvirtinti, kad matomos naujos pagrindinės kortelės;
3. atidaryti `Pasirašyta – sukurti darbą` ir rasti galutinai pasirašytą bylą be darbo;
4. atidaryti bylą ir sukurti darbo užsakymą, bet nepriskirti darbuotojo;
5. grįžti į apžvalgą ir patvirtinti, kad byla dabar rodoma `Laukia darbuotojo paskyrimo`;
6. patvirtinti, kad ji neberodoma `Pasirašyta – sukurti darbą` ir `Aktyvūs darbai`;
7. techninėje aplinkoje paskirti darbuotoją be datos ir patvirtinti `Reikia suplanuoti`;
8. nustatyti datą ir patvirtinti, kad darbas pereina į `Aktyvūs darbai` bei artimiausių darbų kortelę;
9. patikrinti bylos `Kitas veiksmas` ir terminą kiekviename etape;
10. pakartoti svarbiausius vaizdus EN ir NO panelės kalba.

### Atlikta staging aplinkoje

- nauja versija sėkmingai pastatyta Vercel ir prijungta prie `https://takfornyelse-staging.vercel.app`;
- lietuviškoje apžvalgoje matomos visos naujos pagrindinės kortelės;
- staging duomenys parodė `1` eilėje `Pasirašyta – sukurti darbą`;
- staging duomenys parodė atskirą `1` eilėje `Laukia darbuotojo paskyrimo`;
- `Pasirašyta – sukurti darbą` atidarė konkrečią galutinai pasirašytą sutartį ir susietą kliento bylą;
- tolesnį interaktyvų perėjimų patikrinimą sustabdė pasibaigusi administratoriaus sesija; sistema teisingai grąžino į prisijungimo puslapį.

## A1 gate

- [x] Naujos operacinės eilės įgyvendintos.
- [x] Aktyvūs, nepriskirti, neplanuoti ir užbaigti darbai atskirti.
- [x] Pasirašyta sutartis išlieka matoma iki darbo sukūrimo.
- [x] Kito veiksmo ir termino logika atnaujinama pagal darbo būseną.
- [x] Tiksliniai ir pilni automatiniai testai praeina.
- [x] Vercel Preview build praeina.
- [ ] Autentifikuotas staging scenarijus praeina.
- [x] Fazės įrodymas ir commit įrašyti pagrindiniame statuso registre.
