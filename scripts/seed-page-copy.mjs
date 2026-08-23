/**
 * Seed Site Settings page-copy columns from no.json / en.json.
 * Usage: node --env-file=.env scripts/seed-page-copy.mjs
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { postgresSslOptions } from "./postgres-ssl.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const no = JSON.parse(readFileSync(join(root, "src/i18n/messages/no.json"), "utf8"));
const en = JSON.parse(readFileSync(join(root, "src/i18n/messages/en.json"), "utf8"));

const url = process.env.DATABASE_URL?.replace(/[&?]channel_binding=require/g, "");
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

function lines(arr) {
  return (arr || []).join("\n");
}

/** Flat column map matching Payload snake_case groups */
const data = {
  copy_meta_title_no: no.meta.title,
  copy_meta_title_en: en.meta.title,
  copy_meta_description_no: no.meta.description,
  copy_meta_description_en: en.meta.description,

  copy_nav_home_no: no.nav.home,
  copy_nav_home_en: en.nav.home,
  copy_nav_services_no: no.nav.services,
  copy_nav_services_en: en.nav.services,
  copy_nav_references_no: no.nav.references,
  copy_nav_references_en: en.nav.references,
  copy_nav_about_no: no.nav.about,
  copy_nav_about_en: en.nav.about,
  copy_nav_products_no: no.nav.products,
  copy_nav_products_en: en.nav.products,
  copy_nav_contact_no: no.nav.contact,
  copy_nav_contact_en: en.nav.contact,
  copy_nav_contact_us_no: no.nav.contactUs,
  copy_nav_contact_us_en: en.nav.contactUs,
  copy_nav_call_no: no.nav.call,
  copy_nav_call_en: en.nav.call,
  copy_nav_menu_no: no.nav.menu,
  copy_nav_menu_en: en.nav.menu,
  copy_nav_close_no: no.nav.close,
  copy_nav_close_en: en.nav.close,

  copy_hero_badge_no: no.hero.badge,
  copy_hero_badge_en: en.hero.badge,
  copy_hero_title_no: no.hero.title,
  copy_hero_title_en: en.hero.title,
  copy_hero_title_accent_no: no.hero.titleAccent,
  copy_hero_title_accent_en: en.hero.titleAccent,
  copy_hero_subtitle_no: no.hero.subtitle,
  copy_hero_subtitle_en: en.hero.subtitle,
  copy_hero_cta_no: no.hero.cta,
  copy_hero_cta_en: en.hero.cta,
  copy_hero_cta_secondary_no: no.hero.ctaSecondary,
  copy_hero_cta_secondary_en: en.hero.ctaSecondary,
  copy_hero_trust_warranty_no: no.hero.trustWarranty,
  copy_hero_trust_warranty_en: en.hero.trustWarranty,
  copy_hero_trust_customers_no: no.hero.trustCustomers,
  copy_hero_trust_customers_en: en.hero.trustCustomers,
  copy_hero_trust_rating_no: no.hero.trustRating,
  copy_hero_trust_rating_en: en.hero.trustRating,

  copy_sticky_call_no: no.sticky.call,
  copy_sticky_call_en: en.sticky.call,
  copy_sticky_book_no: no.sticky.book,
  copy_sticky_book_en: en.sticky.book,

  copy_trust_bar_items_no: lines(no.trustBar.items),
  copy_trust_bar_items_en: lines(en.trustBar.items),

  copy_services_eyebrow_no: no.services.eyebrow,
  copy_services_eyebrow_en: en.services.eyebrow,
  copy_services_title_no: no.services.title,
  copy_services_title_en: en.services.title,
  copy_services_subtitle_no: no.services.subtitle,
  copy_services_subtitle_en: en.services.subtitle,
  copy_services_show_more_no: no.services.showMore,
  copy_services_show_more_en: en.services.showMore,
  copy_services_show_less_no: no.services.showLess,
  copy_services_show_less_en: en.services.showLess,

  copy_calculator_eyebrow_no: no.calculator.eyebrow,
  copy_calculator_eyebrow_en: en.calculator.eyebrow,
  copy_calculator_title_no: no.calculator.title,
  copy_calculator_title_en: en.calculator.title,
  copy_calculator_subtitle_no: no.calculator.subtitle,
  copy_calculator_subtitle_en: en.calculator.subtitle,
  copy_calculator_hint_no: no.calculator.hint,
  copy_calculator_hint_en: en.calculator.hint,
  copy_calculator_size_label_no: no.calculator.sizeLabel,
  copy_calculator_size_label_en: en.calculator.sizeLabel,
  copy_calculator_new_roof_no: no.calculator.newRoof,
  copy_calculator_new_roof_en: en.calculator.newRoof,
  copy_calculator_renewal_no: no.calculator.renewal,
  copy_calculator_renewal_en: en.calculator.renewal,
  copy_calculator_you_save_no: no.calculator.youSave,
  copy_calculator_you_save_en: en.calculator.youSave,
  copy_calculator_cheaper_no: no.calculator.cheaper,
  copy_calculator_cheaper_en: en.calculator.cheaper,
  copy_calculator_disclaimer_no: no.calculator.disclaimer,
  copy_calculator_disclaimer_en: en.calculator.disclaimer,
  copy_calculator_cta_no: no.calculator.cta,
  copy_calculator_cta_en: en.calculator.cta,

  copy_references_eyebrow_no: no.references.eyebrow,
  copy_references_eyebrow_en: en.references.eyebrow,
  copy_references_title_no: no.references.title,
  copy_references_title_en: en.references.title,
  copy_references_subtitle_no: no.references.subtitle,
  copy_references_subtitle_en: en.references.subtitle,
  copy_references_note_no: no.references.note,
  copy_references_note_en: en.references.note,
  copy_references_before_no: no.references.before,
  copy_references_before_en: en.references.before,
  copy_references_during_no: no.references.during,
  copy_references_during_en: en.references.during,
  copy_references_after_no: no.references.after,
  copy_references_after_en: en.references.after,
  copy_references_swipe_no: no.references.swipe,
  copy_references_swipe_en: en.references.swipe,

  copy_products_eyebrow_no: no.products.eyebrow,
  copy_products_eyebrow_en: en.products.eyebrow,
  copy_products_title_no: no.products.title,
  copy_products_title_en: en.products.title,
  copy_products_subtitle_no: no.products.subtitle,
  copy_products_subtitle_en: en.products.subtitle,
  copy_products_footer_no: no.products.footer,
  copy_products_footer_en: en.products.footer,

  copy_faq_eyebrow_no: no.faq.eyebrow,
  copy_faq_eyebrow_en: en.faq.eyebrow,
  copy_faq_title_no: no.faq.title,
  copy_faq_title_en: en.faq.title,
  copy_faq_subtitle_no: no.faq.subtitle,
  copy_faq_subtitle_en: en.faq.subtitle,

  copy_testimonials_eyebrow_no: no.testimonials.eyebrow,
  copy_testimonials_eyebrow_en: en.testimonials.eyebrow,
  copy_testimonials_title_no: no.testimonials.title,
  copy_testimonials_title_en: en.testimonials.title,
  copy_testimonials_items_no: no.testimonials.items
    .map((i) => `${i.quote} | ${i.author} | ${i.service}`)
    .join("\n"),
  copy_testimonials_items_en: en.testimonials.items
    .map((i) => `${i.quote} | ${i.author} | ${i.service}`)
    .join("\n"),

  copy_new_roof_eyebrow_no: no.newRoof.eyebrow,
  copy_new_roof_eyebrow_en: en.newRoof.eyebrow,
  copy_new_roof_title_no: no.newRoof.title,
  copy_new_roof_title_en: en.newRoof.title,
  copy_new_roof_subtitle_no: no.newRoof.subtitle,
  copy_new_roof_subtitle_en: en.newRoof.subtitle,
  copy_new_roof_body_no: no.newRoof.body,
  copy_new_roof_body_en: en.newRoof.body,
  copy_new_roof_types_title_no: no.newRoof.typesTitle,
  copy_new_roof_types_title_en: en.newRoof.typesTitle,
  copy_new_roof_types_no: lines(no.newRoof.types),
  copy_new_roof_types_en: lines(en.newRoof.types),
  copy_new_roof_note_no: no.newRoof.note,
  copy_new_roof_note_en: en.newRoof.note,
  copy_new_roof_cta_no: no.newRoof.cta,
  copy_new_roof_cta_en: en.newRoof.cta,

  copy_about_eyebrow_no: no.about.eyebrow,
  copy_about_eyebrow_en: en.about.eyebrow,
  copy_about_title_no: no.about.title,
  copy_about_title_en: en.about.title,
  copy_about_subtitle_no: no.about.subtitle,
  copy_about_subtitle_en: en.about.subtitle,
  copy_about_p1_no: no.about.p1,
  copy_about_p1_en: en.about.p1,
  copy_about_p2_no: no.about.p2,
  copy_about_p2_en: en.about.p2,
  copy_about_p3_no: no.about.p3,
  copy_about_p3_en: en.about.p3,
  copy_about_parent_no: no.about.parent,
  copy_about_parent_en: en.about.parent,
  copy_about_cta_no: no.about.cta,
  copy_about_cta_en: en.about.cta,
  copy_about_stat1_title_no: no.about.stats.roofs,
  copy_about_stat1_title_en: en.about.stats.roofs,
  copy_about_stat1_desc_no: no.about.stats.roofsDesc,
  copy_about_stat1_desc_en: en.about.stats.roofsDesc,
  copy_about_stat2_title_no: no.about.stats.warranty,
  copy_about_stat2_title_en: en.about.stats.warranty,
  copy_about_stat2_desc_no: no.about.stats.warrantyDesc,
  copy_about_stat2_desc_en: en.about.stats.warrantyDesc,
  copy_about_stat3_title_no: no.about.stats.area,
  copy_about_stat3_title_en: en.about.stats.area,
  copy_about_stat3_desc_no: no.about.stats.areaDesc,
  copy_about_stat3_desc_en: en.about.stats.areaDesc,
  copy_about_stat4_title_no: no.about.stats.teams,
  copy_about_stat4_title_en: en.about.stats.teams,
  copy_about_stat4_desc_no: no.about.stats.teamsDesc,
  copy_about_stat4_desc_en: en.about.stats.teamsDesc,
  copy_about_company_title_no: no.about.company.title,
  copy_about_company_title_en: en.about.company.title,
  copy_about_company_org_no: no.about.company.org,
  copy_about_company_org_en: en.about.company.org,
  copy_about_company_phone_no: no.about.company.phone,
  copy_about_company_phone_en: en.about.company.phone,
  copy_about_company_email_no: no.about.company.email,
  copy_about_company_email_en: en.about.company.email,
  copy_about_company_address_no: no.about.company.address,
  copy_about_company_address_en: en.about.company.address,

  copy_contact_eyebrow_no: no.contact.eyebrow,
  copy_contact_eyebrow_en: en.contact.eyebrow,
  copy_contact_title_no: no.contact.title,
  copy_contact_title_en: en.contact.title,
  copy_contact_subtitle_no: no.contact.subtitle,
  copy_contact_subtitle_en: en.contact.subtitle,
  copy_contact_phone_no: no.contact.phone,
  copy_contact_phone_en: en.contact.phone,
  copy_contact_hours_no: no.contact.hours,
  copy_contact_hours_en: en.contact.hours,
  copy_contact_email_no: no.contact.email,
  copy_contact_email_en: en.contact.email,
  copy_contact_reply_no: no.contact.reply,
  copy_contact_reply_en: en.contact.reply,
  copy_contact_office_no: no.contact.office,
  copy_contact_office_en: en.contact.office,
  copy_contact_form_name_no: no.contact.form.name,
  copy_contact_form_name_en: en.contact.form.name,
  copy_contact_form_email_no: no.contact.form.email,
  copy_contact_form_email_en: en.contact.form.email,
  copy_contact_form_phone_no: no.contact.form.phone,
  copy_contact_form_phone_en: en.contact.form.phone,
  copy_contact_form_address_no: no.contact.form.address,
  copy_contact_form_address_en: en.contact.form.address,
  copy_contact_form_house_number_no: no.contact.form.houseNumber,
  copy_contact_form_house_number_en: en.contact.form.houseNumber,
  copy_contact_form_postal_no: no.contact.form.postal,
  copy_contact_form_postal_en: en.contact.form.postal,
  copy_contact_form_city_no: no.contact.form.city,
  copy_contact_form_city_en: en.contact.form.city,
  copy_contact_form_type_no: no.contact.form.type,
  copy_contact_form_type_en: en.contact.form.type,
  copy_contact_form_type_wash_no: no.contact.form.typeWash,
  copy_contact_form_type_wash_en: en.contact.form.typeWash,
  copy_contact_form_type_impregnation_no: no.contact.form.typeImpregnation,
  copy_contact_form_type_impregnation_en: en.contact.form.typeImpregnation,
  copy_contact_form_type_paint_no: no.contact.form.typePaint,
  copy_contact_form_type_paint_en: en.contact.form.typePaint,
  copy_contact_form_type_new_no: no.contact.form.typeNew,
  copy_contact_form_type_new_en: en.contact.form.typeNew,
  copy_contact_form_type_unsure_no: no.contact.form.typeUnsure,
  copy_contact_form_type_unsure_en: en.contact.form.typeUnsure,
  copy_contact_form_roof_size_no: no.contact.form.roofSize,
  copy_contact_form_roof_size_en: en.contact.form.roofSize,
  copy_contact_form_photos_no: no.contact.form.photos,
  copy_contact_form_photos_en: en.contact.form.photos,
  copy_contact_form_photos_hint_no: no.contact.form.photosHint,
  copy_contact_form_photos_hint_en: en.contact.form.photosHint,
  copy_contact_form_message_no: no.contact.form.message,
  copy_contact_form_message_en: en.contact.form.message,
  copy_contact_form_next_no: no.contact.form.next,
  copy_contact_form_next_en: en.contact.form.next,
  copy_contact_form_back_no: no.contact.form.back,
  copy_contact_form_back_en: en.contact.form.back,
  copy_contact_form_step_no: no.contact.form.step,
  copy_contact_form_step_en: en.contact.form.step,
  copy_contact_form_submit_no: no.contact.form.submit,
  copy_contact_form_submit_en: en.contact.form.submit,
  copy_contact_form_sending_no: no.contact.form.sending,
  copy_contact_form_sending_en: en.contact.form.sending,
  copy_contact_form_success_no: no.contact.form.success,
  copy_contact_form_success_en: en.contact.form.success,
  copy_contact_form_error_no: no.contact.form.error,
  copy_contact_form_error_en: en.contact.form.error,
  copy_contact_form_required_no: no.contact.form.required,
  copy_contact_form_required_en: en.contact.form.required,
  copy_contact_form_invalid_email_no: no.contact.form.invalidEmail,
  copy_contact_form_invalid_email_en: en.contact.form.invalidEmail,

  copy_footer_tagline_no: no.footer.tagline,
  copy_footer_tagline_en: en.footer.tagline,
  copy_footer_part_of_no: no.footer.partOf,
  copy_footer_part_of_en: en.footer.partOf,
  copy_footer_quick_links_no: no.footer.quickLinks,
  copy_footer_quick_links_en: en.footer.quickLinks,
  copy_footer_contact_no: no.footer.contact,
  copy_footer_contact_en: en.footer.contact,
  copy_footer_warranty_note_no: no.footer.warrantyNote,
  copy_footer_warranty_note_en: en.footer.warrantyNote,
  copy_footer_rights_no: no.footer.rights,
  copy_footer_rights_en: en.footer.rights,
};

try {
  const cols = Object.keys(data);
  const sets = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
  const values = cols.map((c) => data[c]);

  const result = await pool.query(
    `update site_settings set ${sets}, updated_at = now()
     where id = (select id from site_settings order by id limit 1)
     returning id, copy_meta_title_no`,
    values,
  );

  if (!result.rowCount) {
    console.error("No site_settings row to update. Run db:seed first.");
    process.exitCode = 1;
  } else {
    console.log("✓ Page copy seeded:", result.rows[0]);
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
