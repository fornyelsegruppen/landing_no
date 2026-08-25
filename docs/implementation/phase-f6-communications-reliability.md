# F6 — patikima komunikacija ir darbų planuoklis

Data: 2026-08-25  
Būsena: **GO**  
Kodo commitai: `f3e91bc`, `58c336e`, `519ad97`  
Staging deployment: `landing-6gxiyjb53-darbasnorvegija4-8212s-projects.vercel.app`  
Stabili staging nuoroda: `https://takfornyelse-staging.vercel.app`

## Pasiektas tikslas

Kliento, administratoriaus ir darbuotojo komunikacija vykdoma pagal idempotentiškus įvykius bei suplanuotus darbus. El. paštas yra pagrindinis kanalas, tiesioginis kliento atsakymas saugiai grįžta į teisingą bylą, o vėluojantys, nepavykę arba nebeaktualūs pranešimai tampa aiškia administratoriaus užduotimi.

## Įgyvendinta

- Operaciniai job vykdomi pakankamai dažnai 48 val. ir tos pačios dienos priminimams; laikas skaičiuojamas `Europe/Oslo` laiko zonoje.
- Tos pačios dienos priminimas nebesiunčiamas po vizito pradžios; pasikeitus vizito planui pasenę priminimai atšaukiami pagal schedule versiją.
- Užklausos gavimas, paskyrimas, perskyrimas, darbuotojo kelionės būsena, užbaigimas ir įmonės kontraparašas apdorojami event-driven būdu.
- Pasiūlymo priminimų skaičius ribojamas iki dviejų; pasibaigus galiojimui senas pasiūlymas nebegali būti priimtas ar pasirašytas.
- `hard bounce`, negaliojantis el. paštas arba pasibaigę retry sukuria rankinio kontakto užduotį, o ne klaidingą pristatymo būseną.
- SMS šiuo etapu nenaudojamas kaip įprastas kanalas. El. paštas lieka pagrindinis; jei nėra veikiančio el. pašto, byla perduodama rankiniam kontaktui. Ateityje SMS gali būti tik riboto galiojimo nuorodos atsarginis kanalas.
- Kliento atsakymams naudojamas pasirašytas unikalus `Reply-To`, kurio tokenas tikrinamas HMAC ir negali būti panaudotas kitai bylai.
- Resend priėmimui naudojamas atskiras managed receiving domenas; pagrindinio `takfornyelse.as` MX įrašai nebuvo keičiami.
- Atskirtas outbound delivery webhook `/api/webhooks/resend` ir inbound reply webhook `/api/webhooks/resend-inbound`.
- Vercel Preview Deployment Protection apeinama tik Resend webhook užklausoms per atskirą Automation Bypass; bendras staging prisijungimas lieka apsaugotas.
- Preview aplinkoje nustatytas atskiras inbound webhook pasirašymo secret, receiving domenas ir Full Access Resend API raktas, reikalingas gauto laiško turiniui paimti.
- Inbound apdorojimas turi saugią etapų diagnostiką, neatskleidžiančią rakto, tokeno, kliento laiško ar webhook URL.

## Automatiniai vartai

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- Tiksliniai Vitest testai Resend route, inbound ir webhook apdorojimui — PASS.
- Vercel Linux build — PASS.
- Senasis outbound Resend webhook replay su Deployment Protection bypass — `200 OK`.
- Naujasis inbound Resend webhook replay — `200 OK`.

## Staging priėmimas

1. Viešoje staging svetainėje sukurta tikra testinė kliento užklausa.
2. Klientui išsiųstas firminis gavimo patvirtinimas su unikalia bylos `Reply-To` reikšme.
3. Iš kontrolinės Gmail dėžutės atsakyta į tą patį laišką.
4. Resend Receiving patvirtino `email.received` įvykį.
5. Pakeitus Preview Resend raktą iš `Sending access` į `Full access`, webhook pakartojimas grąžino `200 OK`.
6. API rezultatas patvirtino `matched: true`: atsakymas susietas su teisinga kliento byla, o ne paliktas bendroje ar kito kliento eilėje.

## Saugumas ir aplinkų atskyrimas

- Visi nauji Resend bei Vercel bypass duomenys nustatyti tik Preview aplinkoje.
- Produkcijos deployment, duomenų bazė, domenas ir secrets šiame etape nekeisti.
- Laikini Vercel bypass duomenys buvo atšaukti; paliktas tik galutinis staging webhook bypass.
- Senojo `Takfornyelse Staging` sending-only Resend rakto šalinimas paliktas atskiram savininko patvirtintam tvarkymo veiksmui.

## Žinomi F7/F9 tęstiniai darbai

- Platform health ekrane turi būti matoma paskutinė sėkminga inbound/outbound komunikacija, vėluojantys ir dead-letter job.
- Payload el. pašto adapterio perspėjimas ir privataus media storage adapterio perspėjimas turi būti uždaryti iki production GO.
- Tiesioginis inbound atsakymas F8 etape turi automatiškai sukurti Gemini atsakymo juodraštį, bet negali jo išsiųsti be administratoriaus patvirtinimo.

## Rollback

- Inbound ir outbound webhook yra atskiri route, todėl inbound galima išjungti nepaveikiant delivery status webhook.
- Resend webhook subscriptions ir Vercel Automation Bypass gali būti atšaukti atskirai.
- Kodo rollback taškai: `519ad97` → `58c336e` → `f3e91bc` → F5 `9720b2e`.
- Produkcija šiame etape nepakeista.

## F6 GO

F6 tikslas pasiektas: suplanuoti ir event-driven pranešimai turi apsaugas nuo pasikartojimo bei pasenimo, o realus kliento el. pašto atsakymas priimtas ir susietas su teisinga staging byla. Galima pereiti į F7.

FUNCTIONAL_RESULT=PASS  
TARGET_ACHIEVED=YES  
REGRESSION_TESTS=PASS  
STAGING_ACCEPTANCE=PASS  
ROLLBACK_READY=YES
