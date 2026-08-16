import type { Locale } from "@/lib/site";

type Localized = Record<Locale, string>;

export type SeoLandingPage = {
  slug: string;
  serviceKey?: string;
  title: Localized;
  metaTitle: Localized;
  metaDescription: Localized;
  eyebrow: Localized;
  intro: Localized;
  image: string;
  imageAlt: Localized;
  price: Localized;
  priceNote: Localized;
  benefits: Localized[];
  process: Array<{ title: Localized; description: Localized }>;
  faq: Array<{ question: Localized; answer: Localized }>;
};

const l = (no: string, en: string): Localized => ({ no, en });

const inspection = {
  title: l("Gratis befaring", "Free inspection"),
  description: l(
    "Vi vurderer taktype, tilstand, adkomst og riktig behandlingsnivå.",
    "We assess the roof type, condition, access and suitable treatment level.",
  ),
};

const quote = {
  title: l("Tydelig tilbud", "Clear quotation"),
  description: l(
    "Du får skriftlig pris, omfang og forutsetninger før du bestemmer deg.",
    "You receive the price, scope and assumptions in writing before deciding.",
  ),
};

export const seoLandingPages: SeoLandingPage[] = [
  {
    slug: "takvask",
    serviceKey: "wash",
    title: l(
      "Takvask som fjerner mose, alger og smuss",
      "Professional roof cleaning",
    ),
    metaTitle: l(
      "Takvask – pris og gratis befaring | Takfornyelse",
      "Roof cleaning – price and inspection | Takfornyelse",
    ),
    metaDescription: l(
      "Profesjonell takvask tilpasset takstein og tilstand. Se prisdrivere, arbeidsprosess og ekte prosjektbilder. Bestill gratis befaring.",
      "Professional roof cleaning adapted to the tiles and condition. See pricing, process and real project photos. Book a free inspection.",
    ),
    eyebrow: l("Takvask", "Roof cleaning"),
    intro: l(
      "Mose og alger holder på fukt og gjør taket glatt og slitt. Vi vurderer taket først og velger trykk, kjemi og arbeidsmetode som passer materialet.",
      "Moss and algae retain moisture and leave the roof slippery and worn. We inspect first and choose pressure, products and a method suited to the material.",
    ),
    image: "/references/takvask-oslo/after-1.webp",
    imageAlt: l(
      "Enebolig i Oslo etter profesjonell takvask",
      "Oslo home after professional roof cleaning",
    ),
    price: l(
      "Pris fastsettes etter takareal og befaring",
      "Price is set after roof size and inspection",
    ),
    priceNote: l(
      "Taktype, mosemengde, helling, sikring og adkomst påvirker prisen. Du får fast tilbud før oppstart.",
      "Roof type, moss, pitch, safety and access affect the price. You receive a fixed quotation before work starts.",
    ),
    benefits: [
      l(
        "Metode tilpasset takmaterialet",
        "Method adapted to the roof material",
      ),
      l("Mose, alger og smuss fjernes", "Moss, algae and dirt removed"),
      l("Takrenner og arbeidsområde ryddes", "Gutters and work area cleaned"),
      l(
        "Grunnlag for impregnering eller maling",
        "Preparation for impregnation or coating",
      ),
    ],
    process: [
      inspection,
      {
        title: l("Sikring og forarbeid", "Safety and preparation"),
        description: l(
          "Vi beskytter fasade, uteområder og utsatte detaljer før vask.",
          "We protect the façade, outdoor areas and vulnerable details before cleaning.",
        ),
      },
      {
        title: l("Tilpasset vask", "Adapted cleaning"),
        description: l(
          "Mose og belegg fjernes med valgt metode uten unødig belastning på taket.",
          "Moss and growth are removed with the chosen method without unnecessary stress on the roof.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l("Hva koster takvask?", "What does roof cleaning cost?"),
        answer: l(
          "Prisen avhenger av areal, taktype, begroing, helling og adkomst. Vi gir et skriftlig tilbud etter gratis befaring.",
          "Price depends on area, roof type, growth, pitch and access. We provide a written quotation after a free inspection.",
        ),
      },
      {
        question: l(
          "Kan alle tak høytrykksvaskes?",
          "Can every roof be pressure washed?",
        ),
        answer: l(
          "Nei. Trykk og metode må tilpasses materialet og tilstanden. Svake eller skadde flater kan kreve en mer skånsom løsning.",
          "No. Pressure and method must match the material and condition. Weak or damaged surfaces may need a gentler solution.",
        ),
      },
      {
        question: l(
          "Bør taket impregneres etter vask?",
          "Should the roof be impregnated after cleaning?",
        ),
        answer: l(
          "Det kan være riktig for sugende takstein i egnet tilstand. Vi vurderer underlaget før vi anbefaler behandling.",
          "It can be suitable for absorbent tiles in appropriate condition. We assess the substrate before recommending treatment.",
        ),
      },
    ],
  },
  {
    slug: "takvask-og-impregnering",
    serviceKey: "impregnation",
    title: l(
      "Takvask og impregnering i én trygg prosess",
      "Roof cleaning and impregnation",
    ),
    metaTitle: l(
      "Takvask og impregnering – pris og prosess | Takfornyelse",
      "Roof cleaning and impregnation | Takfornyelse",
    ),
    metaDescription: l(
      "Vask og impregnering av egnet takstein. Se hvordan behandlingen utføres, hva som påvirker prisen og bestill gratis befaring.",
      "Cleaning and impregnation of suitable roof tiles. See the process, price factors and book a free inspection.",
    ),
    eyebrow: l("Vask + beskyttelse", "Clean + protect"),
    intro: l(
      "Et rent tak er utgangspunktet for god impregnering. Når taksteinen er egnet, trenger behandlingen inn i overflaten og reduserer fuktopptak uten å skjule takets uttrykk.",
      "A clean roof is the basis for effective impregnation. On suitable tiles, the treatment penetrates the surface and reduces moisture absorption without changing the roof's appearance.",
    ),
    image: "/references/takvask-oslo/after-2.webp",
    imageAlt: l(
      "Ren takstein klar for impregnering",
      "Clean roof tiles ready for impregnation",
    ),
    price: l(
      "Komplett pris etter vurdering av taket",
      "Complete price after roof assessment",
    ),
    priceNote: l(
      "Areal, rengjøringsbehov, tørketid, taktype og adkomst avgjør omfanget.",
      "Area, cleaning needs, drying time, roof type and access determine the scope.",
    ),
    benefits: [
      l(
        "Vask og behandling i riktig rekkefølge",
        "Cleaning and treatment in the correct order",
      ),
      l(
        "Redusert fuktopptak i egnet takstein",
        "Reduced moisture absorption in suitable tiles",
      ),
      l("Diffusjonsåpen behandling", "Vapour-open treatment"),
      l(
        "Tydelig produkt- og arbeidsbeskrivelse",
        "Clear product and work specification",
      ),
    ],
    process: [
      inspection,
      {
        title: l("Grundig takvask", "Thorough roof cleaning"),
        description: l(
          "Belegg fjernes, og taket får tørke før videre behandling.",
          "Growth is removed and the roof is allowed to dry before treatment.",
        ),
      },
      {
        title: l("Impregnering", "Impregnation"),
        description: l(
          "Riktig produkt påføres jevnt under egnede værforhold.",
          "The suitable product is applied evenly in appropriate weather.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l(
          "Må taket vaskes før impregnering?",
          "Must the roof be cleaned first?",
        ),
        answer: l(
          "Ja. Overflaten må være ren, tørr og egnet for at behandlingen skal trekke inn og virke som planlagt.",
          "Yes. The surface must be clean, dry and suitable for the treatment to penetrate and perform as intended.",
        ),
      },
      {
        question: l(
          "Passer impregnering alle tak?",
          "Is impregnation suitable for every roof?",
        ),
        answer: l(
          "Nei. Materiale, tidligere behandling og takets tilstand avgjør. Vi anbefaler ikke impregnering når underlaget ikke er egnet.",
          "No. Material, previous treatment and condition matter. We do not recommend it when the substrate is unsuitable.",
        ),
      },
      {
        question: l(
          "Hvor lenge må taket tørke?",
          "How long must the roof dry?",
        ),
        answer: l(
          "Tørketiden avhenger av vær, temperatur, luftfuktighet og materialet. Dette avklares i arbeidsplanen.",
          "Drying time depends on weather, temperature, humidity and material and is defined in the work plan.",
        ),
      },
    ],
  },
  {
    slug: "takmaling",
    serviceKey: "paint",
    title: l(
      "Takmaling med riktig vask og forarbeid",
      "Roof coating with proper preparation",
    ),
    metaTitle: l(
      "Takmaling – pris på maling av takstein | Takfornyelse",
      "Roof coating – price and process | Takfornyelse",
    ),
    metaDescription: l(
      "Maling av takstein med grundig vask, egnethetsvurdering og profesjonell påføring. Se ekte før- og etterbilder og få gratis befaring.",
      "Roof tile coating with cleaning, suitability assessment and professional application. See real results and book a free inspection.",
    ),
    eyebrow: l("Maling av takstein", "Roof tile coating"),
    intro: l(
      "Takmaling kan gi falmet betongtakstein ny beskyttelse og et jevnt uttrykk når selve taket er teknisk egnet. Resultatet avgjøres av tilstand, rengjøring, heft og værforhold.",
      "Roof coating can give faded concrete tiles renewed protection and an even finish when the roof is technically suitable. Condition, cleaning, adhesion and weather determine the result.",
    ),
    image: "/references/takmaling-viken/after-1.webp",
    imageAlt: l(
      "Ferdig malt sort tak på enebolig i Viken",
      "Finished black coated roof on a Viken home",
    ),
    price: l(
      "Veiledende vurdering etter areal – fast tilbud etter befaring",
      "Indicative assessment by area – fixed quotation after inspection",
    ),
    priceNote: l(
      "Vask, reparasjoner, grunning, antall strøk, sikring og adkomst påvirker totalprisen.",
      "Cleaning, repairs, primer, number of coats, safety and access affect the total price.",
    ),
    benefits: [
      l(
        "Ekte prosjekt: 240 m² tak i Viken",
        "Real project: 240 m² roof in Viken",
      ),
      l(
        "Farge og produkt tilpasset underlaget",
        "Colour and product matched to the substrate",
      ),
      l("Jevn profesjonell påføring", "Even professional application"),
      l("Sluttkontroll og dokumentasjon", "Final inspection and documentation"),
    ],
    process: [
      inspection,
      {
        title: l("Vask og reparasjoner", "Cleaning and repairs"),
        description: l(
          "Taket rengjøres, skadet stein håndteres og overflaten klargjøres.",
          "The roof is cleaned, damaged tiles are addressed and the surface is prepared.",
        ),
      },
      {
        title: l("Grunning og maling", "Primer and coating"),
        description: l(
          "Valgt system påføres jevnt med nødvendig tørketid mellom behandlingene.",
          "The selected system is applied evenly with the required drying time.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l("Hva koster takmaling?", "What does roof coating cost?"),
        answer: l(
          "Prisen avhenger av areal, takets tilstand, nødvendig forarbeid, produktsystem og adkomst. Du får fast pris etter befaring.",
          "Price depends on area, condition, preparation, coating system and access. You receive a fixed price after inspection.",
        ),
      },
      {
        question: l(
          "Kan gammel takstein males?",
          "Can old roof tiles be coated?",
        ),
        answer: l(
          "Ofte, men ikke alltid. Taksteinen må ha tilstrekkelig styrke og egnet overflate. Vi vurderer dette før vi anbefaler maling.",
          "Often, but not always. Tiles must have sufficient strength and a suitable surface. We assess this before recommending coating.",
        ),
      },
      {
        question: l(
          "Hvilke farger kan jeg velge?",
          "Which colours can I choose?",
        ),
        answer: l(
          "Fargeutvalget avhenger av valgt produktsystem. Vi viser aktuelle alternativer i forbindelse med tilbudet.",
          "Colour options depend on the selected product system. We present suitable choices with the quotation.",
        ),
      },
    ],
  },
  {
    slug: "takfornying",
    serviceKey: "inspection",
    title: l(
      "Komplett takfornying uten unødvendig takbytte",
      "Complete roof renewal",
    ),
    metaTitle: l(
      "Takfornying – vask, impregnering og maling | Takfornyelse",
      "Roof renewal – cleaning, treatment and coating | Takfornyelse",
    ),
    metaDescription: l(
      "Komplett takfornying med tilstandsvurdering, vask, behandling og maling når taket er egnet. Se prosess, prisdrivere og referanser.",
      "Complete roof renewal with inspection, cleaning, treatment and coating when suitable. See process, pricing and references.",
    ),
    eyebrow: l("Komplett takfornying", "Complete renewal"),
    intro: l(
      "Takfornying er en samlet prosess for tak som fortsatt har et godt teknisk grunnlag. Vi undersøker først om vedlikehold er riktig – og anbefaler nytt tak dersom skadene er for omfattende.",
      "Roof renewal is a complete process for roofs with a sound technical basis. We first determine whether maintenance is appropriate and recommend replacement if damage is too extensive.",
    ),
    image: "/references/borettslag/after-2.webp",
    imageAlt: l(
      "Luftfoto av ferdig takfornyet borettslag",
      "Aerial view of a renewed housing association",
    ),
    price: l("Typisk 600–1 200 kr per m²", "Typically NOK 600–1,200 per m²"),
    priceNote: l(
      "Veiledende intervall. Valgt behandling, tilstand, størrelse, sikring og adkomst avgjør endelig pris.",
      "Indicative range. Treatment, condition, size, safety and access determine the final price.",
    ),
    benefits: [
      l("Vurdering før tiltak velges", "Assessment before choosing treatment"),
      l(
        "Vask, behandling og maling i én plan",
        "Cleaning, treatment and coating in one plan",
      ),
      l(
        "Kan koste betydelig mindre enn nytt tak",
        "Can cost significantly less than replacement",
      ),
      l(
        "Opptil 10 års garanti etter avtalte vilkår",
        "Up to 10-year warranty under agreed terms",
      ),
    ],
    process: [
      inspection,
      {
        title: l("Plan og klargjøring", "Plan and preparation"),
        description: l(
          "Vi avklarer reparasjoner, vask, produktsystem, farge og fremdrift.",
          "We define repairs, cleaning, product system, colour and schedule.",
        ),
      },
      {
        title: l("Komplett behandling", "Complete treatment"),
        description: l(
          "Arbeidet utføres trinnvis med nødvendige kontroller og tørketider.",
          "Work is completed in stages with required checks and drying times.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l(
          "Hva inngår i takfornying?",
          "What is included in roof renewal?",
        ),
        answer: l(
          "Vanligvis tilstandsvurdering, nødvendige mindre reparasjoner, vask og valgt overflatebehandling. Nøyaktig omfang står i tilbudet.",
          "Usually condition assessment, necessary minor repairs, cleaning and the selected surface treatment. The exact scope is stated in the quotation.",
        ),
      },
      {
        question: l(
          "Er takfornying det samme som nytt tak?",
          "Is renewal the same as a new roof?",
        ),
        answer: l(
          "Nei. Takfornying vedlikeholder et eksisterende tak som er egnet. Nytt tak innebærer utskifting av tekkingen og eventuelt flere lag i konstruksjonen.",
          "No. Renewal maintains a suitable existing roof. Replacement involves new roofing and potentially more layers of the construction.",
        ),
      },
      {
        question: l(
          "Hvor lang tid tar arbeidet?",
          "How long does the work take?",
        ),
        answer: l(
          "Mange boligtak kan behandles på noen arbeidsdager, men vær, areal og tørketid påvirker planen.",
          "Many residential roofs can be treated in a few working days, but weather, area and drying time affect the schedule.",
        ),
      },
    ],
  },
  {
    slug: "nytt-tak",
    serviceKey: "newRoof",
    title: l(
      "Nytt tak når fornying ikke er riktig løsning",
      "A new roof when renewal is not suitable",
    ),
    metaTitle: l(
      "Nytt tak – pris, befaring og komplett tilbud | Takfornyelse",
      "New roof – price, inspection and quotation | Takfornyelse",
    ),
    metaDescription: l(
      "Trenger boligen nytt tak? Vi vurderer tekking, undertak, lufting og beslag og gir et komplett skriftlig tilbud etter gratis befaring.",
      "Does your home need a new roof? We assess roofing, underlay, ventilation and flashings and provide a complete written quotation.",
    ),
    eyebrow: l("Takbytte", "Roof replacement"),
    intro: l(
      "Når takstein, undertak eller konstruksjon har omfattende skader, kan komplett takbytte være tryggere og mer økonomisk enn overflatebehandling. Vi vurderer hele takoppbygningen.",
      "When tiles, underlay or construction have extensive damage, full replacement may be safer and more economical than surface treatment. We assess the whole roof build-up.",
    ),
    image: "/references/borettslag/during-1.webp",
    imageAlt: l(
      "Kontroll av takflate under takarbeid",
      "Roof surface inspection during roofing work",
    ),
    price: l(
      "Pris beregnes etter takoppbygning og materialvalg",
      "Price is calculated from construction and material choices",
    ),
    priceNote: l(
      "Areal, riving, undertak, lufting, beslag, taktekking, stillas og avfall påvirker tilbudet.",
      "Area, removal, underlay, ventilation, flashings, roofing, scaffolding and waste affect the quotation.",
    ),
    benefits: [
      l(
        "Vurdering av hele takoppbygningen",
        "Assessment of the entire roof build-up",
      ),
      l(
        "Valg mellom takstein, plater, papp og shingel",
        "Choice of tiles, metal, membrane and shingles",
      ),
      l("Spesifisert skriftlig tilbud", "Itemised written quotation"),
      l("Dokumentert sluttkontroll", "Documented final inspection"),
    ],
    process: [
      inspection,
      {
        title: l("Løsningsvalg", "Solution selection"),
        description: l(
          "Materialer, detaljer, fremdrift og rigg beskrives i tilbudet.",
          "Materials, details, schedule and site setup are described in the quotation.",
        ),
      },
      {
        title: l("Riving og nytt tak", "Removal and new roof"),
        description: l(
          "Eksisterende tekking håndteres og nytt system monteres etter avtalt omfang.",
          "Existing roofing is handled and the new system installed to the agreed scope.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l("Hva koster et nytt tak?", "What does a new roof cost?"),
        answer: l(
          "Det varierer betydelig med areal, oppbygning, skader, materialvalg og adkomst. Derfor gir vi pris etter befaring og spesifisering.",
          "It varies significantly with area, build-up, damage, materials and access. We therefore price after inspection and specification.",
        ),
      },
      {
        question: l(
          "Hvordan vet jeg om taket må byttes?",
          "How do I know if the roof needs replacement?",
        ),
        answer: l(
          "Lekkasjer, svikt i undertak, omfattende skader eller dårlig konstruksjon kan tale for utskifting. En befaring avklarer riktig nivå.",
          "Leaks, failed underlay, extensive damage or poor construction may point to replacement. An inspection clarifies the right level.",
        ),
      },
      {
        question: l(
          "Kan dere hjelpe med materialvalg?",
          "Can you help choose materials?",
        ),
        answer: l(
          "Ja. Vi vurderer husets uttrykk, takfall, vekt, lokale værforhold og budsjett før vi anbefaler løsning.",
          "Yes. We consider the home's appearance, pitch, weight, local weather and budget before recommending a solution.",
        ),
      },
    ],
  },
  {
    slug: "priser",
    title: l(
      "Priser på takvask, takmaling og takfornying",
      "Roof cleaning, coating and renewal prices",
    ),
    metaTitle: l(
      "Priser – takvask, takmaling og takfornying | Takfornyelse",
      "Prices – roof cleaning, coating and renewal | Takfornyelse",
    ),
    metaDescription: l(
      "Se hva som påvirker pris på takvask, impregnering, takmaling, takfornying og nytt tak. Få et skriftlig tilbud etter gratis befaring.",
      "See what affects the price of cleaning, impregnation, coating, renewal and replacement. Get a written quotation after a free inspection.",
    ),
    eyebrow: l("Priser", "Prices"),
    intro: l(
      "To like store tak kan kreve ulik behandling. Derfor viser vi prisdrivere og veiledende nivåer, mens den endelige prisen settes etter at vi har vurdert taket og avklart omfanget.",
      "Two roofs of the same size can require different treatment. We therefore explain price factors and indicative levels, while the final price follows an assessment and agreed scope.",
    ),
    image: "/references/takmaling-viken/during-1.webp",
    imageAlt: l(
      "Takmaling under arbeid med tydelig før- og etterkontrast",
      "Roof coating in progress with a clear before-and-after contrast",
    ),
    price: l(
      "Takfornying: typisk 600–1 200 kr per m²",
      "Roof renewal: typically NOK 600–1,200 per m²",
    ),
    priceNote: l(
      "Dette er et veiledende intervall, ikke et bindende tilbud. Takvask, impregnering og nytt tak prises etter valgt omfang.",
      "This is an indicative range, not a binding quotation. Cleaning, impregnation and replacement are priced according to scope.",
    ),
    benefits: [
      l("Takareal og taktype", "Roof area and type"),
      l("Tilstand og nødvendig forarbeid", "Condition and preparation needed"),
      l("Helling, sikring og adkomst", "Pitch, safety and access"),
      l(
        "Produktvalg og antall behandlinger",
        "Product choice and number of treatments",
      ),
    ],
    process: [
      inspection,
      {
        title: l("Omfang og alternativer", "Scope and options"),
        description: l(
          "Vi forklarer hva som er nødvendig, hva som er valgfritt og hvilke alternativer som finnes.",
          "We explain what is necessary, optional and which alternatives are available.",
        ),
      },
      quote,
      {
        title: l("Ingen skjulte tillegg", "No hidden extras"),
        description: l(
          "Endringer eller ekstraarbeid avklares før de utføres.",
          "Changes or extra work are agreed before they are carried out.",
        ),
      },
    ],
    faq: [
      {
        question: l(
          "Kan jeg få pris uten befaring?",
          "Can I get a price without an inspection?",
        ),
        answer: l(
          "Bilder, adresse og takareal kan gi en første indikasjon. Bindende omfang og pris krever normalt at forholdene er tilstrekkelig avklart.",
          "Photos, address and roof area can provide an initial indication. A binding scope and price normally require the conditions to be sufficiently clarified.",
        ),
      },
      {
        question: l(
          "Hvorfor varierer pris per m²?",
          "Why does the price per m² vary?",
        ),
        answer: l(
          "Små og kompliserte tak, mye begroing, bratt helling, krevende sikring og reparasjoner øker tids- og materialbehovet.",
          "Small or complex roofs, heavy growth, steep pitch, difficult safety setup and repairs increase labour and material needs.",
        ),
      },
      {
        question: l("Er befaringen gratis?", "Is the inspection free?"),
        answer: l(
          "Ja, den innledende befaringen og tilbudet er gratis og uforpliktende innenfor vårt dekningsområde.",
          "Yes, the initial inspection and quotation are free and without obligation within our service area.",
        ),
      },
    ],
  },
  {
    slug: "takvask-oslo",
    title: l("Takvask i Oslo tilpasset byens boliger", "Roof cleaning in Oslo"),
    metaTitle: l(
      "Takvask Oslo – pris og gratis befaring | Takfornyelse",
      "Roof cleaning Oslo – price and inspection | Takfornyelse",
    ),
    metaDescription: l(
      "Bestill profesjonell takvask i Oslo. Vi vurderer mose, trær, taktype, adkomst og sikring og gir et skriftlig tilbud etter gratis befaring.",
      "Book professional roof cleaning in Oslo. We assess moss, trees, roof type, access and safety and provide a written quotation.",
    ),
    eyebrow: l("Takvask i Oslo", "Roof cleaning in Oslo"),
    intro: l(
      "Tak i Oslo påvirkes ulikt av skygge, trær, trafikkstøv og tett bebyggelse. I områder med krevende adkomst må også sikring, naboer og beskyttelse av utearealer planlegges før vask.",
      "Oslo roofs are affected differently by shade, trees, traffic dust and dense housing. Where access is difficult, safety, neighbours and protection of outdoor areas must be planned before cleaning.",
    ),
    image: "/references/takvask-oslo/after-1.webp",
    imageAlt: l(
      "Dokumentert enebolig i Oslo etter takvask",
      "Documented Oslo home after roof cleaning",
    ),
    price: l(
      "Lokal pris etter takareal, adkomst og tilstand",
      "Local price based on area, access and condition",
    ),
    priceNote: l(
      "Stillas eller lift, parkering, bratt tak, mye vegetasjon og mengden mose kan påvirke omfanget i Oslo.",
      "Scaffolding or lift, parking, steep roofs, vegetation and moss can affect the scope in Oslo.",
    ),
    benefits: [
      l(
        "Dokumentert takvaskprosjekt i Oslo",
        "Documented roof cleaning project in Oslo",
      ),
      l(
        "Plan for tett bebyggelse og uteområder",
        "Plan for dense housing and outdoor areas",
      ),
      l(
        "Vurdering av mose, skygge og trær",
        "Assessment of moss, shade and trees",
      ),
      l("Gratis og uforpliktende befaring", "Free, no-obligation inspection"),
    ],
    process: [
      inspection,
      {
        title: l("Lokal arbeidsplan", "Local work plan"),
        description: l(
          "Vi avklarer adkomst, parkering, sikring og hensyn til naboer og uteområder.",
          "We clarify access, parking, safety and consideration for neighbours and outdoor areas.",
        ),
      },
      {
        title: l("Takvask", "Roof cleaning"),
        description: l(
          "Metoden tilpasses takstein, begroing og forholdene rundt boligen.",
          "The method is adapted to the tiles, growth and conditions around the home.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l(
          "Hva koster takvask i Oslo?",
          "What does roof cleaning cost in Oslo?",
        ),
        answer: l(
          "Areal, taktype, begroing, adkomst og nødvendig sikring avgjør prisen. Vi gir fast tilbud etter befaring.",
          "Area, roof type, growth, access and safety determine the price. We provide a fixed quotation after inspection.",
        ),
      },
      {
        question: l(
          "Hvilke deler av Oslo betjener dere?",
          "Which parts of Oslo do you serve?",
        ),
        answer: l(
          "Vi vurderer oppdrag i hele Oslo. Send postnummer og bilder, så bekrefter vi kapasitet og riktig neste steg.",
          "We assess work throughout Oslo. Send the postcode and photos and we will confirm capacity and the right next step.",
        ),
      },
      {
        question: l(
          "Kan dere vaske tak i tett bebyggelse?",
          "Can you clean roofs in dense housing?",
        ),
        answer: l(
          "Ja, når adkomst og sikring kan løses forsvarlig. Vi planlegger beskyttelse av fasade, biler, naboarealer og ferdsel.",
          "Yes, when access and safety can be handled properly. We plan protection of façades, cars, neighbouring areas and pedestrians.",
        ),
      },
    ],
  },
  {
    slug: "takfornying-baerum",
    title: l(
      "Takfornying i Bærum med vurdering før behandling",
      "Roof renewal in Bærum",
    ),
    metaTitle: l(
      "Takfornying Bærum – befaring og pris | Takfornyelse",
      "Roof renewal Bærum – inspection and price | Takfornyelse",
    ),
    metaDescription: l(
      "Takfornying i Bærum med vask, behandling og maling når taket er egnet. Få vurdert tilstand, pris og alternativer ved gratis befaring.",
      "Roof renewal in Bærum with cleaning, treatment and coating when suitable. Get condition, price and options assessed.",
    ),
    eyebrow: l("Takfornying i Bærum", "Roof renewal in Bærum"),
    intro: l(
      "Bærum har både eldre eneboliger, nyere boligfelt og hus nær skog og fjord. Skygge, vegetasjon, værside og takets alder påvirker om vask og overflatebehandling er riktig, eller om større tiltak bør vurderes.",
      "Bærum has older detached homes, newer developments and houses near woods and the fjord. Shade, vegetation, exposure and roof age affect whether cleaning and treatment are suitable or larger measures are needed.",
    ),
    image: "/references/borettslag/after-1.webp",
    imageAlt: l(
      "Ferdig fornyede tak på boliger",
      "Completed renewed roofs on homes",
    ),
    price: l(
      "Pris etter tilstand, areal og valgt behandling",
      "Price based on condition, area and treatment",
    ),
    priceNote: l(
      "Vi skiller mellom nødvendig vedlikehold, ønsket visuelt løft og forhold som krever reparasjon eller takbytte.",
      "We distinguish necessary maintenance, the desired visual result and conditions requiring repair or replacement.",
    ),
    benefits: [
      l(
        "Vurdering av takstein og kritiske detaljer",
        "Assessment of tiles and critical details",
      ),
      l(
        "Plan tilpasset bolig og omgivelser",
        "Plan adapted to the home and surroundings",
      ),
      l(
        "Alternativ mellom vedlikehold og takbytte",
        "Choice between maintenance and replacement",
      ),
      l(
        "Skriftlig tilbud før oppstart",
        "Written quotation before work starts",
      ),
    ],
    process: [
      inspection,
      {
        title: l("Riktig tiltaksnivå", "Right level of work"),
        description: l(
          "Vi avklarer hva som kan fornyes, hva som må repareres og eventuelle alternativer.",
          "We clarify what can be renewed, what must be repaired and possible alternatives.",
        ),
      },
      {
        title: l("Planlagt utførelse", "Planned delivery"),
        description: l(
          "Vask, behandling og maling utføres i avtalt rekkefølge og under egnede forhold.",
          "Cleaning, treatment and coating are carried out in the agreed order and suitable conditions.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l(
          "Hva koster takfornying i Bærum?",
          "What does roof renewal cost in Bærum?",
        ),
        answer: l(
          "Komplett takfornying ligger ofte i et veiledende intervall på 600–1 200 kr per m², men befaring avgjør riktig behandling og endelig pris.",
          "Complete renewal is often in an indicative range of NOK 600–1,200 per m², but inspection determines the treatment and final price.",
        ),
      },
      {
        question: l(
          "Kan alle eldre tak fornyes?",
          "Can every older roof be renewed?",
        ),
        answer: l(
          "Nei. Undertak, takstein og detaljer må være i forsvarlig stand. Ved omfattende svikt anbefaler vi reparasjon eller takbytte.",
          "No. Underlay, tiles and details must be sound. With extensive failure we recommend repair or replacement.",
        ),
      },
      {
        question: l(
          "Tilbyr dere gratis befaring i Bærum?",
          "Do you offer free inspections in Bærum?",
        ),
        answer: l(
          "Ja, innenfor tilgjengelig kapasitet. Send adresse og gjerne bilder, så avtaler vi neste steg.",
          "Yes, subject to available capacity. Send the address and photos and we will arrange the next step.",
        ),
      },
    ],
  },
  {
    slug: "takmaling-drammen",
    title: l(
      "Takmaling i Drammen med grundig forarbeid",
      "Roof coating in Drammen",
    ),
    metaTitle: l(
      "Takmaling Drammen – pris og gratis vurdering | Takfornyelse",
      "Roof coating Drammen – price and assessment | Takfornyelse",
    ),
    metaDescription: l(
      "Profesjonell takmaling i Drammen. Vi vurderer takstein, vask, heft og værforhold og gir et tydelig tilbud på komplett behandling.",
      "Professional roof coating in Drammen. We assess tiles, cleaning, adhesion and weather and provide a clear quotation.",
    ),
    eyebrow: l("Takmaling i Drammen", "Roof coating in Drammen"),
    intro: l(
      "Boliger i Drammensområdet kan ha stor variasjon i sol, skygge og fukt mellom dalsider og åpne områder. Før maling undersøker vi derfor begroing, slitasje, taksteinens styrke og om overflaten gir riktig heft.",
      "Homes around Drammen can vary greatly in sun, shade and moisture between valley sides and open areas. Before coating we assess growth, wear, tile strength and surface adhesion.",
    ),
    image: "/references/takmaling-viken/after-2.webp",
    imageAlt: l(
      "Dokumentert malt tak i Viken etter ferdig behandling",
      "Documented coated roof in Viken after treatment",
    ),
    price: l(
      "Fast pris etter vurdering av forarbeid og areal",
      "Fixed price after assessing preparation and area",
    ),
    priceNote: l(
      "Mengden mose, reparasjoner, grunning, antall strøk, takvinkel og sikring påvirker prisen.",
      "Moss, repairs, primer, coats, pitch and safety affect the price.",
    ),
    benefits: [
      l(
        "Relevant dokumentert prosjekt fra Viken",
        "Relevant documented project from Viken",
      ),
      l(
        "Vurdering av sol-, skygge- og fuktforhold",
        "Assessment of sun, shade and moisture",
      ),
      l(
        "Forarbeid og produkt tilpasset taksteinen",
        "Preparation and product adapted to the tiles",
      ),
      l(
        "Fargevalg avklart i tilbudet",
        "Colour choice agreed in the quotation",
      ),
    ],
    process: [
      inspection,
      {
        title: l("Vask og heftkontroll", "Cleaning and adhesion check"),
        description: l(
          "Taket rengjøres og underlaget kontrolleres før produktsystem velges.",
          "The roof is cleaned and the substrate checked before selecting the coating system.",
        ),
      },
      {
        title: l("Maling", "Coating"),
        description: l(
          "Behandlingen påføres jevnt med riktig temperatur og tørketid.",
          "The treatment is applied evenly with the right temperature and drying time.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l(
          "Hva koster takmaling i Drammen?",
          "What does roof coating cost in Drammen?",
        ),
        answer: l(
          "Areal og nødvendig forarbeid er de viktigste faktorene. Vi vurderer taket og gir et komplett tilbud før oppstart.",
          "Area and preparation are the main factors. We assess the roof and provide a complete quotation before work starts.",
        ),
      },
      {
        question: l(
          "Når på året kan taket males?",
          "When can the roof be coated?",
        ),
        answer: l(
          "Arbeidet krever egnede temperaturer, tørt underlag og et tilstrekkelig værvindu. Planen tilpasses sesong og produktkrav.",
          "The work requires suitable temperatures, a dry substrate and a sufficient weather window. Scheduling follows the season and product requirements.",
        ),
      },
      {
        question: l(
          "Må taket vaskes først?",
          "Must the roof be cleaned first?",
        ),
        answer: l(
          "Ja. God rengjøring og korrekt forarbeid er avgjørende for heft og et jevnt resultat.",
          "Yes. Proper cleaning and preparation are essential for adhesion and an even result.",
        ),
      },
    ],
  },
  {
    slug: "takvask-og-impregnering-lillestrom",
    title: l(
      "Takvask og impregnering i Lillestrøm",
      "Roof cleaning and impregnation in Lillestrøm",
    ),
    metaTitle: l(
      "Takvask og impregnering Lillestrøm | Takfornyelse",
      "Roof cleaning and impregnation Lillestrøm | Takfornyelse",
    ),
    metaDescription: l(
      "Takvask og impregnering i Lillestrøm og nærområdet. Vi vurderer taktype, mose, fukt og adkomst før vi anbefaler behandling.",
      "Roof cleaning and impregnation in Lillestrøm and nearby. We assess roof type, moss, moisture and access before recommending treatment.",
    ),
    eyebrow: l("Takbehandling i Lillestrøm", "Roof treatment in Lillestrøm"),
    intro: l(
      "Flate områder, fuktige perioder og vegetasjon rundt boligen kan gi gode vekstvilkår for mose og alger i Lillestrøm. Vi undersøker om taksteinen er egnet for vask og impregnering og planlegger behandlingen etter vær og tørketid.",
      "Flat terrain, damp periods and vegetation can create favourable conditions for moss and algae in Lillestrøm. We assess whether tiles suit cleaning and impregnation and plan around weather and drying time.",
    ),
    image: "/references/takvask-oslo/after-2.webp",
    imageAlt: l(
      "Ren takstein etter vask og før beskyttende behandling",
      "Clean roof tiles after washing and before protective treatment",
    ),
    price: l(
      "Pris etter areal, begroing og behandling",
      "Price based on area, growth and treatment",
    ),
    priceNote: l(
      "Vi gir separat og tydelig omfang for vask og impregnering, slik at du vet hva tilbudet inkluderer.",
      "We provide a clear separate scope for cleaning and impregnation so you know what is included.",
    ),
    benefits: [
      l(
        "Vurdering av lokale fukt- og vekstforhold",
        "Assessment of local moisture and growth",
      ),
      l("Rengjøring før behandling", "Cleaning before treatment"),
      l(
        "Impregnering bare på egnet underlag",
        "Impregnation only on suitable substrates",
      ),
      l("Befaring og skriftlig tilbud", "Inspection and written quotation"),
    ],
    process: [
      inspection,
      {
        title: l("Vask og tørk", "Clean and dry"),
        description: l(
          "Mose og smuss fjernes, og taket får nødvendig tørketid.",
          "Moss and dirt are removed and the roof receives the required drying time.",
        ),
      },
      {
        title: l("Beskyttende behandling", "Protective treatment"),
        description: l(
          "Impregnering påføres jevnt når underlag og vær er egnet.",
          "Impregnation is applied evenly when substrate and weather are suitable.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l(
          "Hva koster takvask og impregnering i Lillestrøm?",
          "What does cleaning and impregnation cost in Lillestrøm?",
        ),
        answer: l(
          "Takareal, begroing, materiale, adkomst og sikring påvirker prisen. Du får skriftlig tilbud etter vurdering.",
          "Roof area, growth, material, access and safety affect the price. You receive a written quotation after assessment.",
        ),
      },
      {
        question: l(
          "Hvor raskt kan impregnering utføres etter vask?",
          "How soon can impregnation follow cleaning?",
        ),
        answer: l(
          "Taket må være tilstrekkelig tørt. Vær, temperatur og takstein avgjør om behandling kan skje samme arbeidsperiode eller senere.",
          "The roof must be sufficiently dry. Weather, temperature and tiles determine whether treatment can follow in the same work period or later.",
        ),
      },
      {
        question: l(
          "Dekker dere hele Lillestrøm kommune?",
          "Do you cover all of Lillestrøm municipality?",
        ),
        answer: l(
          "Vi vurderer oppdrag i Lillestrøm og nærområdene etter kapasitet. Send postnummer og bilder for rask avklaring.",
          "We assess work in Lillestrøm and nearby according to capacity. Send the postcode and photos for quick clarification.",
        ),
      },
    ],
  },
  {
    slug: "takfornying-viken",
    title: l(
      "Takfornying i Viken dokumentert med ekte prosjekter",
      "Roof renewal in Viken with documented projects",
    ),
    metaTitle: l(
      "Takfornying Viken – referanser, pris og befaring | Takfornyelse",
      "Roof renewal Viken – references, price and inspection | Takfornyelse",
    ),
    metaDescription: l(
      "Takfornying i Viken med dokumenterte før- og etterbilder. Vi vurderer vask, impregnering, takmaling eller nytt tak og gir tilbud.",
      "Roof renewal in Viken with documented before-and-after photos. We assess cleaning, impregnation, coating or replacement.",
    ),
    eyebrow: l("Takfornying i Viken", "Roof renewal in Viken"),
    intro: l(
      "Viken dekker kyst, dalfører, byområder og skogsnære boliger med svært ulike vær- og fuktforhold. Vi bruker befaringen til å velge riktig nivå og viser dokumenterte resultater fra et 240 m² takmalingsprosjekt i regionen.",
      "Viken spans coast, valleys, urban areas and homes near woodland with varied weather and moisture. We use the inspection to select the right level and show documented results from a 240 m² coating project in the region.",
    ),
    image: "/references/takmaling-viken/before-1.webp",
    imageAlt: l(
      "Dokumentert 240 m² tak i Viken før takfornying",
      "Documented 240 m² roof in Viken before renewal",
    ),
    price: l(
      "Takfornying typisk 600–1 200 kr per m²",
      "Roof renewal typically NOK 600–1,200 per m²",
    ),
    priceNote: l(
      "Intervaller er veiledende. Befaring avklarer behandling, reparasjoner, sikring, logistikk og endelig tilbud.",
      "Ranges are indicative. Inspection clarifies treatment, repairs, safety, logistics and the final quotation.",
    ),
    benefits: [
      l(
        "Dokumentert 240 m² prosjekt i Viken",
        "Documented 240 m² project in Viken",
      ),
      l(
        "Tiltak tilpasset lokale værforhold",
        "Treatment adapted to local weather",
      ),
      l(
        "Valg mellom vedlikehold og nytt tak",
        "Choice between maintenance and replacement",
      ),
      l(
        "Team og kapasitet bekreftes før avtale",
        "Team and capacity confirmed before agreement",
      ),
    ],
    process: [
      inspection,
      {
        title: l("Regional planlegging", "Regional planning"),
        description: l(
          "Vi avklarer logistikk, værvindu, sikring og riktig produkt for stedet.",
          "We clarify logistics, weather window, safety and the suitable product for the location.",
        ),
      },
      {
        title: l("Takfornying", "Roof renewal"),
        description: l(
          "Avtalte reparasjoner, vask og behandling gjennomføres med trinnvis kontroll.",
          "Agreed repairs, cleaning and treatment are completed with staged checks.",
        ),
      },
      quote,
    ],
    faq: [
      {
        question: l(
          "Hvilke områder i Viken dekker dere?",
          "Which parts of Viken do you cover?",
        ),
        answer: l(
          "Vi vurderer oppdrag i blant annet Oslo-regionen, Bærum, Drammen, Lillestrøm og øvrige deler av regionen etter kapasitet.",
          "We assess work in the Oslo region, Bærum, Drammen, Lillestrøm and other parts of the region according to capacity.",
        ),
      },
      {
        question: l(
          "Har dere utført takarbeid i Viken?",
          "Have you completed roofing work in Viken?",
        ),
        answer: l(
          "Ja. På nettstedet viser vi et dokumentert prosjekt med før-, underveis- og etterbilder fra takmaling av et 240 m² tak i Viken.",
          "Yes. The site shows a documented project with before, during and after photos from coating a 240 m² roof in Viken.",
        ),
      },
      {
        question: l("Hvordan får jeg pristilbud?", "How do I get a quotation?"),
        answer: l(
          "Send adresse, telefonnummer og gjerne bilder og takareal. Vi gjør en første vurdering og avtaler befaring ved behov.",
          "Send the address, phone number and preferably photos and roof area. We make an initial assessment and arrange an inspection if needed.",
        ),
      },
    ],
  },
];

export const seoLandingSlugs = seoLandingPages.map((page) => page.slug);

export function getSeoLandingPage(slug: string): SeoLandingPage | undefined {
  return seoLandingPages.find((page) => page.slug === slug);
}

export function getSeoServiceHref(serviceKey: string): string | undefined {
  return seoLandingPages.find((page) => page.serviceKey === serviceKey)?.slug;
}
