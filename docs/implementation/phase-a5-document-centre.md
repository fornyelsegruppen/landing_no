# A5 – klientų bylomis paremtas dokumentų centras

**Būsena:** techniškai užbaigta 2026-08-25; bendra staging patikra atliekama A9

## Pasiektas rezultatas

- Sukurtas kasdieniam darbui skirtas `/admin-v2/documents` dokumentų centras.
- Dokumentai grupuojami pagal klientą ir bylos numerį, o ne rodomi kaip techninis failų sąrašas.
- Paieška apima klientą, bylos numerį, dokumento numerį ir failo pavadinimą.
- Galima filtruoti pagal tipą ir faktinę dokumento būseną.
- Registre rodomi pasiūlymai, sutarties juodraščiai, kliento pasirašytos ir galutinės sutartys, pakeitimų susitarimai, stogo matavimo priedai ir darbų dokumentacija.
- Kiekvienas įrašas rodo versiją, datą, būseną, susijusią bylą ir, kai yra, nekintamumo hash identifikatorių.
- Pasiūlymo PDF generuojamas iš tos pačios nekintamos versijos, kurią mato klientas ir naudoja sutartis.
- Privatūs failai atidaromi per autorizuotą `/api/admin/media/{id}` kelią. Jis tikrina administratoriaus sesiją, neleidžia viešo cache ir nesiremia kasdieniu Payload failo ekranu.
- Šoninės navigacijos `Dokumentai` nuoroda dabar veda į custom administravimo aplinką.
- Sąskaitų ruošiniai ir garantijos bus prijungti prie to paties registro A6 etape.

## Saugos sprendimai

- Neprisijungęs vartotojas gauna `401`, ne administratorius – `403`.
- Failo turinys skaitomas tik po autorizacijos; privatus Blob URL klientui neperduodamas.
- Pasirašyti dokumentai šiame registre tik skaitomi – centras neturi perrašymo veiksmo.
- Atsakyme naudojami `private, no-store` ir `X-Content-Type-Options: nosniff` antraštės.

## Patikra

- `npm run typecheck` – praėjo.
- `npm run lint` – praėjo.
- tiksliniai dokumentų ir bylos modelio testai: 2 failai / 27 testai – praėjo.
- visas rinkinys: 124 failai / 379 testai – praėjo.

## Gate

Techninis A5 gate praėjo. Autentifikuota Preview peržiūra, PDF atidarymas ir galutinis bendras staging E2E atliekami A9, kai bus prijungti A6 sąskaitos bei garantijos dokumentai.
