# SarkariNaukriBoard — Project Context

Indian job board for Government, PSU/Semi-Govt, Private, and Freelance/Gig sectors. Deployed on Cloudflare Workers + Pages. Primary differentiators: first-class state-level filtering (not offered by SarkariResult or Talentd), `JobPosting` JSON-LD for Google Jobs rich results, and a clean card-based mobile-first UI.

Full technical spec: `.claude/specs/01-job-board-specdoc.md`
Full feature spec: `.claude/specs/02-job-board-feature-spec.md`
Design system reference: `DESIGN.md`

---

## Current state

Scaffolding complete. The following has been built:

- `wrangler.jsonc` — D1, KV, and R2 bindings wired in; `SITE_URL` var set; observability enabled.
- `schema.sql` — idempotent D1 schema with seed data for `job_types` (4 rows), `states` (28 + 8 UTs + All India), and `categories` (12 rows: Banking, Defence, Engineering, IT/Software, Medical/Health, Police/Law, Railways, Teaching/Education, Clerical/Administration, Accounts/Finance, Agriculture, Research/Science). `departments` table exists but has no seed data yet.
- `src/layouts/BaseLayout.astro` — bare HTML shell; accepts `title`, `description`, `canonical` props.
- `src/layouts/AdminLayout.astro` — bare HTML shell with `noindex` meta; accepts `title` prop.
- `src/lib/db.ts` — `getDb()` helper (no args; uses `import { env } from 'cloudflare:workers'` — Astro v6 removed `Astro.locals.runtime.env`) + TypeScript interfaces for all table rows.
- `src/lib/auth.ts` — PBKDF2-SHA256 (100 000 iters) password hashing/verification; HMAC-SHA256 signed session tokens. **Note:** CLAUDE.md previously said bcrypt — the actual implementation uses PBKDF2 via Web Crypto API (no npm dependency).
- `src/lib/kv.ts` — KV cache helpers (stub).
- `src/lib/seo.ts` — SEO/JSON-LD builder (stub).
- `src/middleware/index.ts` — auth guard for all `/admin/*` routes except `/admin/login`; reads `ADMIN_SECRET` from `locals.runtime.env`. **Known bug:** uses the API removed in Astro v6 — will throw on first `/admin/*` request. Migrate to `import { env } from 'cloudflare:workers'` when starting F-14/F-23.
- `src/pages/index.astro` — still the default Astro welcome page; no real content yet.
- `src/pages/jobs/index.astro` — **F-01 + F-03 + F-04 + F-05 + F-06** (built). Runs the F-01 SQL; conditionally filters by `?type={slug}` (whitelisted against the 4 seeded `job_types.slug` values), `?state={slug}` (whitelisted against the fetched states set; unknown slugs fall back to no filter), and `?category={slug}` (whitelisted against the fetched categories set; same fall-through behavior). Renders 5 tabs (All | Government | PSU/Semi-Govt | Private | Freelance/Gig) with per-type counts from the F-03 counts query — counts intentionally remain across all states so tabs don't shrink to zero when a state is picked. Active tab uses `aria-current="page"` + inline ink-token styling (`#171717`, weight 600, 2px underline). State and category dropdowns are independent GET `<form>`s with `onchange="this.form.submit()"`; each emits hidden inputs preserving every other query param (state form drops `state`+`page`; category form drops `category`+`page`). State `<select>` has two `<optgroup>`s ("States" / "Union Territories") fetched via `ORDER BY is_union_territory, name`; first `<option value="">All India</option>` clears the filter — the seeded `all-india` slug is excluded from the dropdown (jobs tagged to it still appear in the no-filter view). Category `<select>` lists all 12 seeded categories alphabetically with `<option value="">All categories</option>` first. When active type is Government or PSU, the state dropdown is rendered **above** the tabs with a visible `<label>Select your state</label>`; otherwise rendered below with `aria-label="Filter by state"`. Category form is always rendered directly below the state form. `hrefFor()` preserves unknown query params across tab clicks and drops `page`. Keyword search via `?q={term}` is added as a GET `<form role="search">` rendered directly under `<h1>Jobs</h1>` (above the promoted-state slot and tabs); `q` is trimmed and gated server-side at ≥2 chars before being applied as `(j.title LIKE ? OR d.name LIKE ?)` with `%term%` bound twice — parameterised, no string interpolation. The search form's hidden inputs preserve every param except `q` and `page`, and the existing state/category/tab preservation logic propagates `q` automatically. Verified on 2026-06-14 against `wrangler dev` — see `.claude/plans/07-Job-type-filter-tabs.md`, `.claude/plans/08-State-filter.md`, `.claude/plans/09-Category-Filter.md`, and `.claude/plans/10-Keyword-Search.md`. Pagination (F-20) and full styling still to come.
- `src/pages/jobs/[slug].astro` — **F-02 first slice** (built). Detail page with breadcrumb, info grid, description (`set:html`, sanitization deferred to F-17), apply button (url/email/none), expired banner when `last_date < today`, and similar-jobs sidebar (same category, max 5). Returns 404 on missing/unpublished slug. JSON-LD (F-11) and R2 logo rendering still to come.
- `src/components/JobCard.astro` — semantic `<article>` rendering title, dept, type badge, state, vacancies, last_date, salary, and "View Details →" link. Inline `style="color:#ee0000"` applied to `last_date` only when ≤7 days away (no styling framework, per spec). Verified end-to-end on 2026-06-14 with seeded urgent + non-urgent rows.

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

Config file is `wrangler.jsonc` (not `.toml`). D1, KV, and R2 bindings are already wired in. D1 `database_id` is still a placeholder (`PLACEHOLDER_D1_ID`) — replace with the real ID from `wrangler d1 create job-board-db` before deploying. KV `id` is also a placeholder (`PLACEHOLDER_KV_ID`).

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

## Project structure (✓ = exists, — = still to build)

```
src/
  pages/
    index.astro                 ✓ exists (still default Astro welcome page — replace)
    jobs/
      index.astro               ✓ F-01 + F-03 + F-04 + F-05 (type tabs, state filter, category filter; keyword/pagination pending)
      [slug].astro              ✓ F-02 first slice (detail + apply + similar; JSON-LD/R2 logo pending)
    category/[slug].astro       — Jobs by category
    state/
      index.astro               — /states — browse all states
      [slug].astro              — All jobs in a state
      [slug]/
        government.astro        — Govt jobs in a state
        psu.astro               — PSU jobs in a state
    sitemap.xml.ts              —
    rss.xml.ts                  —
    admin/
      login.astro               —
      dashboard.astro           —
      jobs/
        index.astro             — Admin job list
        new.astro               — Post new job
        [id]/edit.astro         — Edit job
  components/
    JobCard.astro               ✓ F-01 card (title, dept, type badge, state, vacancies, last_date red ≤7d, salary, link)
    JobFilters.astro            —
    Pagination.astro            —
    AdminJobRow.astro           —
    JsonLd.astro                —
  layouts/
    BaseLayout.astro            ✓ bare shell (nav/footer not yet added)
    AdminLayout.astro           ✓ bare shell (sidebar not yet added)
  lib/
    db.ts                       ✓ getDb() (uses cloudflare:workers env) + row interfaces
    auth.ts                     ✓ PBKDF2 hash/verify + HMAC session sign/verify
    kv.ts                       ✓ stub
    seo.ts                      ✓ stub
  middleware/
    index.ts                    ✓ auth guard for /admin/*
public/
  robots.txt                    —
schema.sql                      ✓ full schema + seed data
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
`id`, `username`, `password_hash` (PBKDF2-SHA256, stored as `pbkdf2$iters$salt$hash`), `created_at`

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
- **F-14** Admin login — POST to `/admin/login`; PBKDF2-SHA256 verify (via `src/lib/auth.ts`); sets `httpOnly Secure SameSite=Strict` cookie; 8h expiry; rate limit 5 fails/IP/15min via KV
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
