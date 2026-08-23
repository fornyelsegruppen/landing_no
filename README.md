# Takfornying

Premium bilingual (Norwegian / English) roof-renewal marketing site with Payload CMS, built for self-hosting and future AI agent integrations.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **next-intl** — `/no` and `/en`
- **Tailwind CSS 4** + custom design tokens
- **Payload CMS 3** + PostgreSQL — content admin + leads
- **Resend** (optional) — lead email notifications
- **Docker Compose** — portable deploy anywhere

## Quick start (local)

### 1. Environment

```bash
cp .env.example .env
```

### 2. Database

**Local (default):** SQLite via `DATABASE_URL=file:./takfornying.db` — no Docker required.

**Production / optional Postgres:**

```bash
# in .env
DATABASE_URL=postgres://payload:payload@127.0.0.1:5432/takfornying
docker compose up -d db
```

### 3. Install & run

```bash
npm install --legacy-peer-deps
npm run dev
```

- Site: [http://localhost:3000/no](http://localhost:3000/no)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin) (create first user on first visit)

### 4. Optional email

Set `RESEND_API_KEY`, `LEAD_FROM_EMAIL`, and `LEAD_TO_EMAIL` in `.env`. Without Resend, leads are still stored in Payload (when DB is up) and logged to the server console.

## Production (Docker)

```bash
export PAYLOAD_SECRET="$(openssl rand -hex 32)"
export NEXT_PUBLIC_SITE_URL="https://your-domain.no"
docker compose up -d --build
```

The app image is **standalone** Next.js output — runs on any Node/Docker host (VPS, Hetzner, AWS, client server). Not locked to Vercel.

## Database migrations

Schema changes go through **versioned Payload migrations** in
`src/payload/migrations/` (not ad-hoc `ensure-*.mjs` scripts).

| Command | Purpose |
|---|---|
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:migrate:status` | Show applied / pending migrations |
| `npm run db:migrate:baseline` | Regenerate baseline snapshot (rare) |

`npm run build` runs migrations automatically before `next build` (Vercel /
Docker). For local SQLite (`file:./…`), the migrate step is a no-op when the
Postgres adapter is not in use.

### Neon staging branch (recommended before production)

1. In the Neon console, create a **branch** from production (e.g. `staging`).
2. Copy the branch connection string into a local override:

```bash
# .env.staging (do not commit)
DATABASE_URL=postgres://…@ep-staging-….neon.tech/neondb?sslmode=require
```

3. Apply migrations there first:

```bash
node --env-file=.env.staging scripts/run-migrate.mjs
node --env-file=.env.staging scripts/run-migrate-status.mjs
```

4. Smoke-test `/admin` and the public site against the branch, then deploy to
   production (build will migrate production automatically).

Emergency fallbacks (`db:ensure`, `db:ensure-copy`, `db:push`,
`scripts/migrate-leads-columns.mjs`) are **deprecated** — use only if a
migration was missed and production is missing columns.

### Content pages & blog

- **Pages** — create in Admin → Pages, set slug (e.g. `garanti`), publish. URL: `/no/garanti`.
- **Posts** — Admin → Posts, publish. Listed at `/no/blogg`, post at `/no/blogg/[slug]`.
- **Redirects** — Admin → Redirects (`fromPath` → `toPath` or external `toUrl`). Resolved when visiting CMS page/blog routes.
- Add `/blogg` or page slugs to the menu via Site Settings → Navigation (menu builder).

Reserved page slugs: `blogg`, `personvern`.

## Content & CMS

| Collection / Global | Purpose |
|---|---|
| Services | Service cards (NO/EN) |
| Projects | Before/after references |
| Products | Product cards |
| FAQ | Accordion + JSON-LD |
| Pages | Extra marketing pages (`/[locale]/[slug]`) |
| Posts | Blog posts (`/[locale]/blogg/[slug]`) |
| Redirects | 308/307 redirects for old paths |
| Leads | Contact form submissions |
| Site settings | Phone, address, calculator rates, trust stats, privacy, nav, logo |

Marketing copy for the UI shell lives in:

- `src/i18n/messages/no.json`
- `src/i18n/messages/en.json`

Structured content defaults live in `src/content/site-content.ts` (used when CMS is empty / offline).

## Contact form / API

`POST /api/lead` validates with Zod, rate-limits, honeypot-checks, writes to Payload `leads`, and optionally emails via Resend.

Future AI agents can plug into the same route or Payload hooks without redesigning the frontend.

## Project structure

```
src/
  app/(site)/[locale]/   # Public landing
  app/(payload)/         # Admin + Payload REST
  app/api/lead/          # Lead intake
  components/            # Layout + sections + UI
  content/               # Static fallback content
  i18n/                  # Routing + messages
  payload/               # Collections + config
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript checks without emitting files |
| `npm test` | Run the Vitest unit suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run the Chromium landing-page smoke test |
| `npm run db:migrate` | Apply pending Postgres migrations |
| `npm run db:migrate:status` | Show applied vs filesystem migrations |
| `npm run db:migrate:baseline` | Regenerate baseline drizzle snapshot (rare) |
| `npm run generate:types` | Payload TypeScript types |
| `npm run generate:importmap` | Payload admin import map |

## Testing and dependencies

Install the Playwright browser separately (CI does this without committing browser
binaries):

```bash
npx playwright install chromium
npm run test:e2e
```

Locally, Playwright reuses a server on port 3000 or starts `npm run dev`. In CI,
its web server builds and starts the production app with an isolated SQLite
database.

`package-lock.json` pins the resolved dependency graph; CI uses
`npm ci --legacy-peer-deps` for reproducible installs. Semver ranges in
`package.json` are kept intentionally because the Payload packages have a linked
peer-dependency ecosystem. Dependabot proposes weekly updates for review rather
than mass-pinning or automatically forcing upgrades.

## Notes

- Mobile-first: sticky call/book bar, compact hero, progressive contact form, swipeable references.
- Brand assets: replace Unsplash hero and placeholder project gradients with client photos via Media in Payload.
- Do not commit real secrets; use `.env` locally and host secrets in production.

## Planning documents

- [Full platform implementation master plan](docs/full-platform-implementation-master-plan.md)
- [Pre-implementation backup and recovery manifest](docs/pre-master-backup-2026-08-23.md)
- [AI-assisted SEO blog roadmap](docs/seo-blog-automation-roadmap.md)
- [Simplified admin and worker panel roadmap](docs/takfornyelse-admin-user-panel-roadmap.md)
