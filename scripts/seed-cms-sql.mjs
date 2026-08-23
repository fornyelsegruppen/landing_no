/**
 * Seed CMS tables directly via Postgres (avoids Payload CLI env loader issues).
 * Idempotent: only inserts when a collection has 0 rows.
 *
 * Usage: node --env-file=.env scripts/seed-cms-sql.mjs
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { postgresSslOptions } from "./postgres-ssl.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const noMessages = JSON.parse(
  readFileSync(join(root, "src/i18n/messages/no.json"), "utf8"),
);
const enMessages = JSON.parse(
  readFileSync(join(root, "src/i18n/messages/en.json"), "utf8"),
);

const url = process.env.DATABASE_URL?.replace(
  /[&?]channel_binding=require/g,
  "",
);
if (!url?.startsWith("postgres")) {
  console.error("DATABASE_URL must be postgres");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 20000,
  ssl: postgresSslOptions(url),
});

const siteImages = {
  hero: "/gallery/marketing/hero-finished-roof-v2.webp",
  newRoof: "/gallery/marketing/new-roof-installation-v2.webp",
  about: "/gallery/marketing/about-roof-specialist-v2.webp",
};

const serviceKeys = [
  "inspection",
  "tiles",
  "wash",
  "impregnation",
  "paint",
  "maintenance",
  "warranty",
  "newRoof",
  "softwash",
];

const iconByKey = {
  warranty: "shield",
  wash: "droplets",
  softwash: "droplets",
  paint: "paint",
  newRoof: "home",
  impregnation: "sparkles",
  tiles: "wrench",
  maintenance: "wrench",
  inspection: "check",
};

const products = [
  {
    name: "NowoCoat Roof Coating",
    categoryNo: "Takmaling",
    categoryEn: "Roof coating",
    descriptionNo:
      "Profesjonell, vannbasert hybridmaling med tre bindemidler for overlegen heft til betongtakstein og fibersement. Lysekte, diffusjonsåpen, værstabil og elastisk – med Svanemerke.",
    descriptionEn:
      "Professional water-based hybrid coating with three binders for superior adhesion to concrete tiles and fibre cement. Lightfast, vapour-open, weather-stable and elastic – Swan-labelled.",
    badgesNo: ["Svanemerket", "UV-stabil", "Elastisk", "Diffusjonsåpen"],
    badgesEn: ["Swan ecolabel", "UV-stable", "Elastic", "Vapour-open"],
  },
  {
    name: "SurfaPore C",
    categoryNo: "Impregnering – diffusjonsåpen",
    categoryEn: "Impregnation – vapour-open",
    descriptionNo:
      "Vannbasert nanoimpregnering uten farlige tilsetninger. Skaper en usynlig, vannavvisende barriere uten film – underlaget puster fritt mens fukt og smuss holdes ute.",
    descriptionEn:
      "Water-based nano impregnation without harmful additives. Creates an invisible water-repellent barrier without a film – the substrate breathes while moisture and dirt stay out.",
    badgesNo: [
      "Nanoteknologi",
      "Diffusjonsåpen",
      "Usynlig beskyttelse",
      "Miljøvennlig",
    ],
    badgesEn: [
      "Nanotechnology",
      "Vapour-open",
      "Invisible protection",
      "Eco-friendly",
    ],
  },
  {
    name: "NowoDry WB",
    categoryNo: "Impregnering – vannavvisende",
    categoryEn: "Impregnation – water-repellent",
    descriptionNo:
      "Kraftig vannbasert impregnering for langvarig beskyttelse mot fukt. Ideell for takstein, heller og murverk der maksimal vannavvisning og frostbeskyttelse trengs.",
    descriptionEn:
      "Strong water-based impregnation for lasting moisture protection. Ideal for tiles, paving and masonry where maximum water repellence and frost protection are needed.",
    badgesNo: [
      "Sterk vannavvisning",
      "Frostbeskyttelse",
      "Langvarig",
      "Enkel påføring",
    ],
    badgesEn: [
      "Strong water repellence",
      "Frost protection",
      "Long-lasting",
      "Easy to apply",
    ],
  },
  {
    name: "NowoClean",
    categoryNo: "Rengjøring",
    categoryEn: "Cleaning",
    descriptionNo:
      "Effektivt rengjøringsmiddel for skånsom vask av papp-, skifer- og shingeltak. Fjerner smuss og alger uten å skade overflaten – og gir godt underlag for videre behandling.",
    descriptionEn:
      "Effective cleaner for gentle washing of felt, slate and shingle roofs. Removes dirt and algae without damaging the surface – and prepares for further treatment.",
    badgesNo: [
      "Skånsom vask",
      "Fjerner alger",
      "For alle taktyper",
      "Biologisk nedbrytbar",
    ],
    badgesEn: [
      "Gentle wash",
      "Removes algae",
      "All roof types",
      "Biodegradable",
    ],
  },
];

const faqItems = [
  {
    questionNo: "Hva koster takrenovering?",
    questionEn: "What does roof renovation cost?",
    answerNo:
      "Takvask koster fra 99 kr/m² + mva, impregnering fra 40 kr/m² + mva og takmaling fra 220 kr/m² + mva. Nøyaktig pris avhenger av takets størrelse, takstein og tilstand. Du får alltid fast pris etter gratis befaring.",
    answerEn:
      "Roof washing costs from NOK 99/m² + VAT, impregnation from NOK 40/m² + VAT and roof painting from NOK 220/m² + VAT. The exact price depends on roof size, tile type and condition. You always get a fixed price after a free inspection.",
  },
  {
    questionNo: "Hvordan impregneres tak?",
    questionEn: "How is a roof impregnated?",
    answerNo:
      "Etter grundig vask påføres impregnering som trekker inn i steinen. Den beskytter mot fukt og mose uten å tette damp – taket kan fortsatt puste.",
    answerEn:
      "After a thorough wash we apply impregnation that soaks into the tiles. It protects against moisture and moss without sealing vapour – the roof can still breathe.",
  },
  {
    questionNo: "Hvor lang tid tar takfornying?",
    questionEn: "How long does roof renewal take?",
    answerNo:
      "De fleste boligtak blir ferdige på 1–3 dager, avhengig av vær og størrelse. Store borettslag planlegges over flere etapper.",
    answerEn:
      "Most homes are finished in 1–3 days, depending on weather and size. Larger housing associations are planned in stages.",
  },
  {
    questionNo: "Hva er forskjellen på takfornyelse og takfornying?",
    questionEn: "What is the difference between roof renewal terms?",
    answerNo:
      "Takfornyelse og takfornying beskriver samme tjeneste: vask, impregnering og maling av eksisterende tak – nytt liv uten full omlegging.",
    answerEn:
      "Both terms describe the same service: washing, impregnating and painting an existing roof – new life without a full replacement.",
  },
  {
    questionNo: "Har dere erfaring med takfornying?",
    questionEn: "Do you have experience with roof renewal?",
    answerNo:
      "Ja. Vi har gjennomført over 100 takprosjekter, med dedikerte team, dokumenterte metoder og opptil 10 års produkt- og utførelsesgaranti (avhengig av behandling og takets tilstand).",
    answerEn:
      "Yes. We have completed over 100 roof projects, with dedicated teams, proven methods and up to 10 years’ product and workmanship warranty (depending on treatment and roof condition).",
  },
];

const projects = [
  {
    titleNo: "Takvask – før, under og etter",
    titleEn: "Roof washing – before, during and after",
    stages: [
      {
        label: "before",
        imageUrl: "/gallery/takfornyelse/01-L-before-heavy-moss.jpg",
        captionNo: "Skitten og mosegrodd takstein før vask",
        captionEn: "Dirty, moss-covered roof tiles before washing",
      },
      {
        label: "after",
        imageUrl: "/gallery/takfornyelse/05-L-after-clean-roof.jpg",
        captionNo: "Ren takflate etter grundig vask",
        captionEn: "Clean roof surface after thorough washing",
      },
      {
        label: "before",
        imageUrl: "/gallery/takfornyelse/02-L-before-tile-detail.jpg",
        captionNo: "Mose og begroing mellom taksteinene før behandling",
        captionEn: "Moss and organic growth between tiles before treatment",
      },
      {
        label: "during",
        imageUrl: "/gallery/takfornyelse/04-L-worker-pressure-washing.jpg",
        captionNo: "Takvask under utførelse",
        captionEn: "Roof washing in progress",
      },
    ],
  },
  {
    titleNo: "Takmaling – tydelig før og etter",
    titleEn: "Roof painting – a clear before and after",
    stages: [
      {
        label: "during",
        imageUrl: "/gallery/takfornyelse/03-L-before-after-painting.jpg",
        captionNo: "Tydelig kontrast mellom ubehandlet og malt tak",
        captionEn: "Clear contrast between untreated and painted roof tiles",
      },
      {
        label: "during",
        imageUrl: "/gallery/takfornyelse/08-S-before-after-washing-worker.jpg",
        captionNo: "Rengjøring og klargjøring før videre behandling",
        captionEn: "Cleaning and preparation before further treatment",
      },
      {
        label: "during",
        imageUrl: "/gallery/takfornyelse/09-S-before-after-painting.jpg",
        captionNo: "Takmaling underveis med synlig før-og-etter-effekt",
        captionEn:
          "Roof painting in progress with a visible before-and-after effect",
      },
      {
        label: "after",
        imageUrl: "/gallery/takfornyelse/10-S-after-coated-detail.jpg",
        captionNo: "Jevn og beskyttet takflate etter behandling",
        captionEn: "Even, protected roof surface after treatment",
      },
    ],
  },
  {
    titleNo: "Ferdig behandlede tak – ulike boliger",
    titleEn: "Finished roofs – different homes",
    stages: [
      {
        label: "before",
        imageUrl: "/gallery/takfornyelse/07-S-before-moss-ridge.jpg",
        captionNo: "Mosegrodd møne og takstein før fornying",
        captionEn: "Moss-covered ridge and roof tiles before renewal",
      },
      {
        label: "after",
        imageUrl: "/gallery/takfornyelse/11-S-finished-clean-roof.jpg",
        captionNo: "Rent og ferdig behandlet tak",
        captionEn: "Clean, fully treated roof",
      },
      {
        label: "after",
        imageUrl: "/gallery/takfornyelse/06-L-finished-house-roof.jpg",
        captionNo: "Ferdig fornyet tak på enebolig",
        captionEn: "Completed roof renewal on a detached home",
      },
      {
        label: "after",
        imageUrl: "/gallery/takfornyelse/12-S-finished-house-roof.jpg",
        captionNo: "Bolig med ferdig behandlet tak og jevn finish",
        captionEn: "Home with a fully treated roof and an even finish",
      },
    ],
  },
];

async function count(table) {
  const res = await pool.query(`select count(*)::int as c from "${table}"`);
  return res.rows[0].c;
}

try {
  const settingsCount = await count("site_settings");
  if (settingsCount === 0) {
    await pool.query(
      `insert into site_settings (
        brand_name, phone, email, street, postal, city, org_nr, parent_org,
        hero_image_url, about_image_url, new_roof_image_url,
        calculator_new_roof_per_sqm, calculator_renewal_per_sqm,
        calculator_min_sqm, calculator_max_sqm, calculator_default_sqm,
        trust_sqm_renewed, trust_warranty_years, trust_happy_customers, trust_rating,
        created_at, updated_at
      ) values (
        'Takfornyelse', '+47 47 73 58 88', 'post@takfornyelse.as',
        'Lyngveien 28', '1182', 'Oslo', '916 693 168', 'Fornyelse Gruppen AS',
        $1, $2, $3,
        2500, 421.25, 50, 500, 150,
        '2.000.000+', 10, '100+', 'Google',
        now(), now()
      )`,
      [siteImages.hero, siteImages.about, siteImages.newRoof],
    );
    console.log("✓ Site Settings created");
  } else {
    await pool.query(
      `update site_settings set
        hero_image_url = coalesce(nullif(hero_image_url, ''), $1),
        about_image_url = coalesce(nullif(about_image_url, ''), $2),
        new_roof_image_url = coalesce(nullif(new_roof_image_url, ''), $3),
        updated_at = now()
      where id = (select id from site_settings order by id limit 1)`,
      [siteImages.hero, siteImages.about, siteImages.newRoof],
    );
    console.log("✓ Site Settings image URLs updated");
  }

  if ((await count("services")) === 0) {
    for (const [order, key] of serviceKeys.entries()) {
      const noItem = noMessages.services.items[key];
      const enItem = enMessages.services.items[key];
      await pool.query(
        `insert into services
          (key, title_no, title_en, description_no, description_en, icon, featured, "order", created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())`,
        [
          key,
          noItem.title,
          enItem.title,
          noItem.description,
          enItem.description,
          iconByKey[key] || "check",
          Boolean(noItem.featured),
          order,
        ],
      );
    }
    console.log(`✓ Seeded ${serviceKeys.length} services`);
  } else {
    console.log("· Services already present");
  }

  if ((await count("projects")) === 0) {
    for (const [order, project] of projects.entries()) {
      const inserted = await pool.query(
        `insert into projects (title_no, title_en, "order", created_at, updated_at)
         values ($1,$2,$3, now(), now()) returning id`,
        [project.titleNo, project.titleEn, order],
      );
      const projectId = inserted.rows[0].id;
      for (const [stageOrder, stage] of project.stages.entries()) {
        await pool.query(
          `insert into projects_stages
            (_order, _parent_id, id, label, caption_no, caption_en, image_url)
           values ($1,$2, gen_random_uuid()::text, $3,$4,$5,$6)`,
          [
            stageOrder,
            projectId,
            stage.label,
            stage.captionNo,
            stage.captionEn,
            stage.imageUrl,
          ],
        );
      }
    }
    console.log(`✓ Seeded ${projects.length} projects`);
  } else {
    console.log("· Projects already present");
  }

  if ((await count("products")) === 0) {
    for (const [order, product] of products.entries()) {
      const inserted = await pool.query(
        `insert into products
          (name, category_no, category_en, description_no, description_en, "order", created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6, now(), now()) returning id`,
        [
          product.name,
          product.categoryNo,
          product.categoryEn,
          product.descriptionNo,
          product.descriptionEn,
          order,
        ],
      );
      const productId = inserted.rows[0].id;
      for (const [i, label] of product.badgesNo.entries()) {
        await pool.query(
          `insert into products_badges_no (_order, _parent_id, id, label)
           values ($1,$2, gen_random_uuid()::text, $3)`,
          [i, productId, label],
        );
      }
      for (const [i, label] of product.badgesEn.entries()) {
        await pool.query(
          `insert into products_badges_en (_order, _parent_id, id, label)
           values ($1,$2, gen_random_uuid()::text, $3)`,
          [i, productId, label],
        );
      }
    }
    console.log(`✓ Seeded ${products.length} products`);
  } else {
    console.log("· Products already present");
  }

  if ((await count("faq")) === 0) {
    for (const [order, item] of faqItems.entries()) {
      await pool.query(
        `insert into faq
          (question_no, question_en, answer_no, answer_en, "order", created_at, updated_at)
         values ($1,$2,$3,$4,$5, now(), now())`,
        [item.questionNo, item.questionEn, item.answerNo, item.answerEn, order],
      );
    }
    console.log(`✓ Seeded ${faqItems.length} FAQ items`);
  } else {
    console.log("· FAQ already present");
  }

  console.log(
    "Done. Edit content in /admin → Site Settings, Services, Projects, Products, FAQ.",
  );
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
