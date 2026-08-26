import type { Metadata } from "next";
import Image from "next/image";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MarkdownLite } from "@/components/content/markdown-lite";
import { ArticleCta } from "@/components/blog/article-cta";
import { Link, routing } from "@/i18n/routing";
import {
  availablePostLocales,
  getPostBySlug,
  getPublishedPosts,
  getRedirectDestination,
  getRedirectForPath,
  localizeContent,
  postHasLocale,
} from "@/lib/cms-pages";
import { resolvePostImage } from "@/lib/blog/post-image";
import { resolveMedia } from "@/lib/cms-content";
import { redirectPathCandidates } from "@/lib/content-paths";
import { siteConfig, type Locale } from "@/lib/site";
import { safeContentHref } from "@/lib/safe-content-link";
import { getSeoServiceHref } from "@/content/seo-landing-pages";
import { blogPostLanguageUrls } from "@/lib/blog/routing";
import { guideLabels } from "@/lib/public-navigation";
import { publicRelatedPosts } from "@/lib/blog/related-posts";
import { publicReviewerName } from "@/lib/blog/reviewer";

export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  try {
    const posts = await getPublishedPosts();
    return posts.flatMap((post) =>
      availablePostLocales(post).map((locale) => ({ locale, slug: post.slug })),
    );
  } catch (error) {
    console.error("Blog static params could not be generated:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const loc = locale as Locale;
  if (!routing.locales.includes(loc) || !postHasLocale(post, loc)) {
    return { robots: { index: false, follow: false } };
  }
  const localized = localizeContent(post, loc);
  const hero = resolvePostImage(post, "hero", localized.title);
  const { isEnabled: isDraftMode } = await draftMode();
  const postUrl = `${siteConfig.url}/${locale}/blogg/${slug}`;
  const heroUrl = hero
    ? new URL(hero.url, siteConfig.url).toString()
    : undefined;
  const availableLocales = availablePostLocales(post);
  const languageUrls = blogPostLanguageUrls(post, siteConfig.url);

  return {
    title: localized.seoTitle,
    description: localized.seoDescription,
    alternates: {
      canonical: postUrl,
      languages: {
        ...languageUrls,
        ...(availableLocales.includes("no")
          ? { "x-default": `${siteConfig.url}/no/blogg/${slug}` }
          : {}),
      },
    },
    openGraph: {
      title: localized.seoTitle,
      description: localized.seoDescription,
      type: "article",
      url: postUrl,
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      images: heroUrl
        ? [{ url: heroUrl, alt: hero?.alt || localized.title }]
        : undefined,
    },
    twitter: heroUrl
      ? {
          card: "summary_large_image",
          title: localized.seoTitle,
          description: localized.seoDescription,
          images: [heroUrl],
        }
      : undefined,
    robots: isDraftMode
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    dateStyle: "long",
  }).format(new Date(value));
}

function relatedDocument<T extends object>(
  relation: number | string | T,
): T | null {
  return typeof relation === "object" && relation !== null ? relation : null;
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;
  const currentPath = `/${locale}/blogg/${slug}`;

  const redirectDocument = await getRedirectForPath(loc, currentPath);
  const destination = redirectDocument
    ? getRedirectDestination(redirectDocument)
    : null;
  const sourceAliases = redirectPathCandidates(loc, currentPath);

  if (destination && !sourceAliases.includes(destination)) {
    if (redirectDocument?.permanent !== false) permanentRedirect(destination);
    redirect(destination);
  }

  const post = await getPostBySlug(slug);
  if (!post || !postHasLocale(post, loc)) notFound();

  const localized = localizeContent(post, loc);
  const uploadedHero = resolveMedia(post.heroImage, "hero");
  const hero = resolvePostImage(post, "hero", localized.title);
  const heroDocument =
    post.heroImage && typeof post.heroImage === "object"
      ? post.heroImage
      : null;
  const remoteStockAttribution =
    !uploadedHero && post.stockImage?.provider === "pexels"
      ? post.stockImage
      : null;
  const stockAttribution =
    heroDocument?.stockProvider === "pexels"
      ? {
          photographer:
            heroDocument.stockPhotographer?.trim() || "Pexels-fotograf",
          photographerUrl: heroDocument.stockPhotographerUrl
            ? safeContentHref(heroDocument.stockPhotographerUrl, loc)
            : null,
          sourceUrl: heroDocument.stockSourceUrl
            ? safeContentHref(heroDocument.stockSourceUrl, loc)
            : "https://www.pexels.com/",
        }
      : remoteStockAttribution
        ? {
            photographer:
              remoteStockAttribution.photographer?.trim() || "Pexels-fotograf",
            photographerUrl: remoteStockAttribution.photographerUrl
              ? safeContentHref(remoteStockAttribution.photographerUrl, loc)
              : null,
            sourceUrl: remoteStockAttribution.sourceUrl
              ? safeContentHref(remoteStockAttribution.sourceUrl, loc)
              : "https://www.pexels.com/",
          }
        : null;
  const date = post.publishedAt || post.createdAt;
  const postUrl = `${siteConfig.url}/${locale}/blogg/${slug}`;
  const heroUrl = hero
    ? new URL(hero.url, siteConfig.url).toString()
    : undefined;
  const reviewedDate = post.reviewedAt || post.updatedAt;
  const reviewerName = publicReviewerName(post.reviewerName);
  const faqs = (post.faqItems || [])
    .map((faq) => ({
      question: (loc === "no" ? faq.questionNo : faq.questionEn)?.trim() || "",
      answer: (loc === "no" ? faq.answerNo : faq.answerEn)?.trim() || "",
    }))
    .filter((faq) => faq.question && faq.answer);
  const relatedPosts = publicRelatedPosts(post.relatedPosts, loc);
  const relatedServices = (post.relatedServices || [])
    .map((relation) => relatedDocument(relation))
    .filter(
      (
        relation,
      ): relation is {
        id: number | string;
        key: string;
        titleNo: string;
        titleEn: string;
      } => Boolean(relation?.key),
    );
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${postUrl}#article`,
        headline: localized.title,
        description: localized.seoDescription,
        url: postUrl,
        mainEntityOfPage: { "@id": `${postUrl}#webpage` },
        datePublished: post.publishedAt || post.createdAt,
        dateModified: post.updatedAt,
        inLanguage: loc === "no" ? "nb-NO" : "en",
        ...(heroUrl ? { image: heroUrl } : {}),
        author: {
          "@type": "Person",
          name: post.authorName,
          worksFor: { "@id": `${siteConfig.url}/#organization` },
        },
        reviewedBy: reviewerName
          ? { "@type": "Person", name: reviewerName }
          : undefined,
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${postUrl}#webpage`,
        name: localized.title,
        description: localized.seoDescription,
        url: postUrl,
        inLanguage: loc === "no" ? "nb-NO" : "en",
        isPartOf: { "@id": `${siteConfig.url}/${locale}/blogg#collection` },
        breadcrumb: { "@id": `${postUrl}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${postUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: loc === "no" ? "Forside" : "Home",
            item: `${siteConfig.url}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: guideLabels[loc],
            item: `${siteConfig.url}/${locale}/blogg`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: localized.title,
            item: postUrl,
          },
        ],
      },
      ...(faqs.length
        ? [
            {
              "@type": "FAQPage",
              "@id": `${postUrl}#faq`,
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <article className="section-pad">
        <div className="container-narrow max-w-3xl">
          <p className="eyebrow">
            <Link href="/blogg" className="hover:text-accent-hover">
              {loc === "no"
                ? "Tilbake til råd og guider"
                : "Back to advice and guides"}
            </Link>
          </p>
          <h1 className="heading-display mt-3 text-balance">
            {localized.title}
          </h1>
          <time
            dateTime={date}
            className="text-muted-foreground mt-4 block text-sm"
          >
            {formatDate(date, loc)}
          </time>
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {post.authorName && (
              <span>
                {loc === "no" ? "Skrevet av" : "Written by"} {post.authorName}
              </span>
            )}
            {reviewerName && (
              <span>
                {loc === "no" ? "Faglig kontrollert av" : "Reviewed by"}{" "}
                {reviewerName}, {formatDate(reviewedDate, loc)}
              </span>
            )}
          </div>
          {localized.excerpt && (
            <p className="text-muted-foreground mt-6 text-lg leading-8">
              {localized.excerpt}
            </p>
          )}
          {hero && (
            <figure className="mt-8">
              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src={hero.url}
                  alt={hero.alt || localized.title}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
              </div>
              {stockAttribution && (
                <figcaption className="text-muted-foreground mt-2 text-xs">
                  {loc === "no" ? "Foto" : "Photo"}:{" "}
                  {stockAttribution.photographerUrl ? (
                    <a
                      href={stockAttribution.photographerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent underline underline-offset-4"
                    >
                      {stockAttribution.photographer}
                    </a>
                  ) : (
                    stockAttribution.photographer
                  )}{" "}
                  /{" "}
                  <a
                    href={
                      stockAttribution.sourceUrl || "https://www.pexels.com/"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent underline underline-offset-4"
                  >
                    Pexels
                  </a>
                </figcaption>
              )}
            </figure>
          )}
          <div className="mt-10">
            <MarkdownLite content={localized.content} locale={loc} />
          </div>
          {faqs.length > 0 && (
            <section
              className="border-border mt-12 border-t pt-10"
              aria-labelledby="article-faq"
            >
              <h2 id="article-faq" className="text-2xl font-semibold">
                {loc === "no"
                  ? "Vanlige spørsmål"
                  : "Frequently asked questions"}
              </h2>
              <div className="mt-5 space-y-4">
                {faqs.map((faq) => (
                  <details key={faq.question} className="surface-card p-5">
                    <summary className="cursor-pointer font-semibold">
                      {faq.question}
                    </summary>
                    <p className="text-muted-foreground mt-3 leading-7">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}
          {(relatedPosts.length > 0 || relatedServices.length > 0) && (
            <section
              className="border-border mt-12 border-t pt-10"
              aria-labelledby="related-content"
            >
              <h2 id="related-content" className="text-2xl font-semibold">
                {loc === "no" ? "Les videre" : "Continue reading"}
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {relatedPosts.map((related) => (
                  <li key={String(related.id)}>
                    <Link
                      className="surface-card hover:border-accent/40 block p-5 font-semibold"
                      href={`/blogg/${related.slug}`}
                    >
                      {localizeContent(related, loc).title}
                    </Link>
                  </li>
                ))}
                {relatedServices.map((service) => {
                  const href = getSeoServiceHref(service.key);
                  if (!href) return null;
                  return (
                    <li key={String(service.id)}>
                      <Link
                        className="surface-card hover:border-accent/40 block p-5 font-semibold"
                        href={`/${href}`}
                      >
                        {loc === "no" ? service.titleNo : service.titleEn}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {(post.sources || []).length > 0 && (
            <section
              className="border-border mt-12 border-t pt-8"
              aria-labelledby="article-sources"
            >
              <h2 id="article-sources" className="text-lg font-semibold">
                {loc === "no" ? "Kilder" : "Sources"}
              </h2>
              <ul className="text-muted-foreground mt-4 list-disc space-y-2 pl-5 text-sm">
                {(post.sources || []).map((source) => {
                  const href = safeContentHref(source.url, loc);
                  return (
                    <li key={`${source.label}-${source.url}`}>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-accent underline underline-offset-4"
                        >
                          {source.label}
                        </a>
                      ) : (
                        source.label
                      )}
                      {source.publisher ? ` — ${source.publisher}` : ""}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <ArticleCta locale={loc} slug={slug} variant={post.ctaVariant} />
        </div>
      </article>
    </>
  );
}
