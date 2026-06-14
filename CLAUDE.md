# SarkariNaukriBoard — Project Context

Indian job board for Government, PSU/Semi-Govt, Private, and Freelance/Gig sectors. Deployed on Cloudflare Workers + Pages. Primary differentiators: first-class state-level filtering (not offered by SarkariResult or Talentd), `JobPosting` JSON-LD for Google Jobs rich results, and a clean card-based mobile-first UI.

Full technical spec: `.claude/specs/01-job-board-specdoc.md`
Full feature spec: `.claude/specs/02-job-board-feature-spec.md`
Design system reference: `DESIGN.md`

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

Config file is `wrangler.jsonc` (not `.toml`). D1 `database_id` and KV `id` are placeholders — replace before deploying.

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

> `wrangler dev` serves from `dist/` and does not auto-rebuild. Use `npm run dev` for hot reload, or `npm run build` before `wrangler dev` when validating the production bundle.

---

## Project structure

```
src/
  pages/
    index.astro                 ✓ F-10 — Homepage
    about.astro                 ✓ Static
    privacy-policy.astro        ✓ Static
    terms.astro                 ✓ Static
    contact.astro               ✓ Static (mailto only)
    jobs/
      index.astro               ✓ F-01 F-03 F-04 F-05 F-06 F-21 F-22 — Listing + filters + search + KV cache
      [slug].astro              ✓ F-02 F-11 F-21 — Detail + JSON-LD
    states.astro                ✓ F-07 — Browse by state index
    category/[slug].astro       ✓ F-09 — Jobs by category
    state/
      [slug].astro              ✓ F-08 F-22 — State jobs + tabs
      [slug]/
        government.astro        ✓ F-08 — Govt jobs in a state
        psu.astro               ✓ F-08 — PSU jobs in a state
    sitemap.xml.ts              ✓ F-12
    rss.xml.ts                  ✓ F-13
    admin/
      login.astro               ✓ F-14
      dashboard.astro           ✓ F-15
      jobs/
        index.astro             ✓ F-16
        new.astro               ✓ F-17
        [id]/edit.astro         ✓ F-18
        [id]/delete.astro       ✓ F-19
  components/
    JobCard.astro               ✓
    JobFilters.astro            —
    Pagination.astro            —
  layouts/
    BaseLayout.astro            ✓ HTML shell + sitewide footer (7 links)
    AdminLayout.astro           ✓ Admin shell + sidebar (hidden on /admin/login)
  lib/
    db.ts                       ✓ getDb() via cloudflare:workers env + row interfaces
    auth.ts                     ✓ PBKDF2-SHA256 hash/verify + HMAC-SHA256 session tokens
    kv.ts                       ✓ getListingCached() + invalidateAllListingCaches()
    seo.ts                      ✓ buildJobPostingSchema()
  middleware/
    index.ts                    ✓ F-23 — Auth guard for /admin/*
public/
  robots.txt                    ✓ F-24
scripts/
  hash-password.mjs             ✓ PBKDF2 hash helper for seeding admins table
schema.sql                      ✓ Full schema + seed data
.dev.vars                       ✓ gitignored — local ADMIN_SECRET
```

---

## Database schema

### `job_types`
`id`, `name`, `slug` — seed: Government, PSU/Semi-Govt, Private, Freelance/Gig

### `states`
`id`, `name`, `slug`, `is_union_territory` — 28 states + 8 UTs + "All India" (central govt jobs)

### `categories`
`id`, `name`, `slug` — 12 rows: Banking, Defence, Engineering, IT/Software, Medical/Health, Police/Law, Railways, Teaching/Education, Clerical/Administration, Accounts/Finance, Agriculture, Research/Science

### `departments`
`id`, `name`, `logo_r2_key` — no seed data yet

### `jobs` (core table)
`id`, `slug` (unique), `title`, `department_id`, `job_type_id`, `category_id`, `state_id`, `location`, `vacancies`, `qualification`, `age_limit`, `salary`, `last_date` (required), `apply_url`, `apply_email`, `description`, `is_published` (default 1), `created_at`, `updated_at`

Indexes: `job_type_id`, `category_id`, `state_id`, `last_date`, `is_published`, composite `(job_type_id, state_id)`

### `admins`
`id`, `username`, `password_hash` (`pbkdf2$iters$salt$hash`), `created_at`

---

## Environment variables

| Variable | Purpose |
|---|---|
| `ADMIN_SECRET` | Signs/verifies session cookie (HMAC-SHA256) |
| `SITE_URL` | Base URL for canonical tags and sitemap |

Set in Cloudflare dashboard → Workers → Settings → Variables.

---

## Features (F-01 to F-24)

### Public pages
- **F-01** ✓ Job listing page (`/jobs`) — paginated, 4 filters, 20/page
- **F-02** ✓ Job detail page (`/jobs/[slug]`) — full info, apply button, JSON-LD, similar jobs sidebar
- **F-03** ✓ Job type filter tabs — All / Government / PSU / Private / Freelance
- **F-04** ✓ State filter — `<select>` with `<optgroup>`; promoted when type=Govt or PSU
- **F-05** ✓ Category filter dropdown
- **F-06** ✓ Keyword search — `jobs.title` and `departments.name`; parameterised only
- **F-07** ✓ State index page (`/states`) — grid of all 36 states/UTs with job counts
- **F-08** ✓ State jobs pages — `/state/[slug]`, `/state/[slug]/government`, `/state/[slug]/psu`
- **F-09** ✓ Category jobs page (`/category/[slug]`)
- **F-10** ✓ Homepage — hero search, job type cards, latest 10 jobs, featured states, category chips
- **F-20** — Pagination (20/page public, 50/page admin; preserve all filter params)

### Admin
- **F-14** ✓ Admin login — PBKDF2 verify; 8h HMAC-signed cookie
- **F-15** ✓ Admin dashboard — 4 metric cards + expiring-soon + recently-added tables
- **F-16** ✓ Admin job list — status badges, flash banners, inline pagination
- **F-17** ✓ Post new job — 6-section form, server validation, auto-slug, KV invalidation
- **F-18** ✓ Edit job — pre-populated form, slug-change warning, KV invalidation
- **F-19** ✓ Delete job — POST-only, hard delete, KV invalidation
- **F-23** ✓ Auth middleware — guards all `/admin/*` except `/admin/login`

### SEO & performance
- **F-11** ✓ `JobPosting` JSON-LD in `<head>` of every `/jobs/[slug]`
- **F-12** ✓ Sitemap — `/sitemap.xml`
- **F-13** ✓ RSS feed — `/rss.xml`
- **F-21** ✓ SEO meta tags — robots, unique title/description/canonical per page
- **F-22** ✓ KV caching — 5-min TTL on listing queries; bypass on keyword search
- **F-24** ✓ robots.txt — disallows `/admin/`; includes Sitemap URL

---

## Key notes

- **Auth:** PBKDF2-SHA256 (100k iters) via Web Crypto API — no npm dependency. Session tokens are HMAC-SHA256 signed. No bcrypt.
- **`env` access:** Use `import { env } from 'cloudflare:workers'` everywhere — Astro v6 removed `Astro.locals.runtime.env`.
- **CSRF:** Astro v6's built-in CSRF guard rejects cross-origin POSTs. curl tests must pass `-H "Origin: http://127.0.0.1:8789"`.
- **State filter:** The seeded `all-india` slug is excluded from the state dropdown; jobs tagged to it appear in the no-filter view.
- **Private state tab:** No `/state/[slug]/private` route exists — Private tab cross-links to `/jobs?state={slug}&type=private`.
- **Slug uniqueness:** `makeUniqueSlugExcluding(slug, jobId)` used on edit to skip self-conflict check.
- **KV invalidation:** Call `invalidateAllListingCaches(kv)` on every INSERT/UPDATE/DELETE in admin.

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

**Typography:** Geist for all display/body/button; Geist Mono for code labels. Display weight: 600. Button: 500. Body: 400. Aggressive negative letter-spacing on headlines (`-2.4px` at 48px). Sentence-case.

**Buttons:** 100px pill radius for marketing CTAs; 6px radius for nav/admin buttons.

**Cards:** Stacked multi-offset shadows + inset 1px hairline ring. `8px` radius for feature cards, `12px` for large cards.

**Job type badge colors:** Government = blue, PSU = orange, Private = green, Freelance = purple.

**Last date highlight:** Red text when ≤ 7 days away. Inline styles only — no CSS framework.

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

User registration, candidate accounts, resume upload, application tracking, email notifications, multi-admin/RBAC, paid listings, social login, admit cards/results pages.
