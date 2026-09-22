# Takfornyelsenorge.no – Google migration and launch checklist

## 1. Publish and verify

1. Verify the serving source and use the approved release candidate. Follow the project's Production approval and Preview verification workflow.
2. Set `NEXT_PUBLIC_SITE_URL=https://takfornyelsenorge.no` and `PUBLIC_HOST_REDIRECTS_ENABLED=true` at build and runtime. Persist these public values in the Production project so later builds retain them.
3. Build with the established guarded deployment command. Do not run database migrations implicitly as part of a domain-only correction.
4. Smoke-test `/no`, `/no/takvask`, `/no/takfornying-viken`, `/no/priser`, `/robots.txt` and `/sitemap.xml`.
5. Verify that legacy public hosts and the new `www` host permanently redirect to `https://takfornyelsenorge.no`, preserving the corresponding path and query. Verify protected operational routes separately.
6. Inspect the served HTML, not only the code: canonical, language alternates, social/structured URLs, robots and every sitemap entry must use the new origin. Verify both static pages and published CMS content.

## 2. Google Search Console

Preferred verification is a Domain property using a DNS TXT record. If URL-prefix verification is used instead, set:

```text
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<Google verification token only>
```

After verification:

1. Use the verified `sc-domain:takfornyelsenorge.no` property and submit `https://takfornyelsenorge.no/sitemap.xml` after its entries use the new domain.
2. Inspect and request indexing for the Norwegian priority pages.
3. Check Page indexing, HTTPS and Core Web Vitals reports weekly for the first month.
4. Record queries where the site ranks 5–20 and improve those pages first.
5. Once permanent redirects and ownership pass, complete Google's Change of Address for each relevant legacy hostname property. Retain technical ownership and redirects for the migration period; the old origin must not appear in current advertising.

## 3. Google Ads measurement

Keep the existing measurement property/stream and successful-enquiry actions where they represent the same business result. Verify the intended primary conversion so an imported GA4 event and a native Ads action do not count the same enquiry twice. Set the verified account values in the hosting environment:

```text
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL=XXXXXXXXXXXX
```

The Google tag loads only after the visitor accepts optional advertising measurement. UTM parameters, Google/Meta/Microsoft click IDs, landing page and referrer are also stored with the submitted lead for CRM reconciliation. The existing consent component can also enable Meta Pixel when `NEXT_PUBLIC_META_PIXEL_ID` is configured.

Update the existing GA4 stream URL/name to the new domain. Inspect URL-based conversion conditions separately from their names. For Meta, an old-domain custom conversion may need a replacement rule on the existing dataset and an explicit ad-set selection; a renamed label alone is not a migration.

Verify consent, accepted/rejected form responses, confirmation-page recovery and attribution across navigation in an isolated Preview. Do not send synthetic leads to Production or deliver test conversions without a controlled verification plan. Record actual platform reception separately from source-level tests. Preserve campaign budgets, targeting and enabled/paused states during migration.

## 4. Search campaign destinations

Continue the existing campaigns assigned to this website. The following are service-to-page references, not instructions to create replacement campaigns or alter existing targeting during migration.

- Locations: Oslo, Akershus/selected Viken markets and other confirmed service areas only.
- Location option: people in or regularly in the targeted locations.
- Networks: Google Search only at launch.
- Goal: qualified enquiry, not traffic.
- Final URLs must point directly to `https://takfornyelsenorge.no` and match search intent. Inspect ad/keyword/mobile overrides, sitelinks, tracking templates, URL suffixes, custom parameters and Performance Max asset groups/URL expansion/page feeds. Include paused advertisements and relevant drafts.

### Ad groups and landing pages

| Ad group            | Initial exact/phrase themes                           | Landing page                                 |
| ------------------- | ----------------------------------------------------- | -------------------------------------------- |
| Takvask             | takvask pris, takvask Oslo, vaske takstein            | `/no/takvask` or `/no/takvask-oslo`          |
| Vask + impregnering | takvask og impregnering, impregnering takstein        | `/no/takvask-og-impregnering`                |
| Takmaling           | takmaling pris, maling av takstein, takmaling Drammen | `/no/takmaling` or `/no/takmaling-drammen`   |
| Takfornying         | takfornying pris, takfornyelse, takfornying Viken     | `/no/takfornying` or `/no/takfornying-viken` |
| Nytt tak            | nytt tak pris, bytte tak, legge nytt tak              | `/no/nytt-tak`                               |

### Starting negative keywords

Add after checking actual search terms:

- jobb, stilling, lønn, kurs, utdanning
- gjør det selv, hvordan selv, utleie
- brukt, gratis, produktark, datablad
- bil, båt, campingvogn
- takboks, takstativ

Do not exclude informational terms blindly when they can lead to a qualified homeowner enquiry.

## 5. Google Business Profile

1. Verify the correct legal business and primary category.
2. Use the same phone, website, opening hours and service area as the website.
3. Add real project photos with customer permission; do not publish exact private addresses.
4. Ask every completed customer for an honest Google review.
5. Reply to every review in natural Norwegian.
6. Link service posts to the closest relevant landing page with UTM parameters.

## 6. Weekly SEO routine

- Review Search Console clicks, impressions, CTR and positions by page and query.
- Review index coverage and sitemap status.
- Add one documented project or useful article, based on real work and customer questions.
- Reconcile Google Ads conversions against qualified leads and booked inspections.
- Pause keywords that generate irrelevant enquiries; do not optimize toward cheap but poor-quality forms.
- Expand location pages only when unique local proof, service information or project content is available.
