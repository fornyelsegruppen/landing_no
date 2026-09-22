import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin-v2",
        "/admin-next-preview",
        "/api",
        "/henvendelse",
        "/kontakt/",
        "/payload",
        "/tilbud/",
        "/user",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
