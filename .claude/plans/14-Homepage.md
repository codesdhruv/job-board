# F-10 — Homepage

## Context

`/` was still rendering the default Astro starter (`src/pages/index.astro` importing `Welcome` + `Layout`). F-10 (`.claude/specs/02-job-board-feature-spec.md` lines 574–636) is the last public traffic entry point — every other surface (`/jobs`, `/states`, `/state/[slug]`, `/category/[slug]`) was already built and link-ready, but had no real landing page funnelling visitors in. The homepage carries six jobs in one page: hero search, job-type cards with counts, latest jobs, featured states, category chips, and footer. Acceptance criterion line 635 mandates pure SSR (no client JS). Design must follow `DESIGN.md` tokens — ink `#171717`, body `#4d4d4d`, hairline `#ebebeb`, canvas `#ffffff`, canvas-soft `#fafafa`, link `#0070f3`; Geist display weight 600 with aggressive negative tracking (`-2.4px` at 48px); 100px pill for marketing CTAs; stacked-shadow + inset-hairline card chrome.

## Scope

Rewrite `src/pages/index.astro` end-to-end. No new components, no new lib files — reuse `BaseLayout`, `JobCard`, and `getDb()`.

Per the F-10 spec:
- **Hero band**: `<h1>` "Find your dream government job."; subline with live total count; GET `<form action="/jobs">` keyword search submitting `?q=`; quick links (UPSC | SSC | Railways | Banking | Defence)
- **Job type cards**: 4-up grid, each linking to `/jobs?type={slug}`, with live counts; all 4 types rendered even at 0 count
- **Latest 10 jobs**: 2-col grid of `<JobCard>` with "View all jobs →" trailing link
- **Featured states**: top 8 by job count, each linking to `/state/{slug}`, with "View all states →" trailing link
- **Browse by category**: all 12 seeded categories as pill chips linking to `/category/{slug}`
- **Footer**: minimal — © + links to States / All jobs / Sitemap

Out of scope (deferred): SEO `noindex` toggling (already public-default), KV caching (F-22), `ItemList` JSON-LD, real nav header (no global nav scaffold yet), sitemap.xml (F-12 separate).

## Files

**Modified:** `src/pages/index.astro` (full rewrite)

**Reused (read-only):**
- `src/layouts/BaseLayout.astro` — `title`, `description`, `canonical` props
- `src/components/JobCard.astro` — already renders type/state/vacancies/last-date (red ≤7d)/salary
- `src/lib/db.ts` — `getDb()`

**Reference patterns mirrored:**
- `src/pages/states.astro:32–33` — canonical builder `((env as any).SITE_URL ?? '').replace(/\/$/, '')`
- `src/pages/jobs/index.astro:106–110` — per-type COUNT(*) query shape; merged with the static `jobTypes` array so 0-count types still render
- `src/pages/category/[slug].astro` — section structure (h1 + lede + grid)

## Implementation summary

```astro
---
import { env } from 'cloudflare:workers';
import BaseLayout from '../layouts/BaseLayout.astro';
import JobCard from '../components/JobCard.astro';
import { getDb } from '../lib/db';

const db = getDb();
const jobTypes = [
  { slug: 'government',  name: 'Government' },
  { slug: 'psu',         name: 'PSU / Semi-Govt' },
  { slug: 'private',     name: 'Private' },
  { slug: 'freelance',   name: 'Freelance / Gig' },
];

const [totalRes, typeCountsRes, latestRes, featuredStatesRes, categoriesRes] = await Promise.all([
  db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE is_published=1 AND last_date>=DATE('now')`).first(),
  db.prepare(`SELECT jt.slug, COUNT(*) AS count FROM jobs j JOIN job_types jt ON j.job_type_id=jt.id
              WHERE j.is_published=1 AND j.last_date>=DATE('now') GROUP BY jt.slug`).all(),
  db.prepare(`SELECT j.id, j.slug, j.title, j.last_date, j.vacancies, j.salary,
                     jt.name AS type_name, jt.slug AS type_slug,
                     s.name AS state_name, d.name AS dept_name
              FROM jobs j
              LEFT JOIN job_types jt ON j.job_type_id=jt.id
              LEFT JOIN states s ON j.state_id=s.id
              LEFT JOIN departments d ON j.department_id=d.id
              WHERE j.is_published=1 AND j.last_date>=DATE('now')
              ORDER BY j.created_at DESC LIMIT 10`).all(),
  db.prepare(`SELECT s.name, s.slug, COUNT(j.id) AS count
              FROM states s JOIN jobs j ON j.state_id=s.id
              WHERE j.is_published=1 AND j.last_date>=DATE('now')
              GROUP BY s.id ORDER BY count DESC LIMIT 8`).all(),
  db.prepare(`SELECT name, slug FROM categories ORDER BY name`).all(),
]);

const totalCount = totalRes?.n ?? 0;
const typeCountMap = new Map((typeCountsRes.results).map(r => [r.slug, r.count]));
// … render 6 sections with inline DESIGN.md tokens
```

### Section styling notes
- Hero: canvas-soft `#fafafa` band, padding `96px 24px`, max-width 960px, centered. `<h1>` at 48/600/-2.4px. Search button is the 100px ink pill (`button-primary` in DESIGN.md).
- Job-type cards: `repeat(auto-fit,minmax(220px,1fr))`, padding 24px, `box-shadow: 0 0 0 1px #ebebeb inset, 0 1px 1px rgba(0,0,0,0.02), 0 2px 2px rgba(0,0,0,0.04)` (Level 2 stacked shadow per DESIGN.md elevation table).
- Featured-states section is conditionally rendered (`{featuredStates.length > 0 && …}`) since the top-8 query inner-joins jobs and returns 0–8 rows.
- Category chips: 64px pill radius (`rounded.pill-sm`), 14px Geist, hairline border.

### Decisions
- **No new components**: hero/cards/footer are one-off blocks; reuse `JobCard` for the latest list. Spinning out `HeroSearch.astro` etc. is premature per CLAUDE.md ("Three similar lines is better than a premature abstraction").
- **No client JS**: search submits via plain GET form (acceptance line 635). Confirmed in dist — only Astro's dev-mode HMR scripts present; production build strips them.
- **Live total count** in hero subline rather than the spec's literal "1,200+" placeholder — honest copy at low seed volume.
- **Quick-link routing**: `UPSC`/`SSC` → `/jobs?q={term}` (no category seed); `Railways`/`Banking`/`Defence` → `/category/{slug}` (seeded category slugs).
- **Zero-state handling**: latest-jobs grid falls back to "No active jobs right now. Check back soon."; featured-states section hidden if 0 rows; type cards always render all 4.

## Verification — 2026-06-14

`npm run build` → clean (server built in 2.24s).

`npm run dev` (port 4321) end-to-end checks:

| Check | Result |
|---|---|
| `GET /` | HTTP 200, 23 004 bytes |
| `<title>` matches spec line 1164 | OK — `SarkariNaukriBoard — Government & Private Jobs in India 2026` |
| `<meta name="description">` matches spec line 1165 | OK |
| `<link rel="canonical">` from SITE_URL | OK — `https://example.com/` |
| H1 sentence-case + period | OK — "Find your dream government job." |
| Live count subline | OK — "Browse 2 sarkari and private jobs across India." (matches `SELECT COUNT(*)` against seed) |
| Search form action + name | OK — `<form action="/jobs" method="get" role="search">` with `name="q"` |
| Quick links resolve | OK — `/jobs?q=UPSC` 200, `/jobs?q=SSC` 200, `/category/railways` 200, `/category/banking` 200, `/category/defence` 200 |
| 4 job-type cards | OK — all 4 `href="/jobs?type={slug}"` present; each route 200s |
| Latest jobs rendered | OK — 2 `<article>` elements (matches 2 seeded non-expired jobs) |
| Featured states | OK — single "All India · 2 jobs" card → `/state/all-india` 200 (inner join hides 0-job states by design) |
| 12 category chips | OK — unique `/category/{slug}` link count = 12 |
| No client hydration | OK — zero `astro-island` markers; only 3 Astro dev HMR `<script>` tags (stripped in production build) |
| Last-date red highlight (≤7d) | Inherited from `JobCard` (verified 2026-06-14 in earlier feature work) |

DB sanity (`wrangler d1 execute --local`): 2 published rows, last_date range 2026-06-16 → 2026-07-13 — both within the active window, both render.
