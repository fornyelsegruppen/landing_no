# Naktinio saugaus vykdymo ataskaita

Data: 2026-08-28
Tarpinė būsena: **O-0 taisymo ciklas vykdomas**

## Rezultatas

Naktinis planas pradėtas. Pirmuose Production saugos vartuose aptiktas incidentas, o savininkas išplėtė įgaliojimą: saugiai pataisomi incidentai turi būti užbaigiami, o ne paliekami laukti. Vykdomas tikslinis taisymo ciklas su regresijos testu, pilnomis patikromis, Preview įrodymu ir rollback vartais.

## PASS

- aktyvus Production deployment yra `READY`;
- užfiksuotas ankstesnis `READY` rollback kandidatas;
- vieša svetainė, tinklaraštis ir administratoriaus prisijungimo puslapis grąžina HTTP 200;
- Quality Gate run `33116393482` yra žalias;
- backup/restore įrodymo kintamieji yra Production konfigūracijoje, o paskutinis patikrintas backup buvo užfiksuotas sistemos būklės skydelyje;
- read-only bylos #10 diagnostika patvirtino, kad pasiūlymo, sutarties, abiejų parašų ir darbo užsakymo grandinė išliko vientisa.

## STOP

- aptikti du pasikartojantys `POST /api/admin/leads/10` HTTP 500;
- jie atitinka automatinį bylos `mark_reviewed` veiksmą;
- peržiūros žyma DB liko tuščia ir audito įrašas nesukurtas;
- tiksli serverio išimties žinutė dėl dabartinio sanitarizuoto logavimo nepasiekiama.

## VYKDOMA DABAR

Tikslinis `mark_reviewed` pataisymas ir Preview įrodymas pagal [incidento planą](./incident-2026-08-28-admin-mark-reviewed-500.md). Savininko laukti nereikia, kol veiksmas lieka naujoje saugos riboje.

## Tiesioginės nuorodos

- Production administravimas: <https://www.takfornyelse.as/admin-v2>
- Production bylos: <https://www.takfornyelse.as/admin-v2/cases>
- GitHub Quality Gate: <https://github.com/fornyelsegruppen/landing_no/actions/runs/33116393482>

## Fazės

| Fazė | Būsena |
|---|---|
| O-0 Production freeze | **TAISOMA** |
| O-1–O-6 | **PENDING, vykdomos tik eilės tvarka po O-0 PASS** |
| O-7 | **PENDING** |
