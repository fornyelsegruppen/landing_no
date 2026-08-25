# A3 – darbo sukūrimas, paskyrimas ir planavimas

**Būsena:** užbaigta 2026-08-25  
**Aplinka:** tik staging šaka

## Pasiektas rezultatas

- Bylos darbo dalyje administratorius vienoje formoje sukuria darbą, pasirenka aktyvų darbuotoją, įveda Norvegijos vietinį laiką, atvykimo intervalą ir vidinę pastabą.
- Darbą galima sukurti ir be darbuotojo; jis lieka aiškioje „Laukia darbuotojo paskyrimo“ eilėje.
- Esamą nepradėtą darbą galima perskirti ir perplanuoti toje pačioje custom administratoriaus sąsajoje.
- Planavimo laikas konvertuojamas pagal `Europe/Oslo`, nepriklausomai nuo administratoriaus įrenginio laiko juostos.
- Tik aktyvi `worker` paskyra gali būti paskirta darbo užsakymui; papildomai tai tikrina Payload hook.
- Sukūrimas išlieka idempotentinis pagal pasirašytą sutartį – antras darbas tai pačiai sutarčiai nesukuriamas.
- Datos arba būsenos pasikeitimas paleidžia esamą klientų priminimų sinchronizaciją ir atnaujina bylos kitą veiksmą.
- Darbuotojo `/user` darbo puslapyje matomas atvykimo intervalas ir vidinė planavimo pastaba.
- Nepradėtą darbo užsakymą galima kontroliuojamai atšaukti; veiksmai audituojami be neapdorotų kliento duomenų.

## Duomenų schema

- `work_orders.arrival_window`
- `work_orders.admin_note`
- migracija `20260825_150000_admin_work_scheduling`

## Patikra

- `npm run lint` – praėjo.
- `npm run typecheck` – praėjo.
- 7 tiksliniai failai / 27 testai – praėjo.
- visas rinkinys: 120 failų / 373 testai – praėjo.
- `generate:types` šiame Windows ARM kompiuteryje sustabdo dokumentuota pasirenkamo `@libsql/win32-arm64-msvc` paketo išimtis; du nauji tipai sinchronizuoti rankiniu būdu, o Vercel Linux build lieka galutinis generavimo patikrinimas.
