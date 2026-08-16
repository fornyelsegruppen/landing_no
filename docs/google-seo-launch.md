# Takfornyelse.as – Google launch checklist

## 1. Publish and verify

1. Deploy the current `main` branch to the production project.
2. Confirm `NEXT_PUBLIC_SITE_URL=https://takfornyelse.as`.
3. Apply the Payload migration `20260815_000000_lead_attribution` during deployment.
4. Smoke-test `/no`, `/no/takvask`, `/no/takfornying-viken`, `/no/priser`, `/robots.txt` and `/sitemap.xml`.
5. Confirm that both `https://takfornyelse.as` and `https://www.takfornyelse.as` resolve to one canonical host.

## 2. Google Search Console

Preferred verification is a Domain property using a DNS TXT record. If URL-prefix verification is used instead, set:

```text
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<Google verification token only>
```

After verification:

1. Submit `https://takfornyelse.as/sitemap.xml`.
2. Inspect and request indexing for the Norwegian priority pages.
3. Check Page indexing, HTTPS and Core Web Vitals reports weekly for the first month.
4. Record queries where the site ranks 5–20 and improve those pages first.

## 3. Google Ads measurement

Create one primary website conversion for a successfully submitted enquiry. Set the verified values in the hosting environment:

```text
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL=XXXXXXXXXXXX
```

The Google tag loads only after the visitor accepts optional advertising measurement. UTM parameters, `gclid`, `fbclid`, landing page and referring domain are also stored with the submitted lead for CRM reconciliation.

Do not activate bidding until a test lead appears both in Payload and Google Ads diagnostics.

## 4. Initial Search campaign

Campaign: `NO | Search | Takfornyelse | Priority regions`

- Locations: Oslo, Akershus/selected Viken markets and other confirmed service areas only.
- Location option: people in or regularly in the targeted locations.
- Networks: Google Search only at launch.
- Goal: qualified enquiry, not traffic.
- Final URLs must match the search intent.

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
