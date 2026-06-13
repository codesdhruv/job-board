# SarkariNaukriBoard — Project Context

Indian job board for Government, PSU/Semi-Govt, Private, and Freelance/Gig sectors. Deployed on Cloudflare Workers + Pages. Primary differentiators: first-class state-level filtering (not offered by SarkariResult or Talentd), `JobPosting` JSON-LD for Google Jobs rich results, and a clean card-based mobile-first UI.

Full technical spec: `.claude/specs/01-job-board-specdoc.md`
Full feature spec: `.claude/specs/02-job-board-feature-spec.md`
Design system reference: `DESIGN.md`

---

## Current state

Boilerplate only. `src/pages/index.astro` is the default Astro welcome page. No database bindings, no components, no features built.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Astro 6.4.6 (SSR mode via `output: 'server'`) |
| Adapter | `@astrojs/cloudflare` |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) — binding name `DB` |
| Cache | Cloudflare KV — binding name `KV` |
| Assets | Cloudflare R2 — binding name `R2` |
| CLI | Wrangler 4.x |
| Node | >=22.12.0 |

Config file is `wrangler.jsonc` (not `.toml`). D1, KV, and R2 bindings are not yet wired into it — they need to be added before any DB work.

---

## Commands

```bash
npm run dev            # local dev server
npm run build          # production build
npm run preview        # preview built output
npm run generate-types # wrangler types (generates CF bindings types)
npx wrangler dev       # alternative local dev with Workers emulation
npx wrangler d1 execute job-board-db --file=./schema.sql  # run migrations
npx wrangler deploy    # deploy to Cloudflare
```

---

## Planned project structure

```
src/
  pages/
    index.astro                 # Homepage
    jobs/
      index.astro               # All jobs listing + filters
      [slug].astro              # Job detail page + JSON-LD
    category/[slug].astro       # Jobs by category
    state/
      index.astro               # /states — browse all states
      [slug].astro              # All jobs in a state
      [slug]/
        government.astro        # Govt jobs in a state
        psu.astro               # PSU jobs in a state
    sitemap.xml.ts
    rss.xml.ts
    admin/
      login.astro
      dashboard.astro
      jobs/
        index.astro             # Admin job list
        new.astro               # Post new job
        [id]/edit.astro         # Edit job
  components/
    JobCard.astro
    JobFilters.astro
    Pagination.astro
    AdminJobRow.astro
    JsonLd.astro
  layouts/
    BaseLayout.astro            # Public layout (nav, head, footer)
    AdminLayout.astro           # Admin layout (sidebar, auth guard)
  lib/
    db.ts                       # D1 query helpers
    auth.ts                     # Cookie session auth (HMAC-SHA256)
    kv.ts                       # KV cache read/write helpers
    seo.ts                      # Meta tag + JSON-LD builders
  middleware/
    index.ts                    # Auth guard for /admin/* routes
public/
  robots.txt
```

---

## Database schema

### `job_types`
`id`, `name`, `slug` — seed: Government, PSU/Semi-Govt, Private, Freelance/Gig

### `states`
`id`, `name`, `slug`, `is_union_territory` — 28 states + 8 UTs + "All India" (for central govt jobs)

### `categories`
`id`, `name`, `slug` — e.g. Engineering, Teaching, Banking, IT, Medical, Defence

### `departments`
`id`, `name`, `logo_r2_key` — e.g. UPSC, SSC, DRDO, Infosys

### `jobs` (core table)
`id`, `slug` (unique URL key), `title`, `department_id`, `job_type_id`, `category_id`, `state_id`, `location`, `vacancies`, `qualification`, `age_limit`, `salary`, `last_date` (required), `apply_url`, `apply_email`, `description`, `is_published` (default 1), `created_at`, `updated_at`

Indexes: `job_type_id`, `category_id`, `state_id`, `last_date`, `is_published`, composite `(job_type_id, state_id)`

### `admins`
`id`, `username`, `password_hash` (bcrypt cost 12), `created_at`

---

## Environment variables

| Variable | Purpose |
|---|---|
| `ADMIN_SECRET` | Signs/verifies session cookie (HMAC-SHA256) |
| `SITE_URL` | Base URL for canonical tags and sitemap |

Set in Cloudflare dashboard → Workers → Settings → Variables.

---

## Features (F-01 to F-24)

### Phase 2 — Public pages
- **F-01** Job listing page (`/jobs`) — paginated, 4 filters, 20/page
- **F-02** Job detail page (`/jobs/[slug]`) — full info, apply button, JSON-LD, similar jobs sidebar
- **F-03** Job type filter tabs — All / Government / PSU / Private / Freelance; preserve other params on switch
- **F-04** State filter — `<select>` with `<optgroup>` (States / UTs); promoted to first position when type=Govt or PSU; "All India" always first
- **F-05** Category filter dropdown
- **F-06** Keyword search — searches `jobs.title` and `departments.name`; parameterised queries only
- **F-07** State index page (`/states`) — grid of all 36 states/UTs with job counts
- **F-08** State jobs pages — `/state/[slug]`, `/state/[slug]/government`, `/state/[slug]/psu`
- **F-09** Category jobs page (`/category/[slug]`)
- **F-10** Homepage — hero search, job type cards, latest 10 jobs, featured states, category links
- **F-20** Pagination — 20/page public, 50/page admin; preserves all filter params

### Phase 3 — Admin
- **F-14** Admin login — POST to `/admin/login`; bcrypt verify; sets `httpOnly Secure SameSite=Strict` cookie; 8h expiry; rate limit 5 fails/IP/15min via KV
- **F-15** Admin dashboard — 4 metric counts + expiring soon table + recently added
- **F-16** Admin job list — all jobs (live + draft + expired), colour-coded status, 50/page
- **F-17** Post new job — full form with conditional state requirement (required when type=Govt or PSU), auto-slug from title
- **F-18** Edit job — same form pre-populated; slug-change warning; `updated_at` refreshed
- **F-19** Delete job — confirmation dialog → hard delete → KV invalidation
- **F-23** Auth middleware — `src/middleware/index.ts` guards all `/admin/*` except `/admin/login`

### Phase 4 — SEO & performance
- **F-11** `JobPosting` JSON-LD — in `<head>` of every `/jobs/[slug]`; strip HTML from description; parse salary to numeric; emit ISO datetime for `validThrough`
- **F-21** SEO meta tags — unique title + description + canonical on every public page; `noindex` on admin
- **F-12** Sitemap — `/sitemap.xml`; all published non-expired jobs; state sub-pages only if ≥1 job of that type
- **F-13** RSS feed — `/rss.xml`; latest 50 published non-expired jobs
- **F-22** KV caching — 5-min TTL on listing pages; 10-min on counts; invalidate all `jobs:*` keys on any admin write
- **F-24** robots.txt — disallow `/admin/`; include sitemap URL

---

## Design system

Vercel-inspired. Full token reference in `DESIGN.md`.

**Colors:**
- Ink / primary: `#171717`
- On-primary: `#ffffff`
- Body text: `#4d4d4d`
- Muted: `#888888`
- Hairline (dividers/borders): `#ebebeb`
- Canvas (card bg): `#ffffff`
- Canvas-soft (page bg): `#fafafa`
- Link: `#0070f3`
- Error: `#ee0000`
- Warning: `#f5a623`

**Typography:** Geist (geometric sans) for all display/body/button; Geist Mono for code labels. Display weights: 600. Button: 500. Body: 400. Aggressive negative letter-spacing on headlines (`-2.4px` at 48px). No all-caps headlines. Sentence-case with period at end of display copy.

**Buttons:** 100px pill radius for marketing CTAs; 6px radius for nav/admin buttons.

**Cards:** Stacked multi-offset shadows + inset 1px hairline ring — never a single heavy drop-shadow. `8px` radius for feature cards, `12px` for pricing/large cards.

**Job type badge colors:** Government = blue, PSU = orange, Private = green, Freelance = purple.

**Last date highlight:** Red text when ≤ 7 days away.

---

## Key decisions

| Decision | Rationale |
|---|---|
| Astro SSR over static | Dynamic jobs without rebuild; full SSR SEO |
| D1 (SQLite) over Postgres | Native Cloudflare, zero external DB cost |
| KV cache over edge cache | Fine-grained invalidation on admin edits |
| Single admin login | No Identity overhead for v1 solo use |
| External apply link only | Avoids resume storage compliance complexity |
| No client-side JS framework | Astro islands only if needed; keeps bundle tiny |
| Hard delete for jobs | Simpler; no audit requirement in v1 |
| No JWT/OAuth | Intentionally minimal: HMAC-signed cookie only |

---

## Out of scope (v1)

User registration, candidate accounts, in-platform resume upload, application tracking, email notifications, multi-admin or RBAC, paid listings, social login, admit cards / results pages.
