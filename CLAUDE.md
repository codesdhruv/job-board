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
- `src/layouts/BaseLayout.astro` — HTML shell; accepts `title`, `description`, `canonical` props. Has a `<slot name="head" />` just before `</head>` for per-page head injection (used by F-11 JSON-LD). **F-21:** Emits `<meta name="robots" content="index, follow">` on all public pages (admin pages use AdminLayout which has `noindex`). **Footer (added 2026-06-14):** Renders a sitewide `<footer>` after `<slot />` with 7 links: States, All jobs, About, Contact, Privacy, Terms, Sitemap — 1px `#ebebeb` top border, 14px muted `#4d4d4d` text, matching the design-token spec. All pages that use `BaseLayout` now inherit this footer automatically; the previous inline footer on `index.astro` was removed.
- `src/layouts/AdminLayout.astro` — bare HTML shell with `noindex` meta; accepts `title` prop.
- `src/lib/db.ts` — `getDb()` helper (no args; uses `import { env } from 'cloudflare:workers'` — Astro v6 removed `Astro.locals.runtime.env`) + TypeScript interfaces for all table rows.
- `src/lib/auth.ts` — PBKDF2-SHA256 (100 000 iters) password hashing/verification; HMAC-SHA256 signed session tokens. **Note:** CLAUDE.md previously said bcrypt — the actual implementation uses PBKDF2 via Web Crypto API (no npm dependency).
- `src/lib/kv.ts` — **F-22 (complete).** Exports `getListingCached<T>(kv, key, fetchFn, ttlSeconds=300)` (cache-aside; falls through on KV read/write errors) and `invalidateAllListingCaches(kv)` (paginated `kv.list({ prefix: 'jobs:' })` + delete). Both functions were already implemented before this feature prompt — no changes required in this file.
- `src/lib/seo.ts` — **F-11 builder (complete).** Exports `buildJobPostingSchema(job: JobRow, dept: DepartmentRow | null, state: StateRow | null): JobPostingSchema`. Strips HTML from description (max 500 chars), formats `validThrough` as ISO datetime (`YYYY-MM-DDT00:00:00`), parses first numeric value from salary string for `baseSalary`. Missing optional fields are omitted entirely (not null).
- `src/middleware/index.ts` — **F-23 (complete).** Auth guard for all `/admin/*` routes except `/admin/login`. Reads `ADMIN_SECRET` via `import { env } from 'cloudflare:workers'` (the Astro v5 `locals.runtime.env` bug was fixed 2026-06-14). No cookie → redirect to `/admin/login`. Invalid/expired session → delete cookie + redirect. Valid session → pass through. Public routes skipped entirely. Verified 2026-06-14 — see `.claude/plans/19-Auth-Middleware-F23.md`.
- `src/pages/admin/login.astro` — **F-14 (built).** SSR page at `/admin/login`. Reads `ADMIN_SECRET` via `(env as any).ADMIN_SECRET` (throws if missing). Short-circuits already-logged-in requests: any `admin_session` cookie is passed to `verifySession()`; on valid payload, redirects to `/admin/dashboard`. On POST: parses `formData()` for `username`/`password`, queries `SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1`, calls `verifyPassword()` from `lib/auth.ts` (**PBKDF2, not bcryptjs** — the F-14 spec line 859 says bcrypt but the project deliberately uses PBKDF2 via Web Crypto; see `lib/auth.ts:43-58`). Success → mint 8-hour token via `signSession({adminId, username, expiresAt}, secret)`, set cookie `admin_session` with `httpOnly: true, secure: true, sameSite: 'strict', path: '/', expires: new Date(expiresAt)`, redirect to `/admin/dashboard`. Failure (missing field, unknown username, bad password) → re-render the form with a single generic `Invalid username or password` alert; submitted username pre-filled, password always blank. Uses `AdminLayout` (which emits `noindex, nofollow`). Inline styles only — design-token palette. **Out of scope for this prompt:** rate limiting (5 fails/IP/15 min via KV — spec line 858) and the `/admin/dashboard` destination (F-15 — login currently redirects to a 404). Verified 2026-06-14: GET 200 with form; POST wrong password → 200 with alert + preserved username + no cookie; POST correct credentials → 302 Location `/admin/dashboard` with `Set-Cookie: admin_session=…; HttpOnly; Secure; SameSite=Strict; Expires=…`; GET with valid cookie → 302 to dashboard. **Note:** Astro v6's built-in CSRF guard rejects cross-origin POSTs (403 `"Cross-site POST form submissions are forbidden"`) — browsers always send `Origin`, so this is correct; curl tests must add `-H "Origin: http://127.0.0.1:8789"`. See `.claude/plans/21-Admin-Login-F14.md`.
- `scripts/hash-password.mjs` — Node 22 helper that mints a PBKDF2 hash in the `pbkdf2$iters$salt$hash` format `verifyPassword()` expects. Uses built-in `globalThis.crypto.subtle` with the same params as `lib/auth.ts` (100 000 iters, SHA-256, 16-byte salt, 32-byte hash). Run `node scripts/hash-password.mjs <password>` to seed a new admin row.
- `.dev.vars` (gitignored, added 2026-06-14) — local `ADMIN_SECRET=dev-secret-change-me` so middleware + login can sign/verify sessions during `wrangler dev`. Replace with a real secret in the Cloudflare dashboard before deploy.
- `src/pages/index.astro` — **F-10** (built). SSR homepage at `/`. Frontmatter runs five D1 queries via a single `Promise.all`: (1) total live count `SELECT COUNT(*) AS n FROM jobs WHERE is_published=1 AND last_date>=DATE('now')` for the hero subline; (2) per-type counts (same shape as F-03 counts query) merged against a static `jobTypes` array so all 4 cards render even at 0 count; (3) latest 10 jobs (spec lines 609–619 SQL verbatim) reusing `JobCard.astro`; (4) top-8 featured states INNER JOIN ordered by count (spec lines 623–627 SQL — states with 0 jobs intentionally excluded); (5) all 12 categories alphabetically. Five sections rendered top-to-bottom: hero, 4 job-type cards, latest-jobs grid, featured-states, 12 category chips. Footer removed from this file 2026-06-14 — now emitted by `BaseLayout.astro`. Canonical built from `(env as any).SITE_URL` using `.replace(/\/$/, '')` pattern from `states.astro:32–33`. Title/description match spec lines 1164–1165. No client JS. Verified 2026-06-14 — see `.claude/plans/14-Homepage.md`.
- `src/pages/jobs/index.astro` — **F-01 + F-03 + F-04 + F-05 + F-06 + F-21 + F-22** (built). Runs the F-01 SQL; conditionally filters by `?type={slug}` (whitelisted against the 4 seeded `job_types.slug` values), `?state={slug}` (whitelisted against the fetched states set; unknown slugs fall back to no filter), and `?category={slug}` (whitelisted against the fetched categories set; same fall-through behavior). Renders 5 tabs (All | Government | PSU/Semi-Govt | Private | Freelance/Gig) with per-type counts from the F-03 counts query — counts intentionally remain across all states so tabs don't shrink to zero when a state is picked. Active tab uses `aria-current="page"` + inline ink-token styling (`#171717`, weight 600, 2px underline). State and category dropdowns are independent GET `<form>`s with `onchange="this.form.submit()"`; each emits hidden inputs preserving every other query param (state form drops `state`+`page`; category form drops `category`+`page`). State `<select>` has two `<optgroup>`s ("States" / "Union Territories") fetched via `ORDER BY is_union_territory, name`; first `<option value="">All India</option>` clears the filter — the seeded `all-india` slug is excluded from the dropdown (jobs tagged to it still appear in the no-filter view). Category `<select>` lists all 12 seeded categories alphabetically with `<option value="">All categories</option>` first. When active type is Government or PSU, the state dropdown is rendered **above** the tabs with a visible `<label>Select your state</label>`; otherwise rendered below with `aria-label="Filter by state"`. Category form is always rendered directly below the state form. `hrefFor()` preserves unknown query params across tab clicks and drops `page`. Keyword search via `?q={term}` is added as a GET `<form role="search">` rendered directly under `<h1>Jobs</h1>` (above the promoted-state slot and tabs); `q` is trimmed and gated server-side at ≥2 chars before being applied as `(j.title LIKE ? OR d.name LIKE ?)` with `%term%` bound twice — parameterised, no string interpolation. The search form's hidden inputs preserve every param except `q` and `page`, and the existing state/category/tab preservation logic propagates `q` automatically. **F-21:** title "Browse Government & Private Jobs in India 2026 | SarkariNaukriBoard"; description "Browse government, PSU and private jobs in India. Filter by state, category and job type. Updated daily."; canonical `{SITE_URL}/jobs` (base URL, no query params). **F-22 (added 2026-06-14):** Jobs query wrapped in `getListingCached()` at 5-min TTL with key built by `buildListingKey()` — produces `jobs:all:p{n}`, `jobs:type:{slug}:p{n}`, `jobs:state:{slug}:type:{slug}:p{n}`, `jobs:category:{slug}:p{n}`, etc. matching the spec key scheme. Keyword search (`?q=`) bypasses the cache entirely (results too unique to key on). Counts query wrapped separately with key `counts:all` at 10-min TTL (600s). KV binding obtained via `(env as any).KV as KVNamespace`. Verified build passes 2026-06-14 — see `.claude/plans/18-KV-Caching-F22.md`. Pagination (F-20) and full styling still to come.
- `src/pages/jobs/[slug].astro` — **F-02 + F-11 + F-21** (built). Detail page with breadcrumb, info grid, description (`set:html`, sanitization deferred to F-17), apply button (url/email/none), expired banner when `last_date < today`, and similar-jobs sidebar (same category, max 5). Returns 404 on missing/unpublished slug. **F-11:** Imports `buildJobPostingSchema` from `lib/seo.ts`; constructs `dept` and `state` objects from the flat join row; renders `<script type="application/ld+json">` via `<Fragment slot="head">` into `BaseLayout`'s named head slot. Emitted for all valid published jobs (including expired — `validThrough` encodes expiry). R2 logo rendering still to come. **F-21:** title `{job.title} — {dept_name} | SarkariNaukriBoard` (dept_name omitted if null); description follows spec template "Apply for {title} at {dept}. {vacancies} vacancies. Last date: {DD Mon YYYY}. State: {state_name}." — built from array of non-empty parts joined and sliced to 155 chars; `formatDate()` uses `toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})`; canonical `{SITE_URL}/jobs/{slug}`. Verified 2026-06-14 — see `.claude/plans/15-JobPostingJSONLD-Sitemap-RSSFeed.md`, `.claude/plans/16-SEO-Meta-Tags-F21.md`.
- `src/components/JobCard.astro` — semantic `<article>` rendering title, dept, type badge, state, vacancies, last_date, salary, and "View Details →" link. Inline `style="color:#ee0000"` applied to `last_date` only when ≤7 days away (no styling framework, per spec). Verified end-to-end on 2026-06-14 with seeded urgent + non-urgent rows.
- `src/pages/states.astro` — **F-07** (built). SSR page at `/states` (plural — the F-07 and F-12 spec sections both use this route; ignore the stale `state/index.astro` entry in the project-structure tree below). Runs the F-07 count query (`LEFT JOIN states + jobs` filtered by `is_published = 1 AND last_date >= DATE('now')`, `GROUP BY s.id`, `ORDER BY is_union_territory, name`). Splits results in the frontmatter into `allIndia` (slug = `all-india`), `states` (`is_union_territory = 0`, slug ≠ `all-india`), and `unionTerritories` (`is_union_territory = 1`). Renders `<h1>Browse Jobs by State</h1>` + lede, a featured "All India — Central Govt (N)" card linking to `/state/all-india`, then two `<section>`s ("States" and "Union Territories") each containing an inline CSS grid (`repeat(auto-fill,minmax(200px,1fr))`) of `<a href="/state/{slug}">{name} ({count})</a>` cards. Zero-count cards greyed via inline `color:#888888` (muted token) plus `aria-label="{name} — 0 active jobs"`; links remain enabled so crawlers can still reach F-08 pages. `BaseLayout` props set to the spec strings (title "Browse Jobs by State in India | SarkariNaukriBoard", description per spec line 452); `canonical` built from `(env as any).SITE_URL` + `/states`. No CSS framework, no JS. Verified end-to-end on 2026-06-14 against `wrangler dev`: HTTP 200, 28 state links + 8 UT links + 1 All India card, title/description/canonical match spec — see `.claude/plans/11-State-Index-Page.md`. F-08 now built (see entry below) so the card links resolve.
- `src/pages/category/[slug].astro` — **F-09** (built). SSR route at `/category/[slug]`. Frontmatter looks up the category row by `slug` and returns `new Response(null, { status: 404 })` on miss; otherwise runs the F-01 SELECT/LEFT-JOIN constrained to `c.slug = ?` with `j.is_published = 1 AND j.last_date >= DATE('now')` and `ORDER BY j.created_at DESC`. Optional `?type=` query param (whitelisted against the 4 seeded `job_types.slug` values — `government`, `psu`, `private`, `freelance`; unknown slugs fall through to no filter) appends `AND jt.slug = ?` via a branching `db.prepare(sql).bind(...)` call, matching the chaining style in `state/[slug].astro` rather than spreading a `binds` array. Valid slug with zero rows renders "No active jobs in this category right now. Check back soon." — never a 404 (spec line 564). Breadcrumb `Home › Categories › {name}` where "Categories" is a plain `<span>` (no `/categories` index page exists in scope). `<h1>{name} Jobs</h1>` + lede "{count} active {name.toLowerCase()} jobs across all sectors". Sub-type tabs `All | Government | PSU / Semi-Govt | Private | Freelance / Gig` driven entirely by `?type=` query param — no dedicated sub-routes because the spec only defines `/category/[slug]` at line 538. Active tab via `aria-current="page"` + inline ink-token (`#171717`, weight 600, 2px underline) mirroring `state/[slug].astro:63–77`. `hrefFor(typeSlug)` preserves all other query params and drops `page`, mirroring the helper in `jobs/index.astro:95–102`. Includes all 5 tabs (broader than F-08's 4-tab set which omits Freelance) because category pages are sector-agnostic. `<title>`, `<meta name="description">`, and canonical match spec lines 559–560 with `{count}` interpolated; canonical built from `(env as any).SITE_URL` using `replace(/\/$/, '')`. Verified 2026-06-14 against `npm run build`: build passes, `/category/engineering` 200 with "All" active, `/category/engineering?type=government` filters and marks Government tab active, `/category/banking` (no seed) renders empty state (not 404), `/category/does-not-exist` 404. Pagination (F-20), `ItemList` JSON-LD (F-11/F-21), and KV caching (F-22) deferred — see `.claude/plans/13-category-jobs-pages.md`.
- `src/pages/sitemap.xml.ts` — **F-12** (built). Astro SSR endpoint at `/sitemap.xml`. Runs 5 parallel D1 queries: all published non-expired jobs (with `COALESCE(updated_at, created_at)` as `lastmod`); states with ≥1 active job; states with ≥1 govt job; states with ≥1 PSU job; categories with ≥1 active job. Emits static pages (`/`, `/jobs`, `/states`, `/about`, `/privacy-policy`, `/terms`, `/contact` — updated 2026-06-14), `/state/{slug}` and its `/government`+`/psu` sub-pages only where ≥1 matching job exists, `/category/{slug}` for non-empty categories, and `/jobs/{slug}` for every active job with `<lastmod>`, `<changefreq>weekly</changefreq>`, `<priority>0.8</priority>`. Expired jobs excluded. XML-escaped. `Content-Type: application/xml`. Verified 2026-06-14 — see `.claude/plans/15-JobPostingJSONLD-Sitemap-RSSFeed.md`.
- `src/pages/about.astro` — Static MPA page at `/about` (added 2026-06-14). No D1 queries. `BaseLayout` with title "About SarkariNaukriBoard — India's job board for govt and private jobs", description, canonical `${SITE_URL}/about`. 3 placeholder paragraphs; user will replace copy.
- `src/pages/privacy-policy.astro` — Static MPA page at `/privacy-policy` (added 2026-06-14). No D1 queries. `BaseLayout` with title "Privacy Policy — SarkariNaukriBoard", canonical `${SITE_URL}/privacy-policy`. 3 placeholder paragraphs.
- `src/pages/terms.astro` — Static MPA page at `/terms` (added 2026-06-14). No D1 queries. `BaseLayout` with title "Terms & Conditions — SarkariNaukriBoard", canonical `${SITE_URL}/terms`. 3 placeholder paragraphs.
- `src/pages/contact.astro` — Static MPA page at `/contact` (added 2026-06-14). No D1 queries. No form — shows `mailto:contact@yourdomain.com` link only. `BaseLayout` with title "Contact Us — SarkariNaukriBoard", canonical `${SITE_URL}/contact`.
- `src/pages/rss.xml.ts` — **F-13** (built). Astro SSR endpoint at `/rss.xml`. Single query: latest 50 published non-expired jobs LEFT JOINed with states and departments. RSS 2.0 channel with `lastBuildDate` (current time). Each `<item>` has `<title>`, `<link>`, `<description>` (`"{vacancies} vacancies. Last date: {last_date}. State: {state_name}."`), RFC 822 `<pubDate>` (D1 datetime → `new Date(...+'Z').toUTCString()` with GMT→+0000), and `<guid>`. All text XML-escaped. `Content-Type: application/rss+xml`. Verified 2026-06-14 — see `.claude/plans/15-JobPostingJSONLD-Sitemap-RSSFeed.md`.
- `src/pages/state/[slug].astro`, `src/pages/state/[slug]/government.astro`, `src/pages/state/[slug]/psu.astro` — **F-08 + F-22** (built). Three SSR routes for `/state/[slug]`, `/state/[slug]/government`, `/state/[slug]/psu`. Each frontmatter looks up the state row by `slug` and returns `new Response(null, { status: 404 })` if the slug is unknown; otherwise runs the F-01 SELECT/LEFT-JOIN constrained to `s.slug = ?` (sub-pages add `AND jt.slug = 'government'` or `'psu'`) with `j.is_published = 1 AND j.last_date >= DATE('now')` and `ORDER BY j.created_at DESC`. Valid slug with zero rows renders the empty-state message "No active jobs in this state right now. Check back soon." — never a 404, per spec line 523. The `/state/[slug]` page renders sub-type tabs `All | Government | PSU / Semi-Govt | Private` directly under the lede (All active via `aria-current="page"` + ink underline mirroring `jobs/index.astro:169–187`); Government and PSU link to the dedicated sub-routes, Private cross-links to `/jobs?state={slug}&type=private` because the spec defines no dedicated `/state/[slug]/private` route (decision recorded in `.claude/plans/12-State-Jobs-Page.md`). The two sub-pages omit tabs entirely (spec line 485). Per-page `<title>`, `<meta name="description">`, and canonical match the spec table at lines 515–520 with `{state.name}` and `{count}` interpolated; canonical built from `(env as any).SITE_URL` using the `replace(/\/$/, '')` pattern from `states.astro:32–33`. Breadcrumb: `Home › States › {state.name}` on the index, with a fourth `› Government` / `› PSU` segment on the sub-pages (the `{state.name}` link points back to `/state/[slug]`). **F-22 (added 2026-06-14):** Jobs query in `[slug].astro` wrapped in `getListingCached()` with key `jobs:state:{slug}:p{page}` at 5-min TTL. The state row lookup (`SELECT id, name, slug`) is NOT cached — needed live for 404 detection. Sub-pages `government.astro` and `psu.astro` caching deferred (only `/state/[slug]` was in scope for this prompt). Verified build passes 2026-06-14. Pagination (F-20) and `ItemList` JSON-LD still to come — see `.claude/plans/12-State-Jobs-Page.md`, `.claude/plans/18-KV-Caching-F22.md`. **Note:** `wrangler dev` serves from `dist/` and does not auto-rebuild; use `npm run dev` for hot reload, or `npm run build` before `wrangler dev` when validating the production bundle.

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
    index.astro                 ✓ F-10 — Homepage (hero search + quick links, 4 job-type cards w/ live counts, latest 10 jobs, top-8 featured states, 12 category chips; footer moved to BaseLayout)
    about.astro                 ✓ Static — /about (placeholder copy; user to replace)
    privacy-policy.astro        ✓ Static — /privacy-policy (placeholder copy)
    terms.astro                 ✓ Static — /terms (placeholder copy)
    contact.astro               ✓ Static — /contact (mailto link only; no form)
    jobs/
      index.astro               ✓ F-01 + F-03 + F-04 + F-05 (type tabs, state filter, category filter; keyword/pagination pending)
      [slug].astro              ✓ F-02 + F-11 (detail + apply + similar + JobPosting JSON-LD in <head>; R2 logo pending)
    states.astro                ✓ F-07 — /states browse-by-state index (featured All India card + States/UTs grids with live counts)
    category/[slug].astro       ✓ F-09 — Jobs by category (sub-type tabs via ?type= query param; All/Govt/PSU/Private/Freelance)
    state/
      [slug].astro              ✓ F-08 — all jobs in a state + sub-type tabs (Private tab cross-links to /jobs?state=…&type=private)
      [slug]/
        government.astro        ✓ F-08 — Govt jobs in a state
        psu.astro               ✓ F-08 — PSU jobs in a state
    sitemap.xml.ts              ✓ F-12 — /sitemap.xml (5 parallel D1 queries; 7 static pages incl. /about /privacy-policy /terms /contact; state/govt/psu sub-pages only if ≥1 matching job)
    rss.xml.ts                  ✓ F-13 — /rss.xml (latest 50 non-expired jobs, RSS 2.0, RFC 822 pubDate)
    admin/
      login.astro               ✓ F-14 — username/password form; PBKDF2 verify; 8h HMAC-signed cookie; already-logged-in short-circuit
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
    JsonLd.astro                — (not needed — JSON-LD injected inline in [slug].astro via Fragment slot="head")
  layouts/
    BaseLayout.astro            ✓ shell + sitewide footer (7 links: States, All jobs, About, Contact, Privacy, Terms, Sitemap)
    AdminLayout.astro           ✓ bare shell (sidebar not yet added)
  lib/
    db.ts                       ✓ getDb() (uses cloudflare:workers env) + row interfaces
    auth.ts                     ✓ PBKDF2 hash/verify + HMAC session sign/verify
    kv.ts                       ✓ stub
    seo.ts                      ✓ stub
  middleware/
    index.ts                    ✓ auth guard for /admin/*
public/
  robots.txt                    ✓ F-24 — static file; disallows /admin/ and /admin/*; Sitemap: https://example.com/sitemap.xml (matches SITE_URL in wrangler.jsonc)
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
- **F-14** ✓ Admin login — `src/pages/admin/login.astro`. POST verifies via `verifyPassword()` (PBKDF2 from `lib/auth.ts`); sets `admin_session` cookie (`httpOnly Secure SameSite=Strict path=/ expires=+8h`) signed with HMAC-SHA256 via `signSession()`. Generic error on any failure; submitted username preserved across re-renders. Already-logged-in GET short-circuits to `/admin/dashboard`. Verified 2026-06-14. **Deferred:** KV-backed rate limiting (5 fails/IP/15min). See `.claude/plans/21-Admin-Login-F14.md`.
- **F-15** Admin dashboard — 4 metric counts + expiring soon table + recently added
- **F-16** Admin job list — all jobs (live + draft + expired), colour-coded status, 50/page
- **F-17** Post new job — full form with conditional state requirement (required when type=Govt or PSU), auto-slug from title
- **F-18** Edit job — same form pre-populated; slug-change warning; `updated_at` refreshed
- **F-19** Delete job — confirmation dialog → hard delete → KV invalidation
- **F-23** ✓ Auth middleware — `src/middleware/index.ts` guards all `/admin/*` except `/admin/login`. Uses `cloudflare:workers` env for `ADMIN_SECRET`. Verified 2026-06-14.

### Phase 4 — SEO & performance
- **F-11** ✓ `JobPosting` JSON-LD — `<script type="application/ld+json">` in `<head>` of every `/jobs/[slug]` via BaseLayout `slot="head"`; `buildJobPostingSchema` in `lib/seo.ts` strips HTML, parses salary to numeric, formats `validThrough` as ISO datetime. Verified 2026-06-14.
- **F-12** ✓ Sitemap — `/sitemap.xml`; 5 parallel D1 queries; all published non-expired jobs with `<lastmod>`/`<changefreq>`/`<priority>`; state `/government` and `/psu` sub-pages only if ≥1 matching job. Verified 2026-06-14.
- **F-13** ✓ RSS feed — `/rss.xml`; latest 50 published non-expired jobs; RFC 822 `pubDate`; XML-escaped; RSS 2.0. Verified 2026-06-14.
- **F-21** ✓ SEO meta tags — `<meta name="robots" content="index, follow">` in BaseLayout (all public pages); `noindex, nofollow` in AdminLayout (all admin pages). Per-page unique title, ≤155-char description, and canonical implemented on: `/` (homepage, pre-existing), `/jobs` (added 2026-06-14), `/jobs/[slug]` (title format fixed to include dept_name; description format fixed to spec template, 2026-06-14), `/state/[slug]` + sub-pages (pre-existing), `/category/[slug]` (pre-existing). Verified 2026-06-14 — see `.claude/plans/16-SEO-Meta-Tags-F21.md`.
- **F-22** ✓ KV caching — `getListingCached()` wraps jobs query on `/jobs` and `/state/[slug]` (5-min TTL); counts query on `/jobs` uses `counts:all` key (10-min TTL); keyword search bypasses cache; `invalidateAllListingCaches()` ready for admin wiring (deferred to admin prompts). Verified build 2026-06-14 — see `.claude/plans/18-KV-Caching-F22.md`.
- **F-24** ✓ robots.txt — `public/robots.txt`; `Disallow: /admin/` + `Disallow: /admin/*`; `Sitemap: https://example.com/sitemap.xml`. Static file — update URL when deploying to real domain. Verified 2026-06-14.

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
