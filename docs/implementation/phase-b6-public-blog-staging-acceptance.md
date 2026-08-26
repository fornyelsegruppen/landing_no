# B6 — galutinis viešo blogo staging priėmimas

**Data:** 2026-08-26
**Aplinka:** Vercel Preview / staging
**Produkcija:** nepakeista
**Release commit:** `e625ac40b8d8ae217e5b3ece43db8d722f1649c7`
**Git tag:** `public-blog-staging-rc-2026-08-26`
**Deployment ID:** `dpl_DFj7Mja8JZhhfCx4MDbupX9LcbT5`
**Preview URL:** `https://landing-9unhnmwbe-darbasnorvegija4-8212s-projects.vercel.app`
**Staging alias:** `https://takfornyelse-staging.vercel.app`

## Viešas lankytojo kelias

Naršyklėje realiai pereita:

1. `/no`;
2. pagrindinio meniu `Råd og guider`;
3. `/no/blogg`;
4. publikuotas straipsnis `/no/blogg/takfornying-alesund-kystklima`;
5. straipsnio CTA `Be om gratis vurdering`;
6. `/no#kontakt` ir matoma užklausos forma.

Kiekviename žingsnyje:

- URL ir H1 atitiko numatytą puslapį;
- nebuvo horizontalaus perslinkimo;
- nebuvo vaizdų be `alt`;
- naršyklės klaidų žurnalas liko tuščias.

Lead `contentSourcePath` įrašymas ir patikra papildomai dengiami `lead-attribution` bei `blog-publishing-flow` unit testais; saugyklos turinys naršyklėje sąmoningai nebuvo skaitomas.

## Administratoriaus ir publikavimo kelias

- `/admin-v2/blog` rodo du publikuotus AI parengtus ir žmogaus patikrintus straipsnius.
- Faktinis straipsnis turi redagavimo, preview, approve, publish, reject ir regenerate valdiklius.
- B4 metu realus turinio ir šaltinio pataisymas buvo publikuotas per administravimą.
- Viešas straipsnis atsinaujino per ISR be rankinio redeploy maždaug per 60 sekundžių.
- B1 publikavimo politika ir testai garantuoja, kad viešai grąžinamas tik Payload `published` ir redakciškai `published` dokumentas.
- Galutiniame sitemap yra abu katalogai, 2 NO straipsniai ir 0 EN straipsnių be pilno EN turinio.

## Galutinio kandidato smoke

Po release commit deploy dar kartą patikrinta:

- `/no` ties 375 px — PASS;
- `/no/blogg` ties 375 px — PASS;
- faktinis straipsnis ties 375 px — PASS;
- `/admin-v2/blog` ties 1440 px — PASS;
- Vercel production build Preview aplinkoje — PASS;
- sitemap — PASS;
- konsolės klaidos — 0.

## Rollback

- Pradinė prieš blogo integraciją sukurta žyma: `pre-public-blog-integration-2026-08-26`.
- Galutinis staging kandidatas: `public-blog-staging-rc-2026-08-26`.
- Produkcija nebuvo deployinta ar perjungta.

## Savininko priėmimas

Techninis paketas paruoštas savininko vizualinei patikrai. B6 neuždaroma ir produkcija nekeičiama, kol savininkas aiškiai neparašo:

```text
Staging GO
```

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
TECHNICAL_STAGING_ACCEPTANCE=PASS
OWNER_STAGING_APPROVAL=PENDING
SECURITY_AND_PRIVACY=PASS
ROLLBACK_READY=YES
NEXT_PHASE_ALLOWED=NO
```
