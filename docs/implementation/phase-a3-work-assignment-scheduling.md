# A3 – darbo sukūrimas, paskyrimas ir planavimas

**Būsena:** užbaigta 2026-08-25  
**Aplinka:** tik staging šaka

## Pasiektas rezultatas

- Bylos darbo dalyje administratorius vienoje formoje sukuria darbą, pasirenka aktyvų darbuotoją, darbo datą bei atvykimo pradžią ir pabaigą iš kontroliuojamų sąrašų.
- Darbą galima sukurti ir be darbuotojo; jis lieka aiškioje „Laukia darbuotojo paskyrimo“ eilėje.
- Esamą nepradėtą darbą galima perskirti ir perplanuoti toje pačioje custom administratoriaus sąsajoje.
- Planavimo laikas konvertuojamas pagal `Europe/Oslo`, nepriklausomai nuo administratoriaus įrenginio laiko juostos.
- Tik aktyvi `worker` paskyra gali būti paskirta darbo užsakymui; papildomai tai tikrina Payload hook.
- Sukūrimas išlieka idempotentinis pagal pasirašytą sutartį – antras darbas tai pačiai sutarčiai nesukuriamas.
- Serveris tikrina `HH:mm–HH:mm` intervalą, neleidžia pabaigos prieš pradžią ir reikalauja, kad planavimo pradžia sutaptų su atvykimo intervalo pradžia.
- Paskyrimo išsaugojimas nepriklauso nuo laiško tiekėjo rezultato: darbas išsaugomas atominiu būdu, o nepavykęs pranešimas lieka saugioje retry / attention eilėje.
- Darbuotojo, datos, intervalo arba būsenos pasikeitimas versijuoja klientų pranešimus, atšaukia nebegaliojančius priminimus ir atnaujina bylos kitą veiksmą.
- Klientui iškart siunčiamas profiliuotas paskyrimo laiškas su darbo data, atvykimo intervalu, darbuotojo vardu ir telefonu; jei telefono nėra, naudojamas įmonės numeris.
- Darbuotojo veiksmai `vykstu`, `atvykau` ir `pradėti darbus` sukuria atskirus idempotentinius kliento pranešimus. Darbuotojo portalas parodo, ar pranešimas išsiųstas, ar laukia siuntimo eilėje.
- Darbuotojo `/user` darbo puslapyje matomas atvykimo intervalas ir vidinė planavimo pastaba.
- Nepradėtą darbo užsakymą galima kontroliuojamai atšaukti; veiksmai audituojami be neapdorotų kliento duomenų.

## Duomenų schema

- `work_orders.arrival_window`
- `work_orders.admin_note`
- migracija `20260825_150000_admin_work_scheduling`

## Patikra

- `npm run lint` – praėjo.
- `npm run typecheck` – praėjo.
- planavimo ir komunikacijos regresija: 6 failai / 20 testų – praėjo.
- visas atnaujintas rinkinys: 119 failų / 376 testai – praėjo.
- `generate:types` šiame Windows ARM kompiuteryje sustabdo dokumentuota pasirenkamo `@libsql/win32-arm64-msvc` paketo išimtis; du nauji tipai sinchronizuoti rankiniu būdu, o Vercel Linux build lieka galutinis generavimo patikrinimas.
