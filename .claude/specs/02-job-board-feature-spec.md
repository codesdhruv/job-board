# Job Board — Feature Specification

**Project:** SarkariNaukriBoard
**Version:** 1.0
**Date:** June 2026
**Format:** One section per feature — purpose, UI, data, edge cases, acceptance criteria

---

## Table of Contents

1. [F-01 — Job Listing Page](#f-01--job-listing-page)
2. [F-02 — Job Detail Page](#f-02--job-detail-page)
3. [F-03 — Job Type Filter (Tabs)](#f-03--job-type-filter-tabs)
4. [F-04 — State Filter](#f-04--state-filter)
5. [F-05 — Category Filter](#f-05--category-filter)
6. [F-06 — Keyword Search](#f-06--keyword-search)
7. [F-07 — State Index Page](#f-07--state-index-page)
8. [F-08 — State Jobs Page](#f-08--state-jobs-page)
9. [F-09 — Category Jobs Page](#f-09--category-jobs-page)
10. [F-10 — Homepage](#f-10--homepage)
11. [F-11 — JobPosting JSON-LD (Google Jobs)](#f-11--jobposting-json-ld-google-jobs)
12. [F-12 — Sitemap](#f-12--sitemap)
13. [F-13 — RSS Feed](#f-13--rss-feed)
14. [F-14 — Admin Login](#f-14--admin-login)
15. [F-15 — Admin Dashboard](#f-15--admin-dashboard)
16. [F-16 — Admin Job List](#f-16--admin-job-list)
17. [F-17 — Post New Job](#f-17--post-new-job)
18. [F-18 — Edit Job](#f-18--edit-job)
19. [F-19 — Delete Job](#f-19--delete-job)
20. [F-20 — Pagination](#f-20--pagination)
21. [F-21 — SEO Meta Tags](#f-21--seo-meta-tags)
22. [F-22 — KV Caching Layer](#f-22--kv-caching-layer)
23. [F-23 — Auth Middleware](#f-23--auth-middleware)
24. [F-24 — robots.txt](#f-24--robotstxt)

---

## F-01 — Job Listing Page

**Route:** `/jobs`
**Surface:** Public

### Purpose
Main browsable listing of all published jobs. Primary landing page for search engine traffic and direct visitors. Supports filtering by type, state, category, and keyword.

### UI / Layout

```
[ Search bar — full width ]
[ Job Type tabs: All | Government | PSU/Semi-Govt | Private | Freelance/Gig ]
[ Row: State dropdown (grouped) | Category dropdown | Sort: Latest / Last date ]
[ Job count label: "Showing 240 jobs" ]

[ Job Card ]  [ Job Card ]  [ Job Card ]   ← 2-col on desktop, 1-col mobile
[ Job Card ]  [ Job Card ]  [ Job Card ]
...
[ Pagination ]
```

### Job Card contents
- Job title (h3, clickable → job detail)
- Department name + logo (if available)
- Job type badge (colour-coded: Govt = blue, PSU = orange, Private = green, Freelance = purple)
- State name (for govt/PSU jobs)
- Vacancies count (if available): "245 Posts"
- Last date: shown as "Last date: 15 Jul 2026" — highlighted red if ≤ 7 days away
- Salary range (if available)
- "View Details →" link

### Data query

```sql
SELECT j.*, jt.name AS type_name, jt.slug AS type_slug,
       c.name AS category_name, s.name AS state_name,
       d.name AS dept_name, d.logo_r2_key
FROM jobs j
LEFT JOIN job_types jt ON j.job_type_id = jt.id
LEFT JOIN categories c ON j.category_id = c.id
LEFT JOIN states s ON j.state_id = s.id
LEFT JOIN departments d ON j.department_id = d.id
WHERE j.is_published = 1
  AND j.last_date >= DATE('now')          -- hide expired
  [AND jt.slug = ?]                       -- type filter
  [AND s.slug = ?]                        -- state filter
  [AND c.slug = ?]                        -- category filter
  [AND j.title LIKE '%?%']               -- keyword search
ORDER BY j.created_at DESC
LIMIT 20 OFFSET ?
```

### Query params
- `?type=government` — filter by job type slug
- `?state=uttar-pradesh` — filter by state slug
- `?category=engineering` — filter by category slug
- `?q=clerk` — keyword search
- `?page=2` — pagination
- Params combine: `?type=government&state=delhi&page=1`

### Edge cases
- No results: show "No jobs found for your filters. Try removing a filter." with a "Clear filters" link
- Expired jobs (`last_date < today`) are excluded from listing automatically
- If `state` param is set but `type` is not govt/PSU, still filter by state (private jobs can also be state-specific)
- Invalid slug in query param (e.g. `?state=xyz`) — ignore filter, show all results

### Acceptance criteria
- [ ] Listing renders server-side (no client JS required to see jobs)
- [ ] 20 jobs per page
- [ ] All 4 filters work independently and in combination
- [ ] Expired jobs do not appear
- [ ] Job count label updates based on active filters
- [ ] Last date within 7 days shows red highlight
- [ ] Mobile: single column, filters collapse into an expandable panel

---

## F-02 — Job Detail Page

**Route:** `/jobs/[slug]`
**Surface:** Public

### Purpose
Full details of a single job. Primary SEO target — each page targets the job title + department + state as keywords. Contains `JobPosting` JSON-LD for Google Jobs eligibility.

### UI / Layout

```
[ Breadcrumb: Home › Jobs › {Category} › {Title} ]

[ Department logo ]  [ Job title (h1) ]
[ Job type badge ]   [ State name ]     [ Posted date ]

[ Info grid ]
  Vacancies    |  Last date      |  Salary
  Qualification|  Age limit      |  Category

[ Description (full HTML/markdown rendered) ]

[ Apply section ]
  "Apply Now →"  button → opens apply_url in new tab
  OR "Apply via email: jobs@dept.gov.in"

[ Sidebar (desktop) ]
  Similar jobs (same category, same state)
```

### Data query

```sql
SELECT j.*, jt.name AS type_name, jt.slug AS type_slug,
       c.name AS category_name, c.slug AS category_slug,
       s.name AS state_name, s.slug AS state_slug,
       d.name AS dept_name, d.logo_r2_key
FROM jobs j
LEFT JOIN job_types jt ON j.job_type_id = jt.id
LEFT JOIN categories c ON j.category_id = c.id
LEFT JOIN states s ON j.state_id = s.id
LEFT JOIN departments d ON j.department_id = d.id
WHERE j.slug = ? AND j.is_published = 1
```

### Similar jobs query (sidebar)
```sql
SELECT id, slug, title, last_date, dept_name
FROM jobs
WHERE category_id = ? AND id != ? AND is_published = 1
ORDER BY created_at DESC LIMIT 5
```

### Apply button behaviour
- If `apply_url` is set: render `<a href="{apply_url}" target="_blank" rel="noopener">Apply Now</a>`
- If only `apply_email`: render `<a href="mailto:{apply_email}">Apply via Email</a>`
- If both are null: show "Check official website for application details"

### Edge cases
- Slug not found → 404 page
- Job found but `is_published = 0` → 404 page (do not expose draft)
- Job found but `last_date` has passed → render page but show "Applications closed" banner; hide apply button
- Description field is null → skip description section

### Acceptance criteria
- [ ] Page renders for valid published slug
- [ ] 404 returned for invalid or unpublished slug
- [ ] `JobPosting` JSON-LD present in `<head>` (see F-11)
- [ ] Canonical URL set to `https://domain.com/jobs/{slug}`
- [ ] Apply button opens external URL in new tab
- [ ] Expired jobs show "Applications closed" banner
- [ ] Similar jobs sidebar renders up to 5 items
- [ ] Breadcrumb is present and correctly linked

---

## F-03 — Job Type Filter (Tabs)

**Route:** All listing pages
**Surface:** Public

### Purpose
Top-level filter that switches between the 4 job sectors. Most prominent filter on the page — drives the primary user intent split.

### UI

```
[ All ] [ Government ] [ PSU / Semi-Govt ] [ Private ] [ Freelance / Gig ]
```

- Active tab is visually highlighted
- Clicking a tab sets `?type={slug}` in the URL and reloads the page (server-side filter)
- "All" tab clears the type param
- Tab labels show job count in parentheses: `Government (184)`

### Behaviour
- Tab switch preserves other active filters (state, category, search)
- Example: user has `?state=delhi&category=teaching`, clicks Government tab → `?state=delhi&category=teaching&type=government`
- When switching to Government or PSU tab, state filter dropdown is promoted to top position (see F-04)

### Counts query

```sql
SELECT jt.slug, COUNT(*) as count
FROM jobs j
JOIN job_types jt ON j.job_type_id = jt.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now')
GROUP BY jt.slug
```

### Acceptance criteria
- [ ] 4 type tabs + All rendered on every listing page
- [ ] Active tab visually distinct
- [ ] Job counts shown in tabs
- [ ] Tab click preserves state/category/search filters
- [ ] Government/PSU tab promotes state filter (see F-04)

---

## F-04 — State Filter

**Route:** `/jobs`, `/state/*` pages
**Surface:** Public

### Purpose
Allow users to find jobs in their specific state. Especially critical for Govt and PSU jobs where recruitment is often state-specific. Neither SarkariResult nor Talentd offer this — it is the primary differentiator of this platform.

### UI

#### Default (All types or Private/Freelance)
```
[ Category ▾ ]  [ State ▾ ]  [ Sort ▾ ]
```

#### When type = Government or PSU (promoted)
```
[ Select your state ▾ ]          ← promoted, full width or first position
[ Category ▾ ]  [ Sort ▾ ]
```

### State dropdown structure

```
── All India (central govt — UPSC, SSC, Railways)
── States ──────────────────────
   Andhra Pradesh
   Arunachal Pradesh
   ...
   West Bengal
── Union Territories ───────────
   Andaman and Nicobar Islands
   Chandigarh
   Delhi
   ...
   Puducherry
```

- Implemented as HTML `<select>` with `<optgroup>` for States and Union Territories
- "All India" option is always first (outside both groups)
- Selected state name shown in the dropdown
- Selecting a state sets `?state={slug}` in URL and reloads

### SEO-friendly state URLs

When state filter is active alongside type, the canonical URL pattern is:
- All types in state: `/state/uttar-pradesh`
- Govt jobs in state: `/state/uttar-pradesh/government`
- PSU jobs in state: `/state/uttar-pradesh/psu`

These are separate Astro pages (see F-08), not just query-param pages. The filter on `/jobs` uses query params; the dedicated state pages are for SEO.

### Data

State dropdown populated from:
```sql
SELECT id, name, slug, is_union_territory FROM states ORDER BY is_union_territory, name
```

Counts per state (for listing page context):
```sql
SELECT s.slug, COUNT(*) as count
FROM jobs j JOIN states s ON j.state_id = s.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now')
  [AND j.job_type_id = ?]
GROUP BY s.slug
```

### Edge cases
- "All India" jobs appear when no state filter is set, and also when `state=all-india` is selected
- A state with 0 jobs still appears in the dropdown — shows "(0 jobs)" if counts are displayed
- Govt job posted without a state (data entry error) — show under "All India" as fallback
- State filter selected but no jobs in that state → show empty state message (see F-01)

### Acceptance criteria
- [ ] State dropdown renders with optgroups (States / Union Territories)
- [ ] "All India" appears first
- [ ] All 36 states/UTs present (28 states + 8 UTs)
- [ ] Selecting state adds `?state={slug}` to URL
- [ ] When type = Government or PSU, state dropdown is promoted to top/prominent position
- [ ] State filter combines correctly with type and category filters
- [ ] State with 0 jobs still appears in dropdown

---

## F-05 — Category Filter

**Route:** `/jobs`, all listing pages
**Surface:** Public

### Purpose
Secondary filter to narrow jobs by functional area (Engineering, Teaching, Banking, IT, etc.).

### UI
```
[ Category ▾ ]
  -- All categories --
  Banking
  Defence
  Engineering
  IT / Software
  Medical / Health
  Police / Law
  Railways
  Teaching / Education
  ...
```

- Single `<select>` dropdown
- Selecting a category sets `?category={slug}` in URL
- "All categories" option clears the filter

### Data

```sql
SELECT id, name, slug FROM categories ORDER BY name
```

### Acceptance criteria
- [ ] Category dropdown populated from DB
- [ ] Selecting category adds `?category={slug}` to URL
- [ ] Combines correctly with type, state, search filters
- [ ] "All categories" clears filter

---

## F-06 — Keyword Search

**Route:** `/jobs`
**Surface:** Public

### Purpose
Free-text search across job titles to help users find specific roles quickly.

### UI
```
[ 🔍  Search jobs by title, department... ]  [ Search ]
```

- Input field + submit button
- On submit, sets `?q={term}` in URL and reloads (server-side)
- Active search term shown in field on reload

### Query behaviour

```sql
WHERE j.title LIKE '%' || ? || '%'
  OR d.name LIKE '%' || ? || '%'
```

- Searches both job title and department name
- Case-insensitive (SQLite `LIKE` is case-insensitive for ASCII by default)
- Minimum 2 characters before searching (validate server-side)
- Combines with all other filters

### Edge cases
- Empty search term → treat as no search filter
- Search term < 2 chars → return all results (or show validation message)
- SQL injection: always use parameterised queries, never string interpolation

### Acceptance criteria
- [ ] Search input present on `/jobs` page
- [ ] Submitting sets `?q=` in URL
- [ ] Results filtered by title OR department name match
- [ ] Search term persists in input on page reload
- [ ] Combines with type, state, category filters
- [ ] No SQL injection possible (parameterised queries)

---

## F-07 — State Index Page

**Route:** `/states`
**Surface:** Public

### Purpose
A browsable index of all states and union territories, each linking to that state's job listings. Serves as an SEO hub page — links to all `/state/[slug]` pages for crawl discovery.

### UI / Layout

```
[ h1: Browse Jobs by State ]
[ p: Find government and private sector jobs in your state ]

── States ─────────────────────────────────────────
[ Andhra Pradesh  (42) ]  [ Arunachal Pradesh (3) ]
[ Assam (18) ]            [ Bihar (67) ]
...

── Union Territories ───────────────────────────────
[ Delhi (89) ]  [ Chandigarh (12) ]
...

[ All India — Central Govt (234) ]
```

- Grid layout, each state is a card/link
- Job count shown per state (only counting non-expired, published jobs)
- States with 0 jobs shown greyed out but still listed (for completeness)
- All India appears separately at the top or as a featured card

### Data

```sql
SELECT s.name, s.slug, s.is_union_territory,
       COUNT(j.id) as job_count
FROM states s
LEFT JOIN jobs j ON j.state_id = s.id
  AND j.is_published = 1
  AND j.last_date >= DATE('now')
GROUP BY s.id
ORDER BY s.is_union_territory, s.name
```

### SEO
- Page title: "Browse Jobs by State in India | {site name}"
- Meta description: "Find government, PSU, and private sector jobs in your state. Browse all 36 states and union territories."
- Links to all `/state/[slug]` pages (important for sitemap crawl depth)

### Acceptance criteria
- [ ] All 36 states + 8 UTs listed
- [ ] States and UTs in separate groups
- [ ] "All India" featured separately
- [ ] Job count shown per state
- [ ] Each state links to `/state/[slug]`
- [ ] States with 0 jobs greyed out but still visible

---

## F-08 — State Jobs Page

**Routes:**
- `/state/[slug]` — all jobs in a state
- `/state/[slug]/government` — govt jobs in a state
- `/state/[slug]/psu` — PSU jobs in a state

**Surface:** Public

### Purpose
Dedicated SEO page for each state's job listings. Targets search queries like "government jobs in Uttar Pradesh" or "sarkari naukri Delhi". These pages rank for state-specific job searches — a major traffic source.

### UI / Layout

```
[ Breadcrumb: Home › States › Uttar Pradesh ]

[ h1: Government Jobs in Uttar Pradesh ]
[ p: 184 active government jobs in Uttar Pradesh ]

[ Sub-type tabs (on /state/[slug] only): ]
  [ All ] [ Government ] [ PSU / Semi-Govt ] [ Private ]

[ Job cards — same component as F-01 ]
[ Pagination ]
```

### Data query (`/state/[slug]`)

```sql
SELECT j.*, jt.name, jt.slug as type_slug,
       c.name as category_name,
       d.name as dept_name
FROM jobs j
LEFT JOIN job_types jt ON j.job_type_id = jt.id
LEFT JOIN categories c ON j.category_id = c.id
LEFT JOIN departments d ON j.department_id = d.id
WHERE j.state_id = (SELECT id FROM states WHERE slug = ?)
  AND j.is_published = 1
  AND j.last_date >= DATE('now')
ORDER BY j.created_at DESC
LIMIT 20 OFFSET ?
```

For `/state/[slug]/government`, add: `AND jt.slug = 'government'`

### SEO (critical for these pages)

| Page | `<title>` | Meta description |
|---|---|---|
| `/state/uttar-pradesh` | Jobs in Uttar Pradesh 2026 — Sarkari & Private | Find latest govt, PSU and private sector jobs in Uttar Pradesh. {count} active vacancies. |
| `/state/uttar-pradesh/government` | Government Jobs in Uttar Pradesh 2026 — Sarkari Naukri UP | Latest sarkari naukri in Uttar Pradesh. UPPSC, UPSSSC, UP Police and more. {count} vacancies. |
| `/state/delhi/government` | Government Jobs in Delhi 2026 — Sarkari Naukri Delhi | ... |

- Canonical URL set to the page's own URL (not `/jobs?state=...`)
- JSON-LD `ItemList` schema listing the top 10 jobs on each state page

### Edge cases
- Invalid state slug → 404
- State exists but has 0 jobs → render page with "No active jobs in this state right now. Check back soon." (do not 404 — the page should exist for SEO)
- `/state/all-india/government` → shows central govt jobs (UPSC, SSC, Railways, etc.)

### Acceptance criteria
- [ ] `/state/[slug]` renders for every valid state slug
- [ ] `/state/[slug]/government` and `/state/[slug]/psu` render correctly
- [ ] Invalid slug returns 404
- [ ] State with 0 jobs renders page with empty state message (not 404)
- [ ] Page title and meta description are state-specific
- [ ] Canonical URL is the page URL, not `/jobs?state=...`
- [ ] Sub-type tabs on `/state/[slug]` link to the correct sub-pages

---

## F-09 — Category Jobs Page

**Route:** `/category/[slug]`
**Surface:** Public

### Purpose
SEO page targeting category-level search queries like "engineering government jobs India" or "banking jobs 2026".

### UI / Layout

```
[ Breadcrumb: Home › Categories › Engineering ]
[ h1: Engineering Jobs ]
[ p: 94 active engineering jobs across all sectors ]

[ Job type sub-filter tabs ]
[ Job cards ]
[ Pagination ]
```

### SEO
- Page title: `{Category} Jobs 2026 — Government, PSU & Private | {site name}`
- Meta description: `Find latest {category} jobs in India. {count} active vacancies in government, PSU and private sector.`

### Edge cases
- Invalid category slug → 404
- Category with 0 jobs → show empty state (not 404)

### Acceptance criteria
- [ ] Renders for valid category slug
- [ ] 404 for invalid slug
- [ ] Job type sub-filter works on this page
- [ ] SEO title and description are category-specific

---

## F-10 — Homepage

**Route:** `/`
**Surface:** Public

### Purpose
Entry point for direct and branded traffic. Showcases the platform, highlights job types, and funnels users to filtered listings. Must load fast and convey trust.

### UI / Layout

```
[ Hero section ]
  "Find Your Dream Government Job"
  "Browse 1,200+ Sarkari and private jobs across India"
  [ Search input: job title or keyword ]  [ Search ]
  [ Quick links: UPSC | SSC | Railways | Banking | Defence ]

[ Job type cards ]
  [ Government (184) ]  [ PSU (67) ]  [ Private (340) ]  [ Freelance (89) ]

[ Latest jobs — last 10 posted ]
  [ Job card ] [ Job card ] ... [ View all jobs → ]

[ Browse by State — featured states ]
  [ UP (89) ] [ Maharashtra (67) ] [ Delhi (54) ] [ Bihar (43) ] ... [ View all states → ]

[ Browse by Category ]
  [ Teaching ] [ Banking ] [ Engineering ] [ IT ] [ Medical ] ... [ View all → ]

[ Footer: About | Contact | Sitemap ]
```

### Data queries

Latest 10 jobs:
```sql
SELECT j.id, j.slug, j.title, j.last_date, j.vacancies,
       jt.name as type_name, jt.slug as type_slug,
       s.name as state_name, d.name as dept_name
FROM jobs j
LEFT JOIN job_types jt ON j.job_type_id = jt.id
LEFT JOIN states s ON j.state_id = s.id
LEFT JOIN departments d ON j.department_id = d.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now')
ORDER BY j.created_at DESC LIMIT 10
```

Featured states (top 8 by job count):
```sql
SELECT s.name, s.slug, COUNT(j.id) as count
FROM states s JOIN jobs j ON j.state_id = s.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now')
GROUP BY s.id ORDER BY count DESC LIMIT 8
```

### Acceptance criteria
- [ ] Hero search bar functional — submits to `/jobs?q=`
- [ ] Job type cards link to `/jobs?type={slug}`
- [ ] Latest 10 jobs shown with last date highlight
- [ ] Featured states section links to `/state/[slug]`
- [ ] Category links go to `/category/[slug]`
- [ ] Page loads without client-side JS (pure SSR)

---

## F-11 — JobPosting JSON-LD (Google Jobs)

**Route:** `/jobs/[slug]`
**Surface:** Public (injected in `<head>`)

### Purpose
Structured data that makes individual job pages eligible for Google Jobs rich results — the job listings shown directly in Google Search. This is the platform's biggest SEO advantage over competitors.

### Schema

```json
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "{job.title}",
  "description": "{job.description — strip HTML tags, max 500 chars}",
  "identifier": {
    "@type": "PropertyValue",
    "name": "{dept.name}",
    "value": "{job.slug}"
  },
  "datePosted": "{job.created_at — ISO 8601 date}",
  "validThrough": "{job.last_date — ISO 8601 with T00:00:00}",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "{dept.name}",
    "sameAs": "{dept.website if available}"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "{job.location}",
      "addressRegion": "{state.name}",
      "addressCountry": "IN"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "value": {
      "@type": "QuantitativeValue",
      "value": "{salary min — numeric only}",
      "unitText": "MONTH"
    }
  }
}
```

### Field mapping rules

| Schema field | Source | Fallback |
|---|---|---|
| `title` | `jobs.title` | required — no fallback |
| `description` | `jobs.description` (HTML stripped) | `jobs.title` + department name |
| `datePosted` | `jobs.created_at` | required |
| `validThrough` | `jobs.last_date` | omit field |
| `hiringOrganization.name` | `departments.name` | omit organization block |
| `addressLocality` | `jobs.location` | omit |
| `addressRegion` | `states.name` | omit |
| `baseSalary.value` | parse first number from `jobs.salary` | omit baseSalary block |

### Implementation

```astro
---
// JsonLd.astro component
const { job, dept, state } = Astro.props;
const schema = buildJobPostingSchema(job, dept, state); // lib/seo.ts
---
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

### Edge cases
- Salary field is text like "₹35,400 – ₹1,12,400" → parse first numeric value (35400) for `baseSalary`
- Description contains HTML → strip all tags before injecting into JSON-LD
- `last_date` must be formatted as `"2026-07-15T00:00:00"` (Google requires datetime format)
- If `dept` is null → omit `hiringOrganization` entirely (don't include empty object)

### Acceptance criteria
- [ ] `<script type="application/ld+json">` present in `<head>` of every job detail page
- [ ] Schema validates at Google's Rich Results Test
- [ ] `validThrough` formatted as ISO datetime string
- [ ] HTML stripped from description
- [ ] Missing optional fields omitted entirely (not set to null or empty string)
- [ ] `addressCountry` always "IN"

---

## F-12 — Sitemap

**Route:** `/sitemap.xml`
**Surface:** Public (crawlers)

### Purpose
XML sitemap for search engine discovery. Covers all job detail pages, state pages, and category pages. Submitted to Google Search Console.

### Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Static pages -->
  <url><loc>https://domain.com/</loc></url>
  <url><loc>https://domain.com/jobs</loc></url>
  <url><loc>https://domain.com/states</loc></url>

  <!-- State pages -->
  <url><loc>https://domain.com/state/uttar-pradesh</loc></url>
  <url><loc>https://domain.com/state/uttar-pradesh/government</loc></url>
  <url><loc>https://domain.com/state/uttar-pradesh/psu</loc></url>
  <!-- ... for all states that have at least 1 job -->

  <!-- Category pages -->
  <url><loc>https://domain.com/category/engineering</loc></url>
  <!-- ... for all categories with at least 1 job -->

  <!-- Job detail pages -->
  <url>
    <loc>https://domain.com/jobs/drdo-junior-engineer-2026</loc>
    <lastmod>2026-06-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... for all is_published = 1 jobs -->

</urlset>
```

### Generation logic
- State sub-pages (`/state/[slug]/government`) only included if that state has ≥ 1 job of that type
- Expired jobs excluded from sitemap (`last_date < today`)
- `<lastmod>` = `jobs.updated_at` (or `created_at` if never updated)

### Acceptance criteria
- [ ] Sitemap accessible at `/sitemap.xml`
- [ ] Valid XML — passes sitemap validator
- [ ] All published, non-expired job pages included
- [ ] State pages only included if they have ≥ 1 job
- [ ] `<lastmod>` present on job pages
- [ ] Expired jobs excluded

---

## F-13 — RSS Feed

**Route:** `/rss.xml`
**Surface:** Public (RSS readers, aggregators)

### Purpose
RSS feed of latest job postings. Allows users to subscribe for updates via RSS readers. Also helps with content syndication.

### Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SarkariNaukriBoard — Latest Jobs</title>
    <link>https://domain.com</link>
    <description>Latest government and private sector job listings</description>
    <lastBuildDate>{current datetime}</lastBuildDate>

    <item>
      <title>Junior Engineer — DRDO</title>
      <link>https://domain.com/jobs/drdo-junior-engineer-2026</link>
      <description>245 vacancies. Last date: 15 Jul 2026. State: All India.</description>
      <pubDate>Wed, 01 Jun 2026 00:00:00 +0530</pubDate>
      <guid>https://domain.com/jobs/drdo-junior-engineer-2026</guid>
    </item>
    <!-- Latest 50 jobs -->
  </channel>
</rss>
```

### Acceptance criteria
- [ ] Feed at `/rss.xml`
- [ ] Latest 50 published, non-expired jobs
- [ ] Valid RSS 2.0 — passes W3C feed validator
- [ ] `pubDate` in RFC 822 format

---

## F-14 — Admin Login

**Route:** `/admin/login`
**Surface:** Admin

### Purpose
Password-protected entry to the admin panel. Single admin account — no registration.

### UI

```
[ Logo / site name ]

[ Username ]
[ Password ]
[ Login ]

[ Error: "Invalid username or password" ]  ← shown on failed attempt
```

### Flow
1. Admin submits form (POST `/admin/login`)
2. Server checks username + bcrypt-verify password against `admins` table
3. On success: set `httpOnly; Secure; SameSite=Strict` cookie with signed session token → redirect to `/admin/dashboard`
4. On failure: re-render login page with error message

### Session token
- Signed with `ADMIN_SECRET` env var using HMAC-SHA256
- Contains: `{ adminId, username, expiresAt }`
- Expiry: 8 hours from login
- Cookie name: `admin_session`

### Security
- Rate limiting: max 5 failed attempts per IP per 15 minutes (use KV to track attempts)
- Do not reveal whether username or password was wrong — always show generic "Invalid username or password"
- Password stored as bcrypt hash (cost factor 12)

### Edge cases
- Already logged in (valid cookie) → redirect to `/admin/dashboard`, skip login page
- Cookie exists but expired → clear cookie, redirect to login
- `ADMIN_SECRET` not set → throw 500 error on startup

### Acceptance criteria
- [ ] Login form renders at `/admin/login`
- [ ] Valid credentials set session cookie and redirect to dashboard
- [ ] Invalid credentials show error, no redirect
- [ ] Cookie is `httpOnly`, `Secure`, `SameSite=Strict`
- [ ] Session expires after 8 hours
- [ ] Already-logged-in admin redirected from login page to dashboard
- [ ] Rate limiting on failed attempts

---

## F-15 — Admin Dashboard

**Route:** `/admin/dashboard`
**Surface:** Admin

### Purpose
At-a-glance overview of platform health. First page after login.

### UI

```
[ Sidebar nav: Dashboard | Jobs | Add Job | Logout ]

[ Metric cards ]
  [ Total live jobs: 312 ]  [ Expiring in 7 days: 14 ]  [ Drafts: 3 ]  [ Expired: 28 ]

[ Expiring soon — table ]
  Title              | Dept      | Last date   | Actions
  ─────────────────────────────────────────────────────
  UP Police Const.   | UPPRPB    | 20 Jun 2026 | Edit  Delete
  SSC CGL 2026       | SSC       | 22 Jun 2026 | Edit  Delete
  ...

[ Recently added — last 5 ]
  Title              | Type    | State   | Posted     | Actions
  ...
```

### Data queries

```sql
-- Counts
SELECT COUNT(*) FROM jobs WHERE is_published = 1 AND last_date >= DATE('now');   -- live
SELECT COUNT(*) FROM jobs WHERE is_published = 1
  AND last_date BETWEEN DATE('now') AND DATE('now', '+7 days');                   -- expiring
SELECT COUNT(*) FROM jobs WHERE is_published = 0;                                 -- drafts
SELECT COUNT(*) FROM jobs WHERE last_date < DATE('now');                          -- expired

-- Expiring soon
SELECT j.id, j.slug, j.title, j.last_date, d.name as dept_name
FROM jobs j LEFT JOIN departments d ON j.department_id = d.id
WHERE j.is_published = 1 AND j.last_date BETWEEN DATE('now') AND DATE('now', '+7 days')
ORDER BY j.last_date ASC;
```

### Acceptance criteria
- [ ] All 4 metric counts correct
- [ ] Expiring soon table shows jobs with last_date within 7 days
- [ ] Edit and Delete links functional from dashboard
- [ ] Sidebar navigation present on all admin pages
- [ ] Redirect to login if session missing or expired

---

## F-16 — Admin Job List

**Route:** `/admin/jobs`
**Surface:** Admin

### Purpose
Full list of all jobs (published + draft + expired) for management. Allows quick edit and delete.

### UI

```
[ h1: All Jobs ]  [ + Add New Job ]

[ Search: filter by title ]  [ Filter: Type ▾ ]  [ Filter: Status ▾ ]

[ Table ]
  ID | Title              | Type    | State | Last Date   | Status  | Actions
  ───────────────────────────────────────────────────────────────────────────────
  42 | UP Police Const.   | Govt    | UP    | 20 Jun 2026 | Live    | Edit Delete
  41 | SSC CGL 2026       | Govt    | All   | 22 Jun 2026 | Live    | Edit Delete
  40 | TCS Developer      | Private | —     | 30 Jun 2026 | Draft   | Edit Delete
  39 | DRDO JE            | Govt    | All   | 10 May 2026 | Expired | Edit Delete

[ Pagination — 50 per page ]
```

- Status colour codes: Live = green, Draft = amber, Expired = red
- Table is sorted by `created_at DESC` by default
- Search filters by title (client-side on current page, or server-side on submit)

### Acceptance criteria
- [ ] All jobs listed (published + draft + expired)
- [ ] Status shown with colour coding
- [ ] Edit links go to `/admin/jobs/[id]/edit`
- [ ] Delete triggers F-19
- [ ] "+ Add New Job" button goes to `/admin/jobs/new`
- [ ] 50 rows per page with pagination

---

## F-17 — Post New Job

**Route:** `/admin/jobs/new`
**Surface:** Admin

### Purpose
Form to add a new job listing to the platform.

### UI / Form fields

```
[ h1: Post New Job ]

Section: Basic Info
  Title *                    [ text input ]
  Department                 [ searchable select — from departments table ]
  Job Type *                 [ select: Government | PSU/Semi-Govt | Private | Freelance/Gig ]
  Category                   [ select — from categories table ]

Section: Location
  State *  (required if type = Govt or PSU)
            [ searchable select, optgroup: All India | States | UTs ]
  City / District            [ text input — optional ]

Section: Job Details
  Vacancies                  [ number input ]
  Qualification              [ text input ]
  Age Limit                  [ text input — e.g. "18–30 years" ]
  Salary                     [ text input — e.g. "₹35,400 – ₹1,12,400" ]
  Last Date *                [ date picker ]

Section: Apply
  Apply URL                  [ URL input ]
  OR Apply Email             [ email input ]
  (at least one required)

Section: Description
  Description                [ textarea — markdown or plain text ]

Section: Publishing
  Status                     [ toggle: Draft | Published ]
  Slug (auto-generated from title, editable)

[ Save Job ]  [ Cancel ]
```

### Slug generation
- Auto-generated from title on input blur: `"DRDO Junior Engineer 2026"` → `"drdo-junior-engineer-2026"`
- Lowercase, spaces to hyphens, strip special chars, max 80 chars
- Editable by admin — manual override allowed
- Uniqueness checked on save — if duplicate, append `-2`, `-3` etc.

### State field conditional requirement
- When Job Type is changed to Government or PSU → State field gets `required` attribute + red asterisk
- When Job Type is Private or Freelance → State field becomes optional

### Validation (server-side — all checks run on POST)

| Field | Rule |
|---|---|
| `title` | Required, max 200 chars |
| `job_type_id` | Required, must be valid FK |
| `last_date` | Required, must be today or future |
| `state_id` | Required if type = Government or PSU |
| `apply_url` OR `apply_email` | At least one must be present |
| `slug` | Required, unique, URL-safe |
| `apply_url` | Must be valid URL if provided |
| `apply_email` | Must be valid email if provided |

### On success
- Insert into `jobs` table
- Invalidate all KV listing caches
- Redirect to `/admin/jobs` with flash: "Job posted successfully"

### Acceptance criteria
- [ ] All form fields render correctly
- [ ] State field becomes required when type = Govt or PSU (client + server validation)
- [ ] Slug auto-generated from title
- [ ] Slug uniqueness enforced
- [ ] At least one of apply_url or apply_email required
- [ ] Last date must not be in the past
- [ ] On success: job saved, KV cleared, redirect with success message
- [ ] On error: form re-rendered with validation errors, data preserved

---

## F-18 — Edit Job

**Route:** `/admin/jobs/[id]/edit`
**Surface:** Admin

### Purpose
Edit an existing job listing. Same form as F-17 but pre-populated.

### Behaviour
- Form pre-populated from `jobs` record
- `updated_at` set to `CURRENT_TIMESTAMP` on save
- All same validation as F-17
- Slug can be edited — changing it will break any existing external links or bookmarks (show a warning)
- KV cache invalidated on save

### Additional field: Slug change warning
If admin changes the slug of a published job, show inline warning:
> "Changing the slug will change the job's URL. Existing links will break. Are you sure?"

### Acceptance criteria
- [ ] Form pre-populated with existing job data
- [ ] All F-17 validations apply
- [ ] `updated_at` updated on save
- [ ] Slug change warning shown
- [ ] KV cache invalidated on save
- [ ] Redirect to admin job list with "Job updated" message

---

## F-19 — Delete Job

**Trigger:** Delete button in F-16 (admin job list) or F-15 (dashboard)
**Surface:** Admin

### Purpose
Remove a job from the platform.

### Flow
1. Admin clicks "Delete" on a job row
2. Confirmation dialog: "Are you sure you want to delete '{title}'? This cannot be undone."
3. Admin confirms → POST to `/admin/jobs/[id]/delete`
4. Server deletes the record from `jobs` table (hard delete)
5. KV cache invalidated
6. Redirect back to job list with "Job deleted" message

### Alternative: soft delete
Rather than hard delete, set `is_published = 0` and `last_date = yesterday`. This keeps the record for audit purposes. Decision: **hard delete** for v1 (simpler, no audit requirement).

### Acceptance criteria
- [ ] Confirmation dialog before delete
- [ ] Hard delete from `jobs` table
- [ ] KV cache cleared after delete
- [ ] Success message shown after redirect
- [ ] Deleted job no longer appears anywhere on public site

---

## F-20 — Pagination

**Route:** All listing pages
**Surface:** Public + Admin

### Purpose
Break long job listings into pages of 20 (public) or 50 (admin).

### UI (public)

```
  [ ← Prev ]  [ 1 ]  [ 2 ]  [3]  [ 4 ]  [ 5 ]  [ Next → ]
```

- Current page highlighted
- Show at most 5 page numbers, with `...` for gaps on large result sets
- `[ ← Prev ]` disabled on page 1
- `[ Next → ]` disabled on last page
- Page number in URL: `?page=2`
- Preserves all other query params on page change

### Implementation

```
Total pages = CEIL(total_count / page_size)
OFFSET = (page - 1) * page_size
```

### Acceptance criteria
- [ ] 20 jobs per page on public listing
- [ ] 50 jobs per page on admin job list
- [ ] Page param in URL (`?page=n`)
- [ ] All other filters preserved across page changes
- [ ] Prev/Next disabled at boundaries
- [ ] Correct total page count

---

## F-21 — SEO Meta Tags

**Route:** All public pages
**Surface:** Public (browser `<head>`)

### Purpose
Per-page meta tags for search engine ranking and social sharing.

### Tag set per page type

#### Homepage (`/`)
```html
<title>SarkariNaukriBoard — Government & Private Jobs in India 2026</title>
<meta name="description" content="Find latest government, PSU and private sector jobs across India. Browse by state, category and job type. Updated daily.">
<meta property="og:title" content="SarkariNaukriBoard — Jobs in India 2026">
<meta property="og:type" content="website">
<link rel="canonical" href="https://domain.com/">
```

#### Job detail (`/jobs/[slug]`)
```html
<title>{title} — {dept_name} | SarkariNaukriBoard</title>
<meta name="description" content="Apply for {title} at {dept_name}. {vacancies} vacancies. Last date: {last_date_formatted}. State: {state_name}.">
<link rel="canonical" href="https://domain.com/jobs/{slug}">
```

#### State page (`/state/[slug]/government`)
```html
<title>Government Jobs in {state_name} 2026 — Sarkari Naukri {state_name}</title>
<meta name="description" content="Latest sarkari naukri in {state_name}. {count} active government vacancies. Apply now.">
<link rel="canonical" href="https://domain.com/state/{slug}/government">
```

#### Category page (`/category/[slug]`)
```html
<title>{category_name} Jobs 2026 — Govt, PSU & Private | SarkariNaukriBoard</title>
<meta name="description" content="Find latest {category_name} jobs in India. {count} active vacancies.">
```

### Rules
- Every page has a unique `<title>` — no duplicates
- Every page has a `<meta name="description">` — max 155 chars
- Every page has a `<link rel="canonical">` pointing to its own URL
- `<meta name="robots" content="index, follow">` on all public pages
- `<meta name="robots" content="noindex, nofollow">` on all `/admin/*` pages

### Acceptance criteria
- [ ] Every public page has unique title and description
- [ ] Canonical tag on every public page
- [ ] Admin pages have noindex meta
- [ ] No title truncated beyond 60 chars (check with Astro's `<meta>` helper)
- [ ] Description never exceeds 155 chars

---

## F-22 — KV Caching Layer

**Surface:** Server (Astro SSR + Cloudflare Workers)

### Purpose
Reduce D1 query load on high-traffic listing pages. Cache listing results in Cloudflare KV with short TTLs. Invalidate on any admin write.

### Cache key scheme

| Page | KV key |
|---|---|
| `/jobs` (page 1) | `jobs:all:p1` |
| `/jobs?type=government&page=2` | `jobs:type:government:p2` |
| `/jobs?state=up&type=government` | `jobs:state:up:type:government:p1` |
| `/state/uttar-pradesh` (page 1) | `jobs:state:uttar-pradesh:p1` |
| `/state/uttar-pradesh/government` | `jobs:state:uttar-pradesh:type:government:p1` |
| Job counts for tabs | `counts:all` |

### Read strategy (cache-aside)

```typescript
async function getListingCached(key: string, fetchFn: () => Promise<Job[]>) {
  const cached = await KV.get(key, 'json');
  if (cached) return cached;
  const data = await fetchFn();        // query D1
  await KV.put(key, JSON.stringify(data), { expirationTtl: 300 }); // 5 min
  return data;
}
```

### Invalidation on admin write

On any create, update, or delete in admin:

```typescript
async function invalidateAllListingCaches() {
  const keys = await KV.list({ prefix: 'jobs:' });
  await Promise.all(keys.keys.map(k => KV.delete(k.name)));
}
```

### What is NOT cached
- Job detail pages (`/jobs/[slug]`) — low traffic per page, no benefit
- Admin pages — never cached

### Acceptance criteria
- [ ] Listing pages read from KV on cache hit
- [ ] D1 queried only on cache miss
- [ ] TTL is 5 minutes for listings, 10 minutes for counts
- [ ] All `jobs:*` KV keys deleted on any admin write
- [ ] Cache miss does not error — falls through to D1

---

## F-23 — Auth Middleware

**Route:** All `/admin/*` routes
**Surface:** Server (Astro middleware)

### Purpose
Protect all admin routes. Every request to `/admin/*` (except `/admin/login`) must have a valid session cookie.

### Implementation (`src/middleware/index.ts`)

```typescript
export async function onRequest({ request, cookies, redirect }) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/admin')) return;
  if (url.pathname === '/admin/login') return;   // allow login page through

  const session = cookies.get('admin_session');
  if (!session) return redirect('/admin/login');

  const valid = await verifySession(session.value, ADMIN_SECRET);
  if (!valid) {
    cookies.delete('admin_session');
    return redirect('/admin/login');
  }
}
```

### Acceptance criteria
- [ ] All `/admin/*` routes except `/admin/login` are protected
- [ ] Missing cookie → redirect to login
- [ ] Invalid/expired session → clear cookie + redirect to login
- [ ] Valid session → request passes through

---

## F-24 — robots.txt

**Route:** `/robots.txt`
**Surface:** Public (crawlers)

### Purpose
Control which pages search engine crawlers index.

### Content

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /admin/*

Sitemap: https://domain.com/sitemap.xml
```

### Acceptance criteria
- [ ] `robots.txt` accessible at `/robots.txt`
- [ ] `/admin/*` disallowed
- [ ] Sitemap URL included

---

## Appendix — Feature Priority Matrix

| Feature | Priority | Phase |
|---|---|---|
| F-01 Job listing page | P0 | 2 |
| F-02 Job detail page | P0 | 2 |
| F-03 Job type filter | P0 | 2 |
| F-04 State filter | P0 | 2 |
| F-11 JSON-LD | P0 | 2 |
| F-14 Admin login | P0 | 3 |
| F-17 Post new job | P0 | 3 |
| F-23 Auth middleware | P0 | 3 |
| F-05 Category filter | P1 | 2 |
| F-06 Keyword search | P1 | 2 |
| F-08 State jobs page | P1 | 2 |
| F-10 Homepage | P1 | 2 |
| F-15 Admin dashboard | P1 | 3 |
| F-16 Admin job list | P1 | 3 |
| F-18 Edit job | P1 | 3 |
| F-19 Delete job | P1 | 3 |
| F-20 Pagination | P1 | 2 |
| F-21 SEO meta tags | P1 | 4 |
| F-07 State index page | P2 | 2 |
| F-09 Category jobs page | P2 | 2 |
| F-12 Sitemap | P2 | 4 |
| F-13 RSS feed | P2 | 4 |
| F-22 KV caching | P2 | 4 |
| F-24 robots.txt | P2 | 4 |