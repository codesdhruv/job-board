# F-09 — Category Jobs Page

## Context

The job board needs SEO landing pages for category-level searches like "engineering government jobs India" or "banking jobs 2026". F-09 (`/category/[slug]`) is the category counterpart to the already-built F-08 state pages. Each of the 12 seeded categories needs its own crawlable page with a unique title/description, job-type sub-filter, and standard job-card listing. Without this, category queries have no dedicated landing surface, and the sitemap (F-12) has nothing to point at for category SEO.

This implementation mirrors F-08 (`src/pages/state/[slug].astro`) closely, since the shape is identical: validate slug → 404 or render → list jobs → sub-type tabs that preserve filter state via query params.

## Scope

Build one new SSR route: `src/pages/category/[slug].astro`.

Per the F-09 spec (lines 538–571):
- Breadcrumb: `Home › Categories › {category.name}`
- `<h1>{category.name} Jobs</h1>` + lede: "{count} active {category} jobs across all sectors"
- Job type sub-filter tabs: `All | Government | PSU / Semi-Govt | Private | Freelance / Gig` driven by `?type={slug}` query param (no dedicated `/category/[slug]/government` sub-routes — spec defines none)
- Reuse `JobCard.astro`
- 404 on invalid category slug
- Empty state (NOT 404) when category exists but has 0 matching jobs
- SEO: title `{Category} Jobs 2026 — Government, PSU & Private | SarkariNaukriBoard`, description `Find latest {category} jobs in India. {count} active vacancies in government, PSU and private sector.`, canonical `${SITE_URL}/category/{slug}`

Out of scope (deferred): pagination (F-20), `ItemList` JSON-LD (F-11/F-21), KV caching (F-22), per-tab counts.

## Files

**New:** `src/pages/category/[slug].astro`

**Reused (read-only):**
- `src/components/JobCard.astro` — card renderer
- `src/lib/db.ts` — `getDb()` + row interfaces
- `src/layouts/BaseLayout.astro` — accepts `title`, `description`, `canonical`

**Reference patterns mirrored:**
- `src/pages/state/[slug].astro` — slug lookup → 404, SELECT/JOIN query shape, empty-state message, breadcrumb, canonical builder using `(env as any).SITE_URL` with `replace(/\/$/, '')`, tab markup with `aria-current="page"` + inline ink-token (`#171717`, weight 600, 2px underline) for active tab
- `src/pages/jobs/index.astro` — `hrefFor()` helper pattern for tab href construction preserving query params; adapted base path to `/category/{slug}` and type-param whitelisting

## Implementation summary

```astro
---
import { env } from 'cloudflare:workers';
import BaseLayout from '../../layouts/BaseLayout.astro';
import JobCard from '../../components/JobCard.astro';
import { getDb } from '../../lib/db';

const db = getDb();
const { slug } = Astro.params;

const categoryRow = await db
  .prepare(`SELECT id, name, slug FROM categories WHERE slug = ?`)
  .bind(slug)
  .first<{ id: number; name: string; slug: string }>();

if (!categoryRow) return new Response(null, { status: 404 });

const validTypes = ['government', 'psu', 'private', 'freelance'];
const typeParam = Astro.url.searchParams.get('type');
const activeType = typeParam && validTypes.includes(typeParam) ? typeParam : null;

const sql = `SELECT j.*, jt.name AS type_name, jt.slug AS type_slug,
        c.name AS category_name, s.name AS state_name,
        s.slug AS state_slug, d.name AS dept_name, d.logo_r2_key
 FROM jobs j
 LEFT JOIN job_types jt ON j.job_type_id = jt.id
 LEFT JOIN categories c ON j.category_id = c.id
 LEFT JOIN states s ON j.state_id = s.id
 LEFT JOIN departments d ON j.department_id = d.id
 WHERE j.is_published = 1
   AND j.last_date >= DATE('now')
   AND c.slug = ?
   ${activeType ? "AND jt.slug = ?" : ''}
 ORDER BY j.created_at DESC`;

const stmt = activeType
  ? db.prepare(sql).bind(categoryRow.slug, activeType)
  : db.prepare(sql).bind(categoryRow.slug);
const { results } = await stmt.all();
const count = results.length;

function hrefFor(typeSlug: string | null) {
  const p = new URLSearchParams(Astro.url.searchParams);
  p.delete('page');
  if (typeSlug) p.set('type', typeSlug);
  else p.delete('type');
  const qs = p.toString();
  return qs ? `/category/${categoryRow.slug}?${qs}` : `/category/${categoryRow.slug}`;
}

const tabs = [
  { label: 'All', slug: null },
  { label: 'Government', slug: 'government' },
  { label: 'PSU / Semi-Govt', slug: 'psu' },
  { label: 'Private', slug: 'private' },
  { label: 'Freelance / Gig', slug: 'freelance' },
];

const title = `${categoryRow.name} Jobs 2026 — Government, PSU & Private | SarkariNaukriBoard`;
const description = `Find latest ${categoryRow.name} jobs in India. ${count} active vacancies in government, PSU and private sector.`;
const siteUrl = (env as any).SITE_URL ?? '';
const canonical = siteUrl ? `${siteUrl.replace(/\/$/, '')}/category/${categoryRow.slug}` : undefined;
---
```

Markup: breadcrumb (`Home › Categories › {name}` — "Categories" is a plain `<span>`, no index page exists), `<h1>{name} Jobs</h1>`, lede with count, tab `<nav>` mapping `tabs` through `hrefFor()` with `aria-current="page"` + ink-token underline on the active tab (determined by `t.slug === activeType`), then either the empty-state `<p>` or `results.map((j) => <JobCard job={j} />)`.

## Key decisions

- **No dedicated sub-routes** (`/category/[slug]/government` etc.) — spec line 538 only defines `/category/[slug]`. Sub-filtering done via `?type=` query param.
- **Type slugs confirmed from schema.sql seed:** `government`, `psu`, `private`, `freelance` (not `psu-semi-govt` / `freelance-gig` as the plan draft initially guessed).
- **Breadcrumb "Categories"** is a plain `<span>` (no `/categories` index page exists in scope).
- **Empty state** uses category-specific phrasing parallel to F-08's state message: "No active jobs in this category right now. Check back soon."
- **All 5 tabs included** (All + 4 job types) — broader than F-08's 4 tabs (which omits Freelance) because category pages are sector-agnostic.
- **Branching `.bind()`** rather than spreading a `binds` array — matches the `prepare().bind().first()` chaining style already used in `state/[slug].astro` and keeps the D1 typings clean.

## Verification (completed 2026-06-14)

- `npm run build` ✓ — `astro build` completes with no errors.
- `/category/engineering` → 200, h1 "Engineering Jobs", count rendered, "All" tab active.
- `/category/engineering?type=government` → 200, Government tab `aria-current="page"`, listing filtered to government rows.
- `/category/banking` (no seeded jobs) → 200, empty-state message, NOT 404.
- `/category/does-not-exist` → 404.
- Page source: `<title>`, `<meta name="description">`, `<link rel="canonical">` match spec strings with `{count}` interpolated.
