# Databehandler- og integrasjonsoversikt

Dette er et teknisk inventar, ikke en ferdig juridisk godkjenning. Systemeier må bekrefte faktisk leverandør, region, avtale, underleverandører, overføringsgrunnlag, retention og sletting før tilhørende feature aktiveres.

| Leverandør / kategori | Formål | Mulige data | Teknisk minimering | Produksjonsgate |
|---|---|---|---|---|
| Hosting/Next.js (Vercel eller valgt host) | Applikasjon og runtime | forespørselsmetadata | secrets i hostens vault; ingen kundedata i byggelogger | DPA, region og loggretention |
| PostgreSQL/Neon eller valgt database | System of record | alle nødvendige forretningsdata | rollebegrensning, TLS, snapshot og restore | DPA, region, backup/restore |
| Vercel Blob eller valgt fillager | kunde-, kontrakt- og arbeidsfiler | bilder og PDF | privat tilgang, serverautorisasjon, eksakt sletting | DPA, privat Blob-test |
| Resend eller valgt e-postleverandør | nødvendige kundeutsendinger | navn, e-post, melding og valgte vedlegg | faste maler, godkjent utsending, idempotency | DPA, avsenderdomene, testmottaker |
| Gemini/Google AI | interne utkast | minimert faglig lead-/innholdskontekst | ingen standardprompt med navn, e-post, telefon eller full adresse; menneskekontroll | DPA/vilkår og eksplisitt flagg |
| Google Search Console | SEO-lesedata | side-/søkeytelse, ingen leadkontakt | read-only scope og eksakt eiendom | tilgang til riktig domain property |
| Kartverket / lisensiert ortofoto | adresse og takestimat | adresse/koordinat | bare nødvendig oppslag; kilde og lisens lagres | bruksvilkår/lisens godkjent |
| Upstash Redis | vedvarende rate limiting | hashede/tekniske nøkler og IP-bundet begrensning | ingen meldingsinnhold eller kundetoken i klartekst | DPA, region, TTL |
| Cloudflare Turnstile | botbeskyttelse | tekniske forespørselsdata | bare på offentlig innsending | personvern-/DPA-vurdering |
| Google Analytics/Ads og Meta | samtykkebasert måling | tekniske hendelser/annonse-ID | lastes bare etter samtykke; ingen skjema-PII | CMP, samtykke og avtalegrunnlag |
| SMS-leverandør (ikke valgt) | fremtidige varsler | telefon og melding | deaktivert; kanal byttes ikke skjult | leverandør, DPA og maler må godkjennes |

Secrets og leverandørtokens skal bare ligge i hostingens secret store. Dette dokumentet skal oppdateres når en leverandør faktisk velges eller byttes.

