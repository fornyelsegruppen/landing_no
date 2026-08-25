# A8 — Kasdienė administratoriaus aplinka

## Rezultatas

Pagrindinė `/admin-v2` navigacija turi dešimt kasdieniam darbui skirtų punktų ir nė vienas iš jų neveda tiesiai į Payload:

1. Apžvalga;
2. Visos bylos;
3. Pasiūlymai;
4. Sutartys;
5. Darbai;
6. Dokumentai;
7. Archyvas ir šiukšlinė;
8. Tinklaraštis;
9. Darbuotojai;
10. Nustatymai.

Žinutės rodomos konkrečioje kliento byloje, todėl jos nebedubliuojamos kaip atskiras, konteksto neturintis pagrindinės navigacijos punktas.

## Nauji custom puslapiai

- `/admin-v2/offers` — aktyvių bylų pasiūlymai su būsenų filtrais;
- `/admin-v2/contracts` — aktyvių bylų sutartys ir parašų būsena;
- `/admin-v2/work` — nepriskirti, planuojami, aktyvūs ir užbaigti darbai;
- `/admin-v2/blog` ir `/admin-v2/blog/[id]` — AI juodraščių generavimas, turinio / SEO laukų redagavimas, Pexels nuotraukos keitimas, patvirtinimas, planavimas, publikavimas, atmetimas ir regeneravimas;
- `/admin-v2/employees` — darbuotojo paskyros sukūrimas, portalo kalba ir aktyvavimas / išjungimas;
- `/admin-v2/settings` — baziniai vieši kontaktai ir darbo laikas.

Dokumentų centras ir archyvas įgyvendinti ankstesnėse fazėse ir įtraukti į tą pačią navigaciją.

## Techninis fallback

Payload backoffice išimtas iš pagrindinės navigacijos. Jis lieka tik administratoriui suskleistoje `Techninis administravimas` skiltyje. Analogiškai gili techninė konkretaus įrašo nuoroda rodoma suskleista bylos ar tinklaraščio apačioje.

## Kalbos ir klientų turinys

Visi nauji puslapiai turi NB, LT ir EN administravimo tekstus. Kalbos pasirinkimas nekeičia klientui skirtų pasiūlymų, sutarčių, laiškų ar tinklaraščio publikacijų kalbos — jos lieka norvegų kalba.

## Saugumas

- Visi puslapiai naudoja `requireAdminUser`.
- Visi mutacijų API papildomai tikrina aktyvų administratorių per Payload sesiją.
- Darbuotojų puslapis kuria tik `worker` paskyras; administratoriaus vaidmenys keičiami tik techniniame fallback.
- Tinklaraščio ir nustatymų pakeitimai registruojami audite.
- Navigacijos testas saugo taisyklę, kad visi pagrindiniai `href` prasidėtų `/admin-v2`.

## Patikra

- TypeScript: be klaidų;
- ESLint: be klaidų ir perspėjimų;
- A8 tiksliniai testai: operacinių sąrašų ir pagrindinės navigacijos;
- bendra vienetų regresija: 118 failų / 373 testai;
- migracijų rezultatas nesikeičia nuo A7: 13 failų / 25 testai;
- desktop / mobile vizualinė ir klaviatūros patikra atliekama jau įkėlus tą patį commit į Vercel Preview A9 metu.
