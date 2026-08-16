"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Droplets,
  Home,
  Paintbrush,
  Shield,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { usePageCopy } from "@/components/site-settings-provider";
import type { CmsService } from "@/lib/cms-content";
import { cn } from "@/lib/utils";
import { getSeoServiceHref } from "@/content/seo-landing-pages";

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  check: CheckCircle2,
  shield: Shield,
  droplets: Droplets,
  paint: Paintbrush,
  home: Home,
  wrench: Wrench,
  sparkles: Sparkles,
  // legacy keys from static content
  inspection: CheckCircle2,
  tiles: Wrench,
  wash: Droplets,
  impregnation: Sparkles,
  maintenance: Wrench,
  warranty: Shield,
  newRoof: Home,
  softwash: Droplets,
};

type Props = {
  items: CmsService[];
};

export function ServicesSection({ items }: Props) {
  const copy = usePageCopy();
  const locale = useLocale() as "no" | "en";
  const [expanded, setExpanded] = useState(false);

  const featured = items.filter((item) => item.featured);
  const rest = items.filter((item) => !item.featured);
  const primary = featured.length > 0 ? featured : items.slice(0, 5);
  const secondary = featured.length > 0 ? rest : items.slice(5);
  const visible = expanded ? [...primary, ...secondary] : primary;
  const canExpand = secondary.length > 0;

  return (
    <section id="tjenester" className="section-pad relative">
      <div className="absolute inset-0 bg-[var(--surface-glow)]" aria-hidden />
      <div className="container-narrow relative">
        <Reveal>
          <p className="eyebrow">{copy.services.eyebrow}</p>
          <h2 className="heading-display mt-3 max-w-2xl text-balance">
            {copy.services.title}
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed">
            {copy.services.subtitle}
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item, i) => {
            const Icon = icons[item.icon] || icons[item.key] || CheckCircle2;
            const serviceHref = getSeoServiceHref(item.key);
            return (
              <Reveal key={item.id} delay={Math.min(i * 0.05, 0.25)}>
                <article className="group surface-card hover:border-accent/30 hover:bg-background-elevated h-full p-5 transition-all duration-300 sm:p-6">
                  <div className="bg-accent-soft text-accent mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {item.title[locale]}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {item.description[locale]}
                  </p>
                  {serviceHref ? (
                    <Link
                      href={`/${serviceHref}`}
                      className="text-accent hover:text-accent-hover mt-4 inline-flex text-sm font-semibold"
                    >
                      {locale === "no"
                        ? "Les mer og se pris →"
                        : "Read more and see pricing →"}
                    </Link>
                  ) : null}
                </article>
              </Reveal>
            );
          })}
        </div>

        {canExpand ? (
          <div className="mt-8 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setExpanded((v) => !v)}
              className={cn(expanded && "opacity-90")}
            >
              {expanded ? copy.services.showLess : copy.services.showMore}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
