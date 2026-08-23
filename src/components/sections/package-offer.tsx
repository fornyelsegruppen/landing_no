import { ArrowRight, Check, Star } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

type Locale = "no" | "en";

const content = {
  no: {
    eyebrow: "Aktuelle pakkepriser",
    title: "Gi taket nytt liv – uten full utskifting",
    subtitle:
      "Velg mellom Basic, Standard og Premium. Vi hjelper deg å finne behandlingen som passer taket.",
    popular: "Mest valgt",
    stars: "av 5 stjerner",
    from: "fra",
    unit: "kr/m² + mva",
    cta: "Få gratis befaring og tilbud",
    disclaimer:
      "Veiledende fra-priser. Endelig pris avhenger blant annet av takets størrelse, tilstand, helling og adkomst.",
    packages: [
      {
        name: "Basic",
        rating: 3,
        title: "Takvask",
        price: "99",
        features: ["Taksjekk", "Mosebehandling", "Skånsom takvask"],
      },
      {
        name: "Standard",
        rating: 4,
        title: "Vask + impregnering",
        price: "138",
        featured: true,
        features: [
          "Alt i Basic",
          "Beskyttende impregnering",
          "Lengre beskyttelse mot fukt",
        ],
      },
      {
        name: "Premium",
        rating: 5,
        title: "Komplett takfornying",
        price: "337",
        features: [
          "Alt i Standard",
          "Profesjonell takmaling",
          "Valg av passende takfarge",
        ],
      },
    ],
  },
  en: {
    eyebrow: "Current package prices",
    title: "Give your roof new life – without a full replacement",
    subtitle:
      "Choose between Basic, Standard and Premium. We help you find the right treatment for your roof.",
    popular: "Most popular",
    stars: "out of 5 stars",
    from: "from",
    unit: "NOK/m² + VAT",
    cta: "Get a free inspection and quote",
    disclaimer:
      "Indicative starting prices. The final price depends on factors including roof size, condition, pitch and access.",
    packages: [
      {
        name: "Basic",
        rating: 3,
        title: "Roof cleaning",
        price: "99",
        features: ["Roof inspection", "Moss treatment", "Gentle roof cleaning"],
      },
      {
        name: "Standard",
        rating: 4,
        title: "Cleaning + impregnation",
        price: "138",
        featured: true,
        features: [
          "Everything in Basic",
          "Protective impregnation",
          "Longer moisture protection",
        ],
      },
      {
        name: "Premium",
        rating: 5,
        title: "Complete roof renewal",
        price: "337",
        features: [
          "Everything in Standard",
          "Professional roof painting",
          "Choice of suitable roof colour",
        ],
      },
    ],
  },
} satisfies Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    popular: string;
    stars: string;
    from: string;
    unit: string;
    cta: string;
    disclaimer: string;
    packages: Array<{
      name: string;
      rating: number;
      title: string;
      price: string;
      featured?: boolean;
      features: string[];
    }>;
  }
>;

export function PackageOfferSection({ locale }: { locale: Locale }) {
  const copy = content[locale];

  return (
    <section
      id="pakker"
      aria-labelledby="package-offer-title"
      className="border-accent/20 bg-background-elevated relative overflow-hidden border-y px-4 py-14 sm:px-6 sm:py-16 lg:px-8"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(232,163,23,0.16), transparent 48%)",
        }}
      />
      <div className="container-narrow relative">
        <div className="mx-auto max-w-3xl text-center">
          <span className="border-accent/30 bg-accent-soft text-accent inline-flex rounded-full border px-3 py-1.5 text-xs font-bold tracking-[0.18em] uppercase">
            {copy.eyebrow}
          </span>
          <h2
            id="package-offer-title"
            className="text-foreground mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            {copy.title}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:text-base">
            {copy.subtitle}
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {copy.packages.map((item) => (
            <article
              key={item.name}
              className={`relative flex flex-col rounded-2xl border p-5 shadow-xl sm:p-6 ${
                item.featured
                  ? "border-accent/70 ring-accent/20 bg-[#17202b] ring-1 shadow-black/30"
                  : "bg-background/80 border-white/10 shadow-black/10"
              }`}
            >
              {item.featured ? (
                <span className="bg-accent text-accent-foreground absolute -top-3 right-5 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase">
                  {copy.popular}
                </span>
              ) : null}
              <p className="text-accent text-xs font-bold tracking-[0.18em] uppercase">
                {item.name}
              </p>
              <div
                className="mt-2 flex items-center gap-1"
                role="img"
                aria-label={`${item.rating} ${copy.stars}`}
              >
                {Array.from({ length: item.rating }, (_, index) => (
                  <Star
                    key={index}
                    className="text-accent size-4 fill-current"
                    aria-hidden
                  />
                ))}
              </div>
              <h3 className="text-foreground mt-2 text-xl font-bold">
                {item.title}
              </h3>
              <div className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-muted-foreground text-xs">
                  {copy.from}
                </span>
                <span className="text-foreground text-4xl font-bold tracking-tight">
                  {item.price}
                </span>
                <span className="text-muted-foreground text-xs font-semibold">
                  {copy.unit}
                </span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {item.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-foreground/80 flex items-start gap-2.5 text-sm"
                  >
                    <Check
                      className="text-accent mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/#kontakt">
              {copy.cta}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <p className="text-muted-foreground mt-4 max-w-2xl text-center text-xs leading-relaxed">
            {copy.disclaimer}
          </p>
        </div>
      </div>
    </section>
  );
}
