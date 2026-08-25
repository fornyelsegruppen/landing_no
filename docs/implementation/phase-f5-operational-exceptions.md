# F5 — operacinės išimtys custom admin aplinkoje

Data: 2026-08-25  
Būsena: **GO**  
Kodo commitai: `8aec6f0`, `9720b2e`  
Staging deployment: `dpl_5JamfoDvhVdvgtnaxGvZAVUjGkwg`

## Pasiektas tikslas

Kasdienėms matavimo, darbo blokavimo, paskyrimo ir komunikacijos išimtims nebereikia atidaryti Payload. Techninės nuorodos lieka tik suskleistoje diagnostikos dalyje.

## Įgyvendinta

- Blokuoto darbo byloje rodoma tiksli blokavimo priežastis, ploto ir kainos palyginimas bei vienas leistinas kitas veiksmas.
- `admin-v2` galima sukurti pakeitimo susitarimo juodraštį, jį peržiūrėti PDF, patvirtinti, išsiųsti klientui arba atšaukti; kliento priėmimas / atmetimas išlieka toje pačioje byloje.
- Įdiegtas administratoriaus veiksmas trūkstamai informacijai paprašyti; jis sukuria norvegišką žinutės juodraštį, kurį prieš siuntimą dar patvirtina administratorius.
- Visi aktyvūs darbo statusai turi aiškią operacinę reikšmę: suplanuota pradžia, objekto patikra, vykdomas darbas, dokumentacijos laukimas arba blokavimo sprendimas.
- Paskirti klientui matomą darbuotoją galima tik tada, kai paskyra aktyvi, turi pilną vardą ir tinkamą telefono numerį.
- Paskyrus ar perskyrus darbuotoją klientui siunčiama data, atvykimo intervalas, vardas ir telefonas; darbuotojui siunčiamas atnaujintas darbo pranešimas.
- Perplanavimas išsaugo ankstesnį ir naują planą, priežastį bei aktorių; pasenę priminimai atšaukiami pagal naują schedule version.
- Darbuotojo priešpatikros ir užbaigimo tekstai saugomi lokaliai telefone. Rodomos būsenos `neišsiųsta / išsaugota telefone / siunčiama / išsiųsta / klaida`; klaidos atveju duomenys lieka telefone.
- Telefono nuotraukos prieš siuntimą orientuojamos per browser decoder, sumažinamos iki 2200 px, glaudinamos, įkėlimas kartojamas iki trijų kartų ir serveris priima failą tik sutapus SHA-256.
- Darbuotojo API ir toliau neleidžia pradėti darbo, kol privalomas pakeitimo susitarimas nėra priimtas.
- Užbaigimo patikra sukuria atskirą nekintamą garantijos įrašą, susietą su originaliu darbu, klientu, dokumentais, apimtimi ir terminu.

## Automatiniai vartai

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run test:ci:unit` — PASS: 130 failų / 423 testai (prieš paskutinį tik etiketės papildymą); papildomas next-action testas — PASS: 30 testų.
- `npm run test:ci:migrations` — PASS: 16 failų / 28 testai.
- `npx next build` — kompiliacija ir TypeScript PASS; vietinis Windows ARM64 page collection sustoja tik dėl žinomo neprivalomo `@libsql/win32-arm64-msvc` modulio.
- Vercel Linux build — PASS, 67 puslapiai sugeneruoti.

## Staging priėmimas

- `admin-v2/cases/10`: trūkstamos informacijos veiksmas matomas custom admin, techninės nuorodos suskleistos.
- `admin-v2/cases/8`: `precheck` byla rodo teisingą veiksmą „Darbuotojas atlieka objekto patikrą“, o ne klaidingą „Veiksmų nereikia“.
- `/user/arbeid/2`: mobilioje darbuotojo formoje lokaliai įrašytas tekstas išliko po puslapio perkrovimo.
- Pakeitimo susitarimo API, workflow ir darbo pradžios blokavimas padengti unit testais; PDF ir custom darbo stalas įtraukti į sėkmingą Linux buildą.

## Rollback

- Funkcijos valdomos `FEATURE_ADMIN_EXCEPTION_FLOWS_V2`; išjungus flagą lieka ankstesnis saugus serverio workflow.
- Kodo rollback taškai: `9720b2e` → `8aec6f0` → F4 `f82b462`.
- Produkcija šiame etape nepakeista.

## F5 GO

F5 tikslas pasiektas: įprastos operacinės išimtys valdomos custom admin, darbuotojo duomenys apsaugoti nuo ryšio nutrūkimo, o nepilnas nuotraukos failas nelaikomas priimtu. Galima pereiti į F6.
