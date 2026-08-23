import path from "path";
import { fileURLToPath } from "url";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { buildConfig } from "payload";
import sharp from "sharp";

import { Users } from "./payload/collections/Users";
import { Media } from "./payload/collections/Media";
import { Services } from "./payload/collections/Services";
import { Projects } from "./payload/collections/Projects";
import { Products } from "./payload/collections/Products";
import { Faq } from "./payload/collections/Faq";
import { Leads } from "./payload/collections/Leads";
import { Pages } from "./payload/collections/Pages";
import { Posts } from "./payload/collections/Posts";
import { Redirects } from "./payload/collections/Redirects";
import { SiteSettings } from "./payload/collections/SiteSettings";
import { AuditEvents } from "./payload/collections/AuditEvents";
import { OperationalJobs } from "./payload/collections/OperationalJobs";
import { AccessTokens } from "./payload/collections/AccessTokens";
import { PrivateMedia } from "./payload/collections/PrivateMedia";
import { WorkOrders } from "./payload/collections/WorkOrders";
import { SeoTopics } from "./payload/collections/SeoTopics";
import { SeoRuns } from "./payload/collections/SeoRuns";
import { Messages } from "./payload/collections/Messages";
import { RoofMeasurements } from "./payload/collections/RoofMeasurements";
import { PriceRules } from "./payload/collections/PriceRules";
import { PriceCalculations } from "./payload/collections/PriceCalculations";
import { Quotes } from "./payload/collections/Quotes";
import { Contracts } from "./payload/collections/Contracts";
import { ChangeAgreements } from "./payload/collections/ChangeAgreements";
import { ContractTerms } from "./payload/collections/ContractTerms";
import { migrations } from "./payload/migrations";
import { resolvePayloadSecret } from "./lib/payload-secret";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const rawDatabaseUrl = process.env.DATABASE_URL || "file:./takfornying.db";
// Neon sometimes adds channel_binding=require which breaks node-pg on Vercel
const databaseUrl = rawDatabaseUrl.replace(/[&?]channel_binding=require/g, "");
const usePostgres = databaseUrl.startsWith("postgres");
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

const serverURL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** Origins allowed to use the auth cookie (CSRF). Must include every host where /admin is opened. */
const trustedOrigins = Array.from(
  new Set(
    [
      serverURL,
      "https://www.takfornyelse.as",
      "https://takfornyelse.as",
      "https://landing-no.vercel.app",
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "",
      process.env.VERCEL_BRANCH_URL
        ? `https://${process.env.VERCEL_BRANCH_URL}`
        : "",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].filter(Boolean),
  ),
);

const migrationDir = path.resolve(dirname, "payload/migrations");

const databaseAdapter = usePostgres
  ? (await import("@payloadcms/db-postgres")).postgresAdapter({
      pool: {
        connectionString: databaseUrl,
        // max:1 deadlocks Payload (transactions + nested queries) on serverless.
        max: 10,
        idleTimeoutMillis: 20_000,
        connectionTimeoutMillis: 15_000,
      },
      // Avoid nested transaction connection grabs that stall with small pools.
      transactionOptions: false,
      // Production never auto-pushes; migrations handle schema.
      // Local/dev push stays available unless explicitly disabled.
      push: process.env.NODE_ENV !== "production",
      migrationDir,
      prodMigrations: migrations,
    })
  : (await import("@payloadcms/db-sqlite")).sqliteAdapter({
      client: {
        url: databaseUrl,
      },
    });

export default buildConfig({
  serverURL,
  csrf: trustedOrigins,
  cors: trustedOrigins,
  admin: {
    user: Users.slug,
    components: {
      beforeDashboard: ["/components/AdminDashboard"],
    },
    importMap: {
      baseDir: path.resolve(dirname, "app/(payload)/admin"),
    },
    livePreview: {
      collections: [
        "services",
        "projects",
        "products",
        "faq",
        "pages",
        "posts",
      ],
      globals: ["site-settings"],
      url: `${serverURL}/api/preview?locale=no`,
    },
  },
  collections: [
    Users,
    Media,
    Services,
    Projects,
    Products,
    Faq,
    Pages,
    Posts,
    Redirects,
    Leads,
    Messages,
    RoofMeasurements,
    PriceRules,
    PriceCalculations,
    Quotes,
    Contracts,
    ChangeAgreements,
    ContractTerms,
    WorkOrders,
    SeoTopics,
    SeoRuns,
    AuditEvents,
    OperationalJobs,
    AccessTokens,
    PrivateMedia,
  ],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: resolvePayloadSecret(),
  typescript: {
    outputFile: path.resolve(dirname, "payload", "payload-types.ts"),
  },
  db: databaseAdapter,
  sharp,
  plugins: [
    vercelBlobStorage({
      enabled: Boolean(blobToken),
      collections: {
        media: true,
        "private-media": true,
      },
      token: blobToken,
      // Bypass Vercel 4.5MB serverless body limit — upload goes client → Blob.
      clientUploads: true,
      addRandomSuffix: true,
    }),
  ],
});
