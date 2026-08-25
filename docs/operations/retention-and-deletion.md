# Lagring, arkivering og sletting

## Dataklasser

| Data | Standardregel | Automatikk / kontroll |
|---|---|---|
| Uforpliktende henvendelse og leadbilder | Administrator arkiverer eller flytter saken til papirkurven; papirkurven har minst 30 dagers angrefrist | Ukentlig retention-jobb velger bare `trashed` saker med utløpt `purgeAfter`; aktive eller bare arkiverte saker slettes aldri automatisk |
| AI-utkast og ikke-sendte meldinger | Følger henvendelsen | Slettes før leadet når ingen signert avtale finnes |
| Måling og prisgrunnlag uten avtale | Følger henvendelsen | Slettes med lead etter relasjonskontroll |
| Akseptert tilbud, signert kontrakt, endringsavtale og signaturbevis | Beholdes etter avtale-/reklamasjons-/lovgrunnlag | Kan ikke slettes som ordinært lead; skal arkiveres og vurderes av ansvarlig |
| Arbeidsordre, HMS-kontroll og før-/etterdokumentasjon | Beholdes så lenge avtale, reklamasjon eller dokumentasjonsplikt krever | Privat tilgang og manuell retention-beslutning |
| Audit-event | Operativt og rettslig behov | Uforanderlig i admin; periode fastsettes juridisk før produksjon |
| Offentlig blogg og offentlig media | Til den avpubliseres/erstattes | Versjonering og redirect ved sammenslåing |

## Sikker slettelogikk

- signert kontrakt stopper ordinær lead-sletting;
- akseptert tilbud, arbeidsordre, fakturapost eller garanti stopper også permanent lead-sletting;
- direkte sletting i teknisk admin er sperret; administrator bruker `/admin-v2`-arkivet;
- én beskyttet rad skal ikke stoppe sletting av andre kvalifiserte rader;
- feil rapporteres separat fra lovlig beholdte rader;
- Blob slettes aldri etter bare alder eller mappeprefix; URL må ha tilhørt leadet som faktisk ble slettet;
- ukjent host, ugyldig URL og urelatert Blob ignoreres;
- signerte dokumenter og private arbeidsfiler slettes ikke av lead-cron;
- personvernforespørsler behandles av administrator med identitetskontroll og vurdering av lovlige unntak.

Juridisk ansvarlig må fastsette konkrete perioder for kontrakt, reklamasjon, regnskap, HMS og audit før produksjonsaktivering.
