# F7 — paprasta ir tiksli administratoriaus darbo vieta

Data: 2026-08-25  
Būsena: **GO**  
Kodo commitai: `40542dc`, `e0cd887`  
Staging deployment: `landing-4gqqgicil-darbasnorvegija4-8212s-projects.vercel.app` (`dpl_6ipFDLEg2rW9vRZsMkbsC11dRuud`)  
Stabili staging nuoroda: `https://takfornyelse-staging.vercel.app`

## Pasiektas tikslas

Administratorius vienoje custom `admin-v2` aplinkoje mato tikras veiksmų eiles, universalią aktyvių ir archyvuotų bylų paiešką, darbų planą, tikslias dokumentų nuorodas ir saugią sistemos būklės santrauką. Kasdieniams veiksmams nereikia eiti į techninį Payload administravimą.

## Įgyvendinta

- „Naujos užklausos“ skaičiuojamos pagal pirmą administratoriaus peržiūrą, o ne pagal techninę bylos būseną.
- Bylos peržiūra pažymima nekeičiant optimistinio bylos revizijos numerio, todėl vien peržiūra nesukuria klaidingo konflikto.
- Senos staging bylos atskira migracija pažymėtos kaip jau peržiūrėtos; naujos užklausos po migracijos lieka neperžiūrėtos.
- Universalioje paieškoje randamos aktyvios, archyvuotos ir šiukšlinėje esančios bylos, taip pat pasiūlymų, sutarčių, darbų, sąskaitų, garantijų, matavimų ir pakeitimų susitarimų numeriai.
- Darbų sąrašas rodo faktinį vizito laiką, pasirinktą atvykimo intervalą ir darbuotoją, kai darbuotojo profilis atitinka privalomus vardo bei telefono reikalavimus.
- Artimiausių darbų eilėje palikti tik suplanuoti, dar nepradėti vizitai.
- Aktyvios garantijos turi atskirą kortelę ir eilę.
- Laiko juostos įrašai nukreipia į konkrečią žinutę, sutartį, darbą, sąskaitos juodraštį arba garantiją toje pačioje byloje.
- Aiškiai atskirtas bylos vadybininkas ir lauko darbuotojas.
- Įprastas uždarymas vykdomas per klasifikuotą archyvavimo veiksmą; atskiro klaidinančio greito uždarymo mygtuko nėra.
- Nustatymų puslapyje pridėta sistemos būklė: integracijų parengtis, production vartai, job vėlavimai ir klaidos, el. pašto bei SEO būsena, quota perspėjimai ir backup įrodymas. Slaptų reikšmių ekranas nerodo.

## Automatiniai vartai

- Pilna unit testų seka — PASS: 133 failai, 439 testai.
- Pilna migracijų testų seka po legacy backfill — PASS: 17 failų, 30 testų.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- Vercel Linux build — PASS.
- Migracijos `20260825_235000_admin_operations` ir `20260825_235100_admin_review_backfill` Preview duomenų bazėje — PASS.

## Staging priėmimas

1. Autentifikuota `/admin-v2` apžvalga atsidaro po galutinio deployment.
2. „Naujos užklausos“ rodo `0`, o `?queue=new-leads` patvirtina tuščią eilę; senos bylos nebelaikomos naujomis.
3. Universali paieška rado aktyvias bylas pagal vardą ir archyvuotą `F2 SYNTHETIC EVIDENCE TEST` bylą.
4. Aktyvių darbų sąraše matomi vizito laikas ir sutartas atvykimo intervalas. Legacy darbuotojas be privalomo pilno profilio sąmoningai nerodomas kaip patikima kliento kontaktinė tapatybė; nauji paskyrimai tokio profilio nebepriima.
5. Bylos laiko juosta turi tikslias žinučių, sutarties ir darbo sekcijų nuorodas. Sąskaitos ir garantijos tikslinių nuorodų logika padengta testais; staging duomenyse tokio užbaigto pavyzdžio šiuo metu nėra.
6. Sistemos būklės ekranas rodo veikiančias Gemini, Resend, Kartverket, OSM, pasirašymo, teisinių tekstų ir job integracijas bei tikrus likusius production blokavimus.

## Sąmoningai likę production blokavimai

- Neužfiksuotas backup atkūrimo bandymas.
- Trūksta patvirtintos žemėlapio vaizdo integracijos ir paieškos duomenų šaltinio.
- Yra vėluojančių ir nepavykusių legacy job, kuriuos reikia sutvarkyti prieš production.
- Payload techninis el. pašto adapteris ir privataus media Vercel storage adapteris turi būti uždaryti F9/F10.
- Production gate lieka uždarytas; produkcija nepakeista.

## Rollback

- Legacy peržiūrų backfill yra atskira migracija ir turi atskirą rollback.
- F7 funkcionalumas izoliuotas custom admin read-model, API ir migracijų pakeitimuose.
- Kodo rollback taškai: `e0cd887` → `40542dc` → F6 `1ff45ae`.
- Produkcija šiame etape nepakeista.

## F7 GO

F7 tikslas pasiektas: administratorius turi tikslias veiksmų eiles, paiešką, darbų ir dokumentų orientaciją bei matomą sistemos būklę. Galima pereiti į F8.

FUNCTIONAL_RESULT=PASS  
TARGET_ACHIEVED=YES  
REGRESSION_TESTS=PASS  
STAGING_ACCEPTANCE=PASS  
ROLLBACK_READY=YES
