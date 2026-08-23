import * as migration_20260727_000000_baseline from './20260727_000000_baseline';
import * as migration_20260727_120000_privacy_consent from './20260727_120000_privacy_consent';
import * as migration_20260727_130000_admin_powers from './20260727_130000_admin_powers';
import * as migration_20260727_140000_drafts_roles from './20260727_140000_drafts_roles';
import * as migration_20260727_150000_pages_posts_redirects from './20260727_150000_pages_posts_redirects';
import * as migration_20260813_120000_contact_choice from './20260813_120000_contact_choice';
import * as migration_20260814_120000_update_service_prices from './20260814_120000_update_service_prices';
import * as migration_20260815_120000_lead_attribution from './20260815_120000_lead_attribution';
import * as migration_20260820_120000_align_marketing_claims from './20260820_120000_align_marketing_claims';
import * as migration_20260820_210000_correct_calculator_prices from './20260820_210000_correct_calculator_prices';
import * as migration_20260823_135227_phase1_platform_foundation from './20260823_135227_phase1_platform_foundation';
import * as migration_20260823_142839_phase2_accounts_worker_shell from './20260823_142839_phase2_accounts_worker_shell';
import * as migration_20260823_143838_phase2_default_worker_role from './20260823_143838_phase2_default_worker_role';

export const migrations = [
  {
    up: migration_20260727_000000_baseline.up,
    down: migration_20260727_000000_baseline.down,
    name: '20260727_000000_baseline',
  },
  {
    up: migration_20260727_120000_privacy_consent.up,
    down: migration_20260727_120000_privacy_consent.down,
    name: '20260727_120000_privacy_consent',
  },
  {
    up: migration_20260727_130000_admin_powers.up,
    down: migration_20260727_130000_admin_powers.down,
    name: '20260727_130000_admin_powers',
  },
  {
    up: migration_20260727_140000_drafts_roles.up,
    down: migration_20260727_140000_drafts_roles.down,
    name: '20260727_140000_drafts_roles',
  },
  {
    up: migration_20260727_150000_pages_posts_redirects.up,
    down: migration_20260727_150000_pages_posts_redirects.down,
    name: '20260727_150000_pages_posts_redirects',
  },
  {
    up: migration_20260813_120000_contact_choice.up,
    down: migration_20260813_120000_contact_choice.down,
    name: '20260813_120000_contact_choice',
  },
  {
    up: migration_20260814_120000_update_service_prices.up,
    down: migration_20260814_120000_update_service_prices.down,
    name: '20260814_120000_update_service_prices',
  },
  {
    up: migration_20260815_120000_lead_attribution.up,
    down: migration_20260815_120000_lead_attribution.down,
    name: '20260815_120000_lead_attribution',
  },
  {
    up: migration_20260820_120000_align_marketing_claims.up,
    down: migration_20260820_120000_align_marketing_claims.down,
    name: '20260820_120000_align_marketing_claims',
  },
  {
    up: migration_20260820_210000_correct_calculator_prices.up,
    down: migration_20260820_210000_correct_calculator_prices.down,
    name: '20260820_210000_correct_calculator_prices',
  },
  {
    up: migration_20260823_135227_phase1_platform_foundation.up,
    down: migration_20260823_135227_phase1_platform_foundation.down,
    name: '20260823_135227_phase1_platform_foundation',
  },
  {
    up: migration_20260823_142839_phase2_accounts_worker_shell.up,
    down: migration_20260823_142839_phase2_accounts_worker_shell.down,
    name: '20260823_142839_phase2_accounts_worker_shell',
  },
  {
    up: migration_20260823_143838_phase2_default_worker_role.up,
    down: migration_20260823_143838_phase2_default_worker_role.down,
    name: '20260823_143838_phase2_default_worker_role'
  },
];
