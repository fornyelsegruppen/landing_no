import * as migration_20260727_000000_baseline from "./20260727_000000_baseline";
import * as migration_20260727_120000_privacy_consent from "./20260727_120000_privacy_consent";
import * as migration_20260727_130000_admin_powers from "./20260727_130000_admin_powers";
import * as migration_20260727_140000_drafts_roles from "./20260727_140000_drafts_roles";
import * as migration_20260727_150000_pages_posts_redirects from "./20260727_150000_pages_posts_redirects";
import * as migration_20260813_120000_contact_choice from "./20260813_120000_contact_choice";
import * as migration_20260814_120000_update_service_prices from "./20260814_120000_update_service_prices";
import * as migration_20260815_120000_lead_attribution from "./20260815_120000_lead_attribution";
import * as migration_20260820_120000_align_marketing_claims from "./20260820_120000_align_marketing_claims";
import * as migration_20260820_210000_correct_calculator_prices from "./20260820_210000_correct_calculator_prices";
import * as migration_20260823_135227_phase1_platform_foundation from "./20260823_135227_phase1_platform_foundation";
import * as migration_20260823_142839_phase2_accounts_worker_shell from "./20260823_142839_phase2_accounts_worker_shell";
import * as migration_20260823_143838_phase2_default_worker_role from "./20260823_143838_phase2_default_worker_role";
import * as migration_20260823_150443_phase3_blog_foundation from "./20260823_150443_phase3_blog_foundation";
import * as migration_20260823_160853_phase4_ai_content_engine from "./20260823_160853_phase4_ai_content_engine";
import * as migration_20260823_163755_phase5_lead_inbox_messages from "./20260823_163755_phase5_lead_inbox_messages";
import * as migration_20260823_171411_phase6_measurement_pricing from "./20260823_171411_phase6_measurement_pricing";
import * as migration_20260823_172422_phase6_measurement_license_evidence from "./20260823_172422_phase6_measurement_license_evidence";
import * as migration_20260823_173944_phase7_quotes_contracts from "./20260823_173944_phase7_quotes_contracts";
import * as migration_20260823_175110_phase7_message_attachments from "./20260823_175110_phase7_message_attachments";
import * as migration_20260823_182703_phase8_work_orders from "./20260823_182703_phase8_work_orders";
import * as migration_20260823_194404_phase9_change_agreements_communications from "./20260823_194404_phase9_change_agreements_communications";
import * as migration_20260823_200533_phase10_content_measurement_hardening from "./20260823_200533_phase10_content_measurement_hardening";
import * as migration_20260824_082135_phase11_stock_images from "./20260824_082135_phase11_stock_images";
import * as migration_20260824_094425_phase11_stock_image_fallback from "./20260824_094425_phase11_stock_image_fallback";
import * as migration_20260824_130000_phase12_panel_languages from "./20260824_130000_phase12_panel_languages";
import * as migration_20260825_120000_contract_counter_signatures from "./20260825_120000_contract_counter_signatures";
import * as migration_20260825_150000_admin_work_scheduling from "./20260825_150000_admin_work_scheduling";
import * as migration_20260825_170000_commercial_quote_options from "./20260825_170000_commercial_quote_options";
import * as migration_20260825_190000_completion_invoice_warranty from "./20260825_190000_completion_invoice_warranty";
import * as migration_20260825_210000_lead_archive_trash from "./20260825_210000_lead_archive_trash";
import * as migration_20260825_220000_case_state_engine from "./20260825_220000_case_state_engine";
import * as migration_20260825_230000_measurement_evidence from "./20260825_230000_measurement_evidence";
import * as migration_20260825_235000_admin_operations from "./20260825_235000_admin_operations";
import * as migration_20260825_235100_admin_review_backfill from "./20260825_235100_admin_review_backfill";

export const migrations = [
  {
    up: migration_20260727_000000_baseline.up,
    down: migration_20260727_000000_baseline.down,
    name: "20260727_000000_baseline",
  },
  {
    up: migration_20260727_120000_privacy_consent.up,
    down: migration_20260727_120000_privacy_consent.down,
    name: "20260727_120000_privacy_consent",
  },
  {
    up: migration_20260727_130000_admin_powers.up,
    down: migration_20260727_130000_admin_powers.down,
    name: "20260727_130000_admin_powers",
  },
  {
    up: migration_20260727_140000_drafts_roles.up,
    down: migration_20260727_140000_drafts_roles.down,
    name: "20260727_140000_drafts_roles",
  },
  {
    up: migration_20260727_150000_pages_posts_redirects.up,
    down: migration_20260727_150000_pages_posts_redirects.down,
    name: "20260727_150000_pages_posts_redirects",
  },
  {
    up: migration_20260813_120000_contact_choice.up,
    down: migration_20260813_120000_contact_choice.down,
    name: "20260813_120000_contact_choice",
  },
  {
    up: migration_20260814_120000_update_service_prices.up,
    down: migration_20260814_120000_update_service_prices.down,
    name: "20260814_120000_update_service_prices",
  },
  {
    up: migration_20260815_120000_lead_attribution.up,
    down: migration_20260815_120000_lead_attribution.down,
    name: "20260815_120000_lead_attribution",
  },
  {
    up: migration_20260820_120000_align_marketing_claims.up,
    down: migration_20260820_120000_align_marketing_claims.down,
    name: "20260820_120000_align_marketing_claims",
  },
  {
    up: migration_20260820_210000_correct_calculator_prices.up,
    down: migration_20260820_210000_correct_calculator_prices.down,
    name: "20260820_210000_correct_calculator_prices",
  },
  {
    up: migration_20260823_135227_phase1_platform_foundation.up,
    down: migration_20260823_135227_phase1_platform_foundation.down,
    name: "20260823_135227_phase1_platform_foundation",
  },
  {
    up: migration_20260823_142839_phase2_accounts_worker_shell.up,
    down: migration_20260823_142839_phase2_accounts_worker_shell.down,
    name: "20260823_142839_phase2_accounts_worker_shell",
  },
  {
    up: migration_20260823_143838_phase2_default_worker_role.up,
    down: migration_20260823_143838_phase2_default_worker_role.down,
    name: "20260823_143838_phase2_default_worker_role",
  },
  {
    up: migration_20260823_150443_phase3_blog_foundation.up,
    down: migration_20260823_150443_phase3_blog_foundation.down,
    name: "20260823_150443_phase3_blog_foundation",
  },
  {
    up: migration_20260823_160853_phase4_ai_content_engine.up,
    down: migration_20260823_160853_phase4_ai_content_engine.down,
    name: "20260823_160853_phase4_ai_content_engine",
  },
  {
    up: migration_20260823_163755_phase5_lead_inbox_messages.up,
    down: migration_20260823_163755_phase5_lead_inbox_messages.down,
    name: "20260823_163755_phase5_lead_inbox_messages",
  },
  {
    up: migration_20260823_171411_phase6_measurement_pricing.up,
    down: migration_20260823_171411_phase6_measurement_pricing.down,
    name: "20260823_171411_phase6_measurement_pricing",
  },
  {
    up: migration_20260823_172422_phase6_measurement_license_evidence.up,
    down: migration_20260823_172422_phase6_measurement_license_evidence.down,
    name: "20260823_172422_phase6_measurement_license_evidence",
  },
  {
    up: migration_20260823_173944_phase7_quotes_contracts.up,
    down: migration_20260823_173944_phase7_quotes_contracts.down,
    name: "20260823_173944_phase7_quotes_contracts",
  },
  {
    up: migration_20260823_175110_phase7_message_attachments.up,
    down: migration_20260823_175110_phase7_message_attachments.down,
    name: "20260823_175110_phase7_message_attachments",
  },
  {
    up: migration_20260823_182703_phase8_work_orders.up,
    down: migration_20260823_182703_phase8_work_orders.down,
    name: "20260823_182703_phase8_work_orders",
  },
  {
    up: migration_20260823_194404_phase9_change_agreements_communications.up,
    down: migration_20260823_194404_phase9_change_agreements_communications.down,
    name: "20260823_194404_phase9_change_agreements_communications",
  },
  {
    up: migration_20260823_200533_phase10_content_measurement_hardening.up,
    down: migration_20260823_200533_phase10_content_measurement_hardening.down,
    name: "20260823_200533_phase10_content_measurement_hardening",
  },
  {
    up: migration_20260824_082135_phase11_stock_images.up,
    down: migration_20260824_082135_phase11_stock_images.down,
    name: "20260824_082135_phase11_stock_images",
  },
  {
    up: migration_20260824_094425_phase11_stock_image_fallback.up,
    down: migration_20260824_094425_phase11_stock_image_fallback.down,
    name: "20260824_094425_phase11_stock_image_fallback",
  },
  {
    up: migration_20260824_130000_phase12_panel_languages.up,
    down: migration_20260824_130000_phase12_panel_languages.down,
    name: "20260824_130000_phase12_panel_languages",
  },
  {
    up: migration_20260825_120000_contract_counter_signatures.up,
    down: migration_20260825_120000_contract_counter_signatures.down,
    name: "20260825_120000_contract_counter_signatures",
  },
  {
    up: migration_20260825_150000_admin_work_scheduling.up,
    down: migration_20260825_150000_admin_work_scheduling.down,
    name: "20260825_150000_admin_work_scheduling",
  },
  {
    up: migration_20260825_170000_commercial_quote_options.up,
    down: migration_20260825_170000_commercial_quote_options.down,
    name: "20260825_170000_commercial_quote_options",
  },
  {
    up: migration_20260825_190000_completion_invoice_warranty.up,
    down: migration_20260825_190000_completion_invoice_warranty.down,
    name: "20260825_190000_completion_invoice_warranty",
  },
  {
    up: migration_20260825_210000_lead_archive_trash.up,
    down: migration_20260825_210000_lead_archive_trash.down,
    name: "20260825_210000_lead_archive_trash",
  },
  {
    up: migration_20260825_220000_case_state_engine.up,
    down: migration_20260825_220000_case_state_engine.down,
    name: "20260825_220000_case_state_engine",
  },
  {
    up: migration_20260825_230000_measurement_evidence.up,
    down: migration_20260825_230000_measurement_evidence.down,
    name: "20260825_230000_measurement_evidence",
  },
  {
    up: migration_20260825_235000_admin_operations.up,
    down: migration_20260825_235000_admin_operations.down,
    name: "20260825_235000_admin_operations",
  },
  {
    up: migration_20260825_235100_admin_review_backfill.up,
    down: migration_20260825_235100_admin_review_backfill.down,
    name: "20260825_235100_admin_review_backfill",
  },
];
