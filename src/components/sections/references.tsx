"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { Reveal } from "@/components/ui/reveal";
import { usePageCopy } from "@/components/site-settings-provider";
import type { CmsProject } from "@/lib/cms-content";
import { optimizeRemoteImageUrl } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

type Props = {
  projects: CmsProject[];
};

type Stage = CmsProject["stages"][number];

type LightboxState = {
  title: string;
  stages: Stage[];
  index: number;
};

function arrangeStages(stages: Stage[]) {
  const before = stages.filter((stage) => stage.label === "before");
  const after = stages.filter((stage) => stage.label === "after");
  const during = stages.filter((stage) => stage.label === "during");
  const pairCount = Math.min(before.length, after.length);
  const pairs = Array.from({ length: pairCount }, (_, index) => ({
    before: before[index],
    after: after[index],
  }));
  const remaining = [
    ...before.slice(pairCount),
    ...during,
    ...after.slice(pairCount),
  ];

  return {
    pairs,
    remaining,
    ordered: [
      ...pairs.flatMap((pair) => [pair.before, pair.after]),
      ...remaining,
    ],
  };
}

export function ReferencesSection({ projects }: Props) {
  const copy = usePageCopy();
  const locale = useLocale() as "no" | "en";
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const openStage = (project: CmsProject, stage: Stage) => {
    const orderedStages = arrangeStages(project.stages).ordered;
    const index = orderedStages.indexOf(stage);
    setLightbox({
      title: project.title[locale],
      stages: orderedStages,
      index: index >= 0 ? index : 0,
    });
  };

  return (
    <section
      id="referanser"
      className="section-pad bg-background-elevated border-y border-white/[0.06]"
    >
      <div className="container-narrow">
        <Reveal>
          <div className="max-w-2xl">
            <p className="eyebrow">{copy.references.eyebrow}</p>
            <h2 className="heading-display mt-3 text-balance">
              {copy.references.title}
            </h2>
            <p className="text-muted-foreground mt-4">
              {copy.references.subtitle}
            </p>
            {copy.references.note ? (
              <p className="text-muted-foreground/80 mt-2 text-xs">
                {copy.references.note}
              </p>
            ) : null}
            <Button asChild size="lg" className="mt-6">
              <Link href="/#kontakt">
                {locale === "no"
                  ? "Få gratis taksjekk og pristilbud"
                  : "Get a free roof inspection and quote"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </Reveal>

        <div className="mt-10 space-y-8">
          {projects.map((project, projectIndex) => {
            const { pairs, remaining } = arrangeStages(project.stages);

            return (
              <Reveal
                key={project.id}
                delay={Math.min(projectIndex * 0.05, 0.2)}
              >
                <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                    <p className="text-accent text-[10px] font-bold tracking-[0.18em] uppercase">
                      {locale === "no" ? "Prosjekt" : "Project"}{" "}
                      {projectIndex + 1} / {projects.length}
                    </p>
                    <h3 className="mt-1 font-semibold">
                      {project.title[locale]}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {locale === "no"
                        ? "Se dokumenterte bilder fra tak før, under og etter behandling"
                        : "See documented roof photos before, during and after treatment"}
                    </p>
                  </div>

                  <div className="space-y-8 p-3 sm:p-5">
                    {pairs.length > 0 ? (
                      <section aria-label={copy.references.comparisonHint}>
                        <div className="mb-3 flex items-center gap-3 sm:mb-4">
                          <span className="bg-accent text-accent-foreground inline-flex size-7 items-center justify-center rounded-full text-xs font-bold">
                            1
                          </span>
                          <div>
                            <h4 className="text-sm font-bold tracking-wider text-white uppercase">
                              {locale === "no"
                                ? "Før- og ettereksempler"
                                : "Before and after examples"}
                            </h4>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {locale === "no"
                                ? "Dokumenterte bilder – ikke nødvendigvis samme tak"
                                : "Documented photos – not necessarily the same roof"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {pairs.map((pair, pairIndex) => (
                            <div
                              key={`${project.id}-pair-${pairIndex}`}
                              className="grid grid-cols-2 items-start gap-2 sm:gap-4"
                            >
                              <PhotoCard
                                stage={pair.before}
                                label={copy.references.before}
                                locale={locale}
                                onOpen={() => openStage(project, pair.before)}
                              />
                              <PhotoCard
                                stage={pair.after}
                                label={copy.references.after}
                                locale={locale}
                                onOpen={() => openStage(project, pair.after)}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {remaining.length > 0 ? (
                      <section>
                        <div className="mb-3 flex items-center gap-3 sm:mb-4">
                          <span className="bg-accent text-accent-foreground inline-flex size-7 items-center justify-center rounded-full text-xs font-bold">
                            {pairs.length > 0 ? 2 : 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold tracking-wider text-white uppercase">
                              {locale === "no" ? "Flere bilder" : "More photos"}
                            </h4>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {locale === "no"
                                ? "Store bilder i originalt format"
                                : "Large images in their original format"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 items-start gap-4 sm:gap-6 lg:gap-8">
                          {remaining.map((stage, index) => (
                            <PhotoCard
                              key={`${stage.image.url}-${index}`}
                              stage={stage}
                              label={copy.references[stage.label]}
                              locale={locale}
                              onOpen={() => openStage(project, stage)}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>

      {lightbox ? (
        <Lightbox
          title={lightbox.title}
          stages={lightbox.stages}
          startIndex={lightbox.index}
          locale={locale}
          labelFor={(label) => copy.references[label]}
          swipeHint={copy.references.swipe}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </section>
  );
}

function PhotoCard({
  stage,
  label,
  locale,
  onOpen,
}: {
  stage: Stage;
  label: string;
  locale: "no" | "en";
  onOpen: () => void;
}) {
  const src = optimizeRemoteImageUrl(stage.image.url, {
    width: 1200,
    quality: 75,
  });
  const isSquare = /\/\d{2}-S-/i.test(stage.image.url);
  const isLandscape = /\/\d{2}-L-/i.test(stage.image.url);
  const dimensions = isSquare
    ? { width: 1200, height: 1200 }
    : isLandscape
      ? { width: 1200, height: 628 }
      : { width: 1200, height: 900 };

  return (
    <figure className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0d12]">
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full overflow-hidden text-left"
        aria-label={stage.caption[locale]}
      >
        <Image
          src={src}
          alt={stage.image.alt || stage.caption[locale]}
          width={dimensions.width}
          height={dimensions.height}
          sizes="(max-width: 640px) 50vw, 560px"
          className="h-auto w-full object-contain transition-opacity duration-300 group-hover:opacity-90"
          loading="lazy"
        />
        <span className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm">
          <Maximize2 className="size-3.5" aria-hidden />
          <span className="sr-only">
            {locale === "no" ? "Vis hele bildet" : "View full image"}
          </span>
        </span>
      </button>
      <figcaption className="min-h-[4.5rem] border-t border-white/10 px-3 py-2.5">
        <p className="text-accent text-[10px] font-bold tracking-wider uppercase">
          {label}
        </p>
        <p className="mt-1 text-xs leading-snug font-medium text-white/90 sm:text-sm">
          {stage.caption[locale]}
        </p>
      </figcaption>
    </figure>
  );
}

function Lightbox({
  title,
  stages,
  startIndex,
  locale,
  labelFor,
  swipeHint,
  onClose,
}: {
  title: string;
  stages: Stage[];
  startIndex: number;
  locale: "no" | "en";
  labelFor: (label: Stage["label"]) => string;
  swipeHint: string;
  onClose: () => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex,
    align: "center",
    containScroll: false,
    watchDrag: true,
  });
  const [index, setIndex] = useState(startIndex);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setIndex(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(startIndex, true);
    const frame = window.requestAnimationFrame(onSelect);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      window.cancelAnimationFrame(frame);
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect, startIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") emblaApi?.scrollPrev();
      if (e.key === "ArrowRight") emblaApi?.scrollNext();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [emblaApi, onClose]);

  const stage = stages[index] ?? stages[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/60">
            {index + 1} / {stages.length}
            {stages.length > 1 ? ` · ${swipeHint}` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full touch-pan-y">
            {stages.map((item, i) => (
              <div
                key={`${item.image.url}-${i}`}
                className="relative min-w-0 shrink-0 grow-0 basis-full px-2 sm:px-8"
              >
                <div className="relative mx-auto h-full w-full max-w-5xl">
                  <Image
                    src={optimizeRemoteImageUrl(item.image.url, {
                      width: 1800,
                      quality: 85,
                    })}
                    alt={item.image.alt || item.caption[locale]}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority={i === startIndex}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {stages.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              disabled={!canPrev}
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute top-1/2 left-1 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white disabled:opacity-0 sm:left-4"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              disabled={!canNext}
              onClick={() => emblaApi?.scrollNext()}
              className="absolute top-1/2 right-1 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white disabled:opacity-0 sm:right-4"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-white/90 uppercase">
          {labelFor(stage.label)}
        </span>
        <p className="mt-2 text-sm font-medium text-white">
          {stage.caption[locale]}
        </p>
      </div>
    </div>
  );
}
