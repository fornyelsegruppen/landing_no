# F8 — kliento atsakymai, saugūs AI juodraščiai ir užsakymo išsaugojimas

Data: 2026-08-25  
Būsena: **GO**  
Kodo commitas: `07b486c`  
Staging deployment: `landing-dazo6kafy-darbasnorvegija4-8212s-projects.vercel.app` (`dpl_6tg37goaFrniWsNv5bmQVB31B28f`)  
Stabili staging nuoroda: `https://takfornyelse-staging.vercel.app`

## Pasiektas tikslas

Kliento klausimas, atsakymas el. paštu, pasiūlymo atmetimas arba atšaukimo prašymas dabar sukuria aiškią administratoriaus užduotį ir saugų Gemini juodraštį. AI tekstas niekada nesiunčiamas automatiškai: administratorius custom `admin-v2` aplinkoje mato originalią kliento žinutę, faktų perspėjimus, redaguoja, gali per-generuoti ir tik tada patvirtina siuntimą.

## Įgyvendinta

- Pridėta atskira bylos būsena `customer_waiting`: klientas laukia mūsų atsakymo. Ji nebesupainiojama su `waiting_customer`, kai mes laukiame kliento.
- Saugus kliento atsakymo AI kontekstas naudoja tik minimizuotą žinutę, patvirtintą stogo matavimą, aktyvų pasiūlymo snapshot, sutartį ir darbo būseną.
- Deterministinė patikra blokuoja AI išgalvotą kainą, plotą, garantiją, neatvirtintą vizito datą ir automatinį sutarties atšaukimo patvirtinimą.
- Kliento puslapio klausimai ir Resend inbound laiškai naudoja tą pačią idempotentišką `customer.reply.draft` job eigą.
- Administratoriaus bylos lange pridėtas pilnas juodraščio redaktorius: originali kliento žinutė, faktų perspėjimai, tema, tekstas, išsaugojimas, per-generavimas ir `Patvirtinti ir išsiųsti`.
- Pasiūlymo atmetimas saugo struktūrinę priežastį ir komentarą, parengia draugišką follow-up juodraštį ir palieka bylą administratoriaus sprendimui.
- Atmestą pasiūlymą galima išsaugant istoriją pakeisti nauja versija: administratorius gali keisti patvirtintą kainą, nuolaidą ir pridėti rekomenduojamą paslaugos alternatyvą.
- Po pasirašymo pateiktas atšaukimo prašymas sustabdo darbo sukūrimą arba darbų pradžią, bet pats neatšaukia sutarties.
- Administratorius turi atskirą atšaukimo sprendimo langą su rašytiniu pagrindu: patvirtinti atšaukimą arba po išaiškinimo tęsti sutartį.
- Atšaukimo sprendimo klientui tekstas lieka juodraščiu iki administratoriaus patvirtinimo.
- Išsiuntus atsakymą byla teisingai pereina į `waiting_customer`; uždaryta byla po atšaukimo patvirtinimo nebeatidaroma dėl išsiųsto laiško.
- Pridėtos ryšių ir atšaukimo audito kolonos, indeksai bei reversinė migracija.

## Saugos taisyklės

1. AI tik siūlo tekstą; kainą ir plotą pateikia tik iš patvirtinto snapshot.
2. Juodraštis neturi `approvedAt` ir negali patekti į delivery job be administratoriaus veiksmo.
3. Atšaukimo prašymas sustabdo operacinį vykdymą, bet teisinį sprendimą priima tik administratorius.
4. Naujas pasiūlymas nekeičia atmetimo istorijos; senoji versija lieka audite.
5. Produkcija šiame etape nepakeista.

## Automatiniai vartai

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- Tiksliniai AI, būsenų, atšaukimo, darbo sukūrimo ir migracijos testai — PASS.
- Pilna unit seka — PASS.
- Pilna migracijų seka — PASS.
- Vercel Linux production build Preview aplinkoje — PASS.
- Migracija `20260825_235200_customer_reply_workflow` staging DB — PASS.
- Protected Preview autorizuotas HTTP smoke — PASS.

## Staging priėmimas

1. Deployment yra `READY`, target `preview`.
2. Stabili `takfornyelse-staging.vercel.app` nuoroda perkelta tik į naują Preview deployment.
3. Viešas `/no` grąžina HTTP 200 per oficialų Vercel protected-preview kelią.
4. Neautentifikuotas `/admin-v2` grąžina login redirect, todėl administratoriaus sritis lieka apsaugota.
5. Nauja duomenų bazės migracija pritaikyta prieš Next build; build surinko visas admin, customer ir worker routes.
6. Prisijungtos administratoriaus bylos vizualinė nuoroda parengta savininko spot-check; pilnas pakartojamas autentifikuotas E2E vykdomas F9.

## Rollback

- Kodo rollback taškas prieš F8: `dc84dba`.
- Migracijos `down` pašalina naujus laukus, ryšius ir indeksus bei saugiai paverčia `customer_waiting` į ankstesnę `draft_ready` būseną.
- Staging alias gali būti grąžintas į F7 deployment `dpl_6ipFDLEg2rW9vRZsMkbsC11dRuud`.
- Produkcija nebuvo diegta ir jos rollback nereikalingas.

## F8 GO

F8 tikslas pasiektas: kiekvienas kliento atsakymas turi saugų, administratoriaus kontroliuojamą kelią; atmetimai gali būti profesionaliai gelbėjami, o atšaukimo prašymas negali automatiškai pakeisti sutarties ar leisti pradėti darbus. Galima pereiti į F9.

FUNCTIONAL_RESULT=PASS  
TARGET_ACHIEVED=YES  
REGRESSION_TESTS=PASS  
STAGING_ACCEPTANCE=PASS  
ROLLBACK_READY=YES
