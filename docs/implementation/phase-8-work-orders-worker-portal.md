# Fase 8 – arbeidsordre og ansattportal

Dato: 23. august 2026  
Gren: `codex/master-platform-implementation`  
Produksjon: ikke endret

## Resultat

En signert kontrakt kan nå bli én idempotent arbeidsordre som administrator tildeler en aktiv ansatt og planlegger. Den ansatte får en mobiltilpasset `/user`-flyt med kunde, kontakt, navigasjon, kontraktsgrunnlag, kundebilder, før-kontroll, kontrollmåling, HMS-stopp, prisbeslutning og før-/etterdokumentasjon. Ingen arbeider kan startes før serveren har konkludert `Klar til start`.

## Leveranser

### Opprettelse og administrasjon

- signert kontrakt har handlingen `Opprett eller åpne arbeidsordre`;
- bare kontrakt med status `signed` og tilbud med status `accepted` kan bli oppdrag;
- én kontrakt kan bare ha én arbeidsordre; gjentatt handling åpner eksisterende ordre;
- kontrakt, tilbud, lead og dokumenthash låses på arbeidsordren;
- administrator tildeler bare aktive brukere med rollen `worker` og setter dato i Payload-admin;
- adminoversikten teller reelle tilbudsutkast, kontrakter til signering, aktive, utildelte og blokkerte oppdrag.

### Mobil ansattportal

- `/user` viser `Mine oppdrag i dag`, `Kommende oppdrag` og `Oppdrag som må ferdigstilles`;
- bare tildelt aktiv ansatt eller administrator kan åpne detaljen;
- annen ansatts og ukjent ordre gir samme `404` uten informasjonslekkasje;
- oppdragskortet viser kunde, telefon, navigasjon, tid, tjeneste, arbeidsbeskrivelse, areal, toleranse, kontraktspris og maksimalpris;
- kundens private bilder vises via indeksbasert autorisert proxy, ikke via åpne Blob-lenker;
- arbeidsbilder lagres som privat `work`-media og kan bare hentes etter ny ordre-/ansattkontroll;
- opplastinger begrenses til JPEG, PNG eller WebP på maksimalt 10 MB.

### Obligatorisk arbeidsflyt

```text
Planlagt
→ På vei
→ Ankommet
→ Før-kontroll
→ Klar til start / Blokkert
→ Startet
→ Arbeid fullført
→ Dokumentasjon levert
```

Serveren tillater ikke å hoppe over et steg. Før-kontrollen krever:

- minst to før-bilder;
- taktype;
- kontrollmålt areal i 0,1 m²;
- målemetode;
- vinkelgrunnlag;
- synlig tilstand;
- HMS-/adkomststatus og kommentar ved risiko;
- markering og forklaring dersom arbeidsomfanget er endret.

Før `Arbeid fullført` kreves minst to etterbilder. Før `Dokumentasjon levert` kreves etterbilder, ferdigmelding og ferdigtid. En dokumentert arbeidsordre er uforanderlig.

### Deterministisk stedskontroll

- faktisk pris beregnes i heltalls-øre fra nøyaktig prisregelversjon i signert tilbud;
- prisregel-ID, versjon, enhetspris og mva. må fortsatt samsvare med snapshotet;
- minstepris og mva. inngår i ny kontrollpris;
- lavere areal gir utfallet `lower`;
- høyere areal innen toleranse og maksimalpris gir `within_contract`;
- areal over toleranse, pris over maksimalbeløp, endret omfang eller HMS-risiko gir `blocked`;
- HMS prioriteres over pris og stopper hele oppdraget;
- blokkert oppdrag kan bare gå tilbake til en ny før-kontroll eller avbrytes;
- kunden får målebekreftelse eller endringsavtale i fase 9; denne fasen starter aldri blokkert arbeid.

### Revisjon og personvern

- hver API-handling gir et uforanderlig audit-event med aktør, korrelasjons-ID og bare feltnavn;
- en begrenset, data-minimert tidslinje på ordren gjør hendelsene synlige for admin;
- tidslinjen lagrer ikke kundenavn, adresse, telefon, bilder eller fritekstverdier;
- alle worker-endepunkter gjør autentisering og tildelingskontroll på nytt;
- vanlige Payload REST-oppdateringer er fortsatt stengt for worker, slik at bare den validerte handlings-API-en kan endre oppdraget.

## Migrasjon

- `20260823_182703_phase8_work_orders` utvider eksisterende arbeidsordreskall med kontrakt, tilbud, bilder, kontroll, pris, HMS, ferdigstilling og tidslinje;
- nye relasjoner til akseptert tilbud og signert kontrakt bruker `RESTRICT`;
- gamle ubrukte shell-rader bevares med nullable nye relasjoner og må ryddes i staging før flagget aktiveres;
- nye rader valideres alltid av collection-hook og kan ikke opprettes uten signert kontrakt;
- rollback mapper nye aktive statuser til `scheduled` og `cancelled` til `unassigned` før gammel enum gjenopprettes;
- migrasjonens `up` og `down` er kjørt mot ekte in-process PostgreSQL via PGlite, inkludert en gammel shell-rad.

## Verifikasjon og Gate 8

| Kontroll | Resultat |
|---|---|
| Alle ikke-migrasjonstester | 71 filer, 207 tester bestått i minnesikre grupper |
| Alle migrasjonstester | 9 filer, 19 tester bestått enkeltvis |
| Samlet testomfang | 80 filer, 226 tester bestått |
| Bare tildelt worker får tilgang | Bestått |
| Status kan ikke hoppes over | Bestått |
| Manglende før-kontroll blokkerer start | Bestått |
| Lavere pris og innenfor avtalt ramme | Bestått |
| Over toleranse/maks, omfang og HMS | Blokkert |
| Etterbilder før ferdigstilling | Påkrevd og testet |
| Migrasjon med gammel shell-rad `up/down` | Bestått |
| TypeScript | Bestått |
| ESLint | Bestått uten feil/advarsler |
| Produksjonsbuild | Bestått; 59 statiske sider og worker-ruter kompilert |

Gate 8 er teknisk bestått. Hele mobilflyten er dekket av server-, API- og domenetester, men må gjentas visuelt og autentisert i staging. Lokal databasebasert nettlesersmoke er fortsatt blokkert på denne Windows ARM64-maskinen av manglende valgfri `libsql`-binær.

## Produksjonsblokkere

- fullfør blokkere fra fase 6 og 7: lisensiert målegrunnlag, godkjente priser, juridiske vilkår og signaturmetode;
- migrer og kontroller eventuelle gamle `work-orders`-shellrader før aktivering;
- opprett personlige worker-kontoer, test deaktivering og aldri del konto/passord;
- konfigurer privat Blob-lagring og test bilder på faktisk mobilnett;
- kjør et komplett anonymisert staging-oppdrag fra signert kontrakt til levert dokumentasjon på iOS og Android;
- gjennomfør HMS-faglig kontroll av den obligatoriske sjekklisten og påkrevde bildebevis;
- første versjon krever nettilgang; offline/PWA-synk skal ikke loves før en kryptert og konflikttrygg løsning er bygget;
- aktiver `FEATURE_WORKER_PORTAL` først etter kontrollene over.
