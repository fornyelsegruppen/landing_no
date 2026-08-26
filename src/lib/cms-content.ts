import { cache } from "react";
import { draftMode } from "next/headers";
import { getPayload } from "@/lib/payload";
import { siteConfig } from "@/lib/site";
import { siteImages } from "@/content/images";
import { privacyAcknowledgement, privacyFallback } from "@/content/privacy";
import {
  faqItems as fallbackFaq,
  products as fallbackProducts,
  projects as fallbackProjects,
  serviceKeys,
} from "@/content/site-content";
import noMessages from "@/i18n/messages/no.json";
import enMessages from "@/i18n/messages/en.json";
import {
  pageCopyFromMessages,
  pageCopyFromSettingsDoc,
  type PageCopy,
} from "@/lib/page-copy";

export type CmsMedia = {
  url: string;
  alt: string;
};

export type CmsNavItem = {
  label: { no: string; en: string };
  href: string;
  visible: boolean;
};

export type CmsService = {
  id: string;
  key: string;
  title: { no: string; en: string };
  description: { no: string; en: string };
  icon: string;
  featured: boolean;
  order: number;
};

export type CmsProject = {
  id: string;
  title: { no: string; en: string };
  order: number;
  stages: Array<{
    label: "before" | "during" | "after";
    caption: { no: string; en: string };
    image: CmsMedia;
  }>;
};

export type CmsProduct = {
  id: string;
  name: string;
  category: { no: string; en: string };
  description: { no: string; en: string };
  badges: { no: string[]; en: string[] };
  image?: CmsMedia;
  order: number;
};

export type CmsFaq = {
  id: string;
  question: { no: string; en: string };
  answer: { no: string; en: string };
  order: number;
};

export type CmsSettings = {
  brandName: string;
  phone: string;
  phoneHref: string;
  email: string;
  address: { street: string; postal: string; city: string };
  orgNr: string;
  parentOrg: string;
  navItems: CmsNavItem[];
  calculator: typeof siteConfig.calculator;
  trust: typeof siteConfig.trust;
  images: {
    logo: CmsMedia;
    hero: CmsMedia;
    about: CmsMedia;
    newRoof: CmsMedia;
  };
  seo: {
    areaServed: { no: string; en: string };
    openingHours: {
      days: string[];
      opens: string;
      closes: string;
    };
  };
  privacy: {
    title: { no: string; en: string };
    body: { no: string; en: string };
    linkLabel: { no: string; en: string };
    consentLabel: { no: string; en: string };
  };
  retentionMonths: number;
};

export type SiteContent = {
  settings: CmsSettings;
  copy: PageCopy;
  services: CmsService[];
  projects: CmsProject[];
  products: CmsProduct[];
  faq: CmsFaq[];
  source: "cms" | "fallback";
};

function fallbackServices(): CmsService[] {
  return serviceKeys.map((key, index) => {
    const noItem =
      noMessages.services.items[key as keyof typeof noMessages.services.items];
    const enItem =
      enMessages.services.items[key as keyof typeof enMessages.services.items];
    return {
      id: key,
      key,
      title: { no: noItem.title, en: enItem.title },
      description: { no: noItem.description, en: enItem.description },
      icon:
        key === "warranty"
          ? "shield"
          : key === "wash" || key === "softwash"
            ? "droplets"
            : key === "paint"
              ? "paint"
              : key === "newRoof"
                ? "home"
                : key === "impregnation"
                  ? "sparkles"
                  : key === "tiles" || key === "maintenance"
                    ? "wrench"
                    : "check",
      featured: index < 5,
      order: index,
    };
  });
}

function fallbackContent(): SiteContent {
  const copy = pageCopyFromMessages(noMessages, enMessages);
  return {
    source: "fallback",
    copy,
    settings: {
      brandName: siteConfig.name,
      phone: siteConfig.phone,
      phoneHref: siteConfig.phoneHref,
      email: siteConfig.email,
      address: {
        street: siteConfig.address.street,
        postal: siteConfig.address.postal,
        city: siteConfig.address.city,
      },
      orgNr: siteConfig.orgNr,
      parentOrg: siteConfig.parentOrg,
      navItems: [],
      calculator: siteConfig.calculator,
      trust: siteConfig.trust,
      images: {
        logo: { url: "/brand/logo.webp", alt: siteConfig.name },
        hero: { url: siteImages.hero, alt: "" },
        about: { url: siteImages.about, alt: "" },
        newRoof: { url: siteImages.newRoof, alt: "" },
      },
      seo: {
        areaServed: {
          no: "Oslo, Viken, Innlandet, Vestfold og Telemark, Agder, Rogaland, Vestland, Møre og Romsdal og Trøndelag",
          en: "Oslo, Viken, Innlandet, Vestfold og Telemark, Agder, Rogaland, Vestland, Møre og Romsdal and Trøndelag",
        },
        openingHours: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "08:00",
          closes: "16:00",
        },
      },
      privacy: {
        title: { ...privacyFallback.title },
        body: { ...privacyFallback.body },
        linkLabel: { ...privacyFallback.linkLabel },
        consentLabel: { ...privacyFallback.consentLabel },
      },
      retentionMonths: 24,
    },
    services: fallbackServices(),
    projects: fallbackProjects.map((p, i) => ({
      id: p.id,
      title: p.title,
      order: i,
      stages: p.stages.map((s) => ({
        label: s.label,
        caption: s.caption,
        image: { url: s.image, alt: "" },
      })),
    })),
    products: fallbackProducts.map((p, i) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      badges: {
        no: [...p.badges.no],
        en: [...p.badges.en],
      },
      order: i,
    })),
    faq: fallbackFaq.map((f, i) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      order: i,
    })),
  };
}

function phoneHrefFrom(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

type MediaLike =
  | number
  | string
  | {
      url?: string | null;
      alt?: string | null;
      sizes?: {
        hero?: { url?: string | null } | null;
        card?: { url?: string | null } | null;
      } | null;
    }
  | null
  | undefined;

export function resolveMedia(
  media: MediaLike,
  preferredSize?: "hero" | "card",
): CmsMedia | undefined {
  if (!media || typeof media === "number" || typeof media === "string") {
    return undefined;
  }
  let url: string | null | undefined;
  if (preferredSize === "hero" && media.sizes?.hero?.url) {
    url = media.sizes.hero.url;
  } else if (preferredSize === "card" && media.sizes?.card?.url) {
    url = media.sizes.card.url;
  } else {
    url = media.url;
  }
  if (!url) return undefined;
  return { url, alt: media.alt?.trim() || "" };
}

export function resolveMediaUrl(
  media: MediaLike,
  preferredSize?: "hero" | "card",
): string | undefined {
  return resolveMedia(media, preferredSize)?.url;
}

function mediaFromUploadOrUrl(
  media: MediaLike,
  url: string | null | undefined,
  fallback: CmsMedia,
  preferredSize?: "hero" | "card",
): CmsMedia {
  const uploaded = resolveMedia(media, preferredSize);
  if (uploaded) return uploaded;
  const fallbackUrl = url?.trim();
  if (
    fallbackUrl &&
    [
      "photo-1568605114967-8130f3a36994",
      "photo-1475855581690-80accde3ae2b",
      "photo-1449844908441-8829872d2607",
    ].some((id) => fallbackUrl.includes(id))
  ) {
    return fallback;
  }
  return fallbackUrl ? { url: fallbackUrl, alt: fallback.alt } : fallback;
}

function parseOpeningDays(
  value: string | null | undefined,
  fallback: string[],
): string[] {
  const days = (value || "")
    .split(/[\n,]/)
    .map((day) => day.trim())
    .filter(Boolean);
  return days.length > 0 ? days : fallback;
}

export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const fallback = fallbackContent();

  try {
    const { isEnabled: isDraftMode } = await draftMode();
    const payload = await getPayload();
    const [settingsDoc, servicesRes, projectsRes, productsRes, faqRes] =
      await Promise.all([
        payload.findGlobal({
          slug: "site-settings",
          depth: 1,
          draft: isDraftMode,
          overrideAccess: true,
        }),
        payload.find({
          collection: "services",
          sort: "order",
          limit: 50,
          depth: 0,
          draft: isDraftMode,
          overrideAccess: true,
        }),
        payload.find({
          collection: "projects",
          sort: "order",
          limit: 50,
          depth: 1,
          draft: isDraftMode,
          overrideAccess: true,
        }),
        payload.find({
          collection: "products",
          sort: "order",
          limit: 50,
          depth: 1,
          draft: isDraftMode,
          overrideAccess: true,
        }),
        payload.find({
          collection: "faq",
          sort: "order",
          limit: 50,
          depth: 0,
          draft: isDraftMode,
          overrideAccess: true,
        }),
      ]);

    const hasCmsRows =
      servicesRes.docs.length > 0 ||
      projectsRes.docs.length > 0 ||
      productsRes.docs.length > 0 ||
      faqRes.docs.length > 0;

    const copyFallback = pageCopyFromMessages(noMessages, enMessages);
    const copy = pageCopyFromSettingsDoc(settingsDoc, copyFallback);
    const hasCmsCopy = Boolean(settingsDoc.copyMeta?.titleNo?.trim());
    const navItems: CmsNavItem[] = (
      (settingsDoc.navItems || []) as Array<{
        labelNo?: string | null;
        labelEn?: string | null;
        href?: string | null;
        visible?: boolean | null;
      }>
    )
      .map((item) => {
        const no = item.labelNo?.trim() || "";
        const en = item.labelEn?.trim() || "";
        return {
          label: { no: no || en, en: en || no },
          href: item.href?.trim() || "",
          visible: item.visible !== false,
        };
      })
      .filter((item) => item.href && (item.label.no || item.label.en));

    const settings: CmsSettings = {
      brandName: settingsDoc.brandName || fallback.settings.brandName,
      phone: settingsDoc.phone || fallback.settings.phone,
      phoneHref: phoneHrefFrom(settingsDoc.phone || fallback.settings.phone),
      email: settingsDoc.email || fallback.settings.email,
      address: {
        street: settingsDoc.street || fallback.settings.address.street,
        postal: settingsDoc.postal || fallback.settings.address.postal,
        city: settingsDoc.city || fallback.settings.address.city,
      },
      orgNr: settingsDoc.orgNr || fallback.settings.orgNr,
      parentOrg: settingsDoc.parentOrg || fallback.settings.parentOrg,
      navItems,
      calculator: {
        minSqm:
          settingsDoc.calculator?.minSqm ?? fallback.settings.calculator.minSqm,
        maxSqm:
          settingsDoc.calculator?.maxSqm ?? fallback.settings.calculator.maxSqm,
        defaultSqm:
          settingsDoc.calculator?.defaultSqm ??
          fallback.settings.calculator.defaultSqm,
        newRoofPerSqm:
          settingsDoc.calculator?.newRoofPerSqm ??
          fallback.settings.calculator.newRoofPerSqm,
        renewalPerSqm:
          settingsDoc.calculator?.renewalPerSqm ??
          fallback.settings.calculator.renewalPerSqm,
      },
      trust: {
        sqmRenewed:
          settingsDoc.trust?.sqmRenewed || fallback.settings.trust.sqmRenewed,
        warrantyYears:
          settingsDoc.trust?.warrantyYears ??
          fallback.settings.trust.warrantyYears,
        happyCustomers:
          settingsDoc.trust?.happyCustomers ||
          fallback.settings.trust.happyCustomers,
        rating: settingsDoc.trust?.rating || fallback.settings.trust.rating,
      },
      images: {
        logo: mediaFromUploadOrUrl(
          settingsDoc.logo as MediaLike,
          undefined,
          fallback.settings.images.logo,
        ),
        hero: mediaFromUploadOrUrl(
          settingsDoc.heroImage as MediaLike,
          settingsDoc.heroImageUrl,
          fallback.settings.images.hero,
          "hero",
        ),
        about: mediaFromUploadOrUrl(
          settingsDoc.aboutImage as MediaLike,
          settingsDoc.aboutImageUrl,
          fallback.settings.images.about,
          "card",
        ),
        newRoof: mediaFromUploadOrUrl(
          settingsDoc.newRoofImage as MediaLike,
          settingsDoc.newRoofImageUrl,
          fallback.settings.images.newRoof,
          "card",
        ),
      },
      seo: {
        areaServed: {
          no:
            settingsDoc.areaServedNo?.trim() ||
            fallback.settings.seo.areaServed.no,
          en:
            settingsDoc.areaServedEn?.trim() ||
            fallback.settings.seo.areaServed.en,
        },
        openingHours: {
          days: parseOpeningDays(
            settingsDoc.openingDays,
            fallback.settings.seo.openingHours.days,
          ),
          opens:
            settingsDoc.openingTime?.trim() ||
            fallback.settings.seo.openingHours.opens,
          closes:
            settingsDoc.closingTime?.trim() ||
            fallback.settings.seo.openingHours.closes,
        },
      },
      privacy: {
        title: {
          no:
            (settingsDoc.privacyTitleNo as string | undefined)?.trim() ||
            fallback.settings.privacy.title.no,
          en:
            (settingsDoc.privacyTitleEn as string | undefined)?.trim() ||
            fallback.settings.privacy.title.en,
        },
        body: {
          no:
            (settingsDoc.privacyBodyNo as string | undefined)?.trim() ||
            fallback.settings.privacy.body.no,
          en:
            (settingsDoc.privacyBodyEn as string | undefined)?.trim() ||
            fallback.settings.privacy.body.en,
        },
        linkLabel: {
          no:
            (settingsDoc.privacyLinkNo as string | undefined)?.trim() ||
            fallback.settings.privacy.linkLabel.no,
          en:
            (settingsDoc.privacyLinkEn as string | undefined)?.trim() ||
            fallback.settings.privacy.linkLabel.en,
        },
        consentLabel: {
          no: privacyAcknowledgement(
            "no",
            settingsDoc.consentLabelNo as string | undefined,
          ),
          en: privacyAcknowledgement(
            "en",
            settingsDoc.consentLabelEn as string | undefined,
          ),
        },
      },
      retentionMonths:
        typeof settingsDoc.retentionMonths === "number" &&
        settingsDoc.retentionMonths > 0
          ? settingsDoc.retentionMonths
          : fallback.settings.retentionMonths,
    };

    const services: CmsService[] =
      servicesRes.docs.length > 0
        ? servicesRes.docs.map((doc) => ({
            id: String(doc.id),
            key: doc.key,
            title: { no: doc.titleNo, en: doc.titleEn },
            description: { no: doc.descriptionNo, en: doc.descriptionEn },
            icon: doc.icon || "check",
            featured: Boolean(doc.featured),
            order: doc.order ?? 0,
          }))
        : fallback.services;

    const cmsProjectsHaveLegacyImages = projectsRes.docs.some((doc) =>
      (doc.stages || []).some(
        (stage: { image?: MediaLike; imageUrl?: string | null }) => {
          const imageUrl =
            resolveMediaUrl(stage.image, "card") || stage.imageUrl?.trim();

          return imageUrl?.startsWith("/references/");
        },
      ),
    );

    const projects: CmsProject[] =
      projectsRes.docs.length > 0 && !cmsProjectsHaveLegacyImages
        ? projectsRes.docs.map((doc) => ({
            id: String(doc.id),
            title: { no: doc.titleNo, en: doc.titleEn },
            order: doc.order ?? 0,
            stages: (doc.stages || []).map(
              (stage: {
                label: "before" | "during" | "after";
                captionNo: string;
                captionEn: string;
                image?: MediaLike;
                imageUrl?: string | null;
              }) => ({
                label: stage.label,
                caption: { no: stage.captionNo, en: stage.captionEn },
                image: mediaFromUploadOrUrl(
                  stage.image,
                  stage.imageUrl,
                  fallback.settings.images.hero,
                  "card",
                ),
              }),
            ),
          }))
        : fallback.projects;

    const products: CmsProduct[] =
      productsRes.docs.length > 0
        ? productsRes.docs.map((doc) => ({
            id: String(doc.id),
            name: doc.name,
            category: { no: doc.categoryNo, en: doc.categoryEn },
            description: { no: doc.descriptionNo, en: doc.descriptionEn },
            image: resolveMedia(doc.image as MediaLike, "card"),
            badges: {
              no: (doc.badgesNo || [])
                .map((b: { label: string }) => b.label)
                .filter(Boolean),
              en: (doc.badgesEn || [])
                .map((b: { label: string }) => b.label)
                .filter(Boolean),
            },
            order: doc.order ?? 0,
          }))
        : fallback.products;

    const faq: CmsFaq[] =
      faqRes.docs.length > 0
        ? faqRes.docs.map((doc) => ({
            id: String(doc.id),
            question: { no: doc.questionNo, en: doc.questionEn },
            answer: { no: doc.answerNo, en: doc.answerEn },
            order: doc.order ?? 0,
          }))
        : fallback.faq;

    return {
      source: hasCmsRows || hasCmsCopy ? "cms" : "fallback",
      settings,
      copy,
      services,
      projects,
      products,
      faq,
    };
  } catch (err) {
    console.error("CMS content fetch failed, using fallback:", err);
    return fallback;
  }
});
