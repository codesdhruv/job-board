# Implement F-11, F-12, F-13

## Context

 Phase 4 SEO features. The job board now has all public listing/detail pages built but emits no structured data, no sitemap, and no RSS
  — three things Google needs for discovery. Spec section is .claude/specs/02-job-board-feature-spec.md lines 639–820.

 - F-11 — Inject JobPosting JSON-LD into <head> of every /jobs/[slug] to qualify for Google Jobs rich results.
 - F-12 — Serve /sitemap.xml listing static pages, state pages (incl. /government and /psu sub-pages only when ≥1 matching job),
 category pages with ≥1 job, and every published non-expired job detail page.
 - F-13 — Serve /rss.xml (RSS 2.0) with the latest 50 published non-expired jobs.

 src/lib/seo.ts already exports a working buildJobPostingSchema(job, dept, state) builder — reuse it. astro.config.mjs is output:
 'server' with the Cloudflare adapter, so .ts endpoint files at src/pages/sitemap.xml.ts / src/pages/rss.xml.ts will be SSR routes.
 SITE_URL is bound via wrangler.jsonc and read with import { env } from 'cloudflare:workers' per the existing pattern
 (states.astro:32–33).

 ---
## F-11 — JobPosting JSON-LD

 1. Add a head slot to src/layouts/BaseLayout.astro

 Insert <slot name="head" /> just before </head> (after the canonical link). One-line change; no other layout users are affected since
 named slots are opt-in.

 2. Inject JSON-LD from src/pages/jobs/[slug].astro

 - Import buildJobPostingSchema from ../../lib/seo.
 - After the existing job fetch, when job exists and !isExpired (Google rejects expired postings; the spec keeps the visible page but
 still renders JSON-LD — keep emitting even when expired, since validThrough already encodes expiry and Google handles it). Decision:
 emit for all valid jobs, expired or not, matching spec acceptance line 720 ("present in <head> of every job detail page").
 - Build the schema by adapting the flat row to the shape buildJobPostingSchema expects:
   - job → pass the JobRow columns directly (they're all on job.*).
   - dept → job.dept_name ? { id: job.department_id, name: job.dept_name, logo_r2_key: job.logo_r2_key } : null.
   - state → job.state_name ? { id: job.state_id, name: job.state_name, slug: job.state_slug, is_union_territory: 0 } : null (only name
  is consumed by the builder, so is_union_territory value is irrelevant).
 - Render inside the BaseLayout via <Fragment slot="head"><script type="application/ld+json" set:html={JSON.stringify(schema)}
 /></Fragment>.

 Files

 - src/layouts/BaseLayout.astro — add named head slot
 - src/pages/jobs/[slug].astro — import builder, compute schema, render in slot="head"

 ---
## F-12 — Sitemap

 Create src/pages/sitemap.xml.ts as an Astro endpoint exporting GET.

 Queries (single Promise.all)

 -- Jobs (with lastmod)
 SELECT slug, COALESCE(updated_at, created_at) AS lastmod
 FROM jobs
 WHERE is_published = 1 AND last_date >= DATE('now')
 ORDER BY lastmod DESC;

 -- States that have ≥1 active job (any type)
 SELECT DISTINCT s.slug
 FROM states s JOIN jobs j ON j.state_id = s.id
 WHERE j.is_published = 1 AND j.last_date >= DATE('now');

 -- States with ≥1 govt job
 SELECT DISTINCT s.slug
 FROM states s
 JOIN jobs j ON j.state_id = s.id
 JOIN job_types jt ON j.job_type_id = jt.id
 WHERE j.is_published = 1 AND j.last_date >= DATE('now') AND jt.slug = 'government';

 -- States with ≥1 PSU job (same shape, slug='psu')

 -- Categories with ≥1 active job
 SELECT DISTINCT c.slug
 FROM categories c JOIN jobs j ON j.category_id = c.id
 WHERE j.is_published = 1 AND j.last_date >= DATE('now');

 URL set

 - /, /jobs, /states — static
 - /state/{slug} for each state with ≥1 job
 - /state/{slug}/government for each state with ≥1 govt job
 - /state/{slug}/psu for each state with ≥1 PSU job
 - /category/{slug} for each category with ≥1 job
 - /jobs/{slug} for each active job, with <lastmod>{YYYY-MM-DD}</lastmod>, <changefreq>weekly</changefreq>, <priority>0.8</priority>

 Response

 Return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }). Build SITE_URL base via the same
 .replace(/\/$/, '') pattern used in states.astro. XML-escape slugs defensively (slugs are already URL-safe, but escape & in case
 future categories contain it).

 ---
## F-13 — RSS Feed

 Create src/pages/rss.xml.ts exporting GET.

 Query

 SELECT j.slug, j.title, j.last_date, j.vacancies, j.created_at,
        s.name AS state_name, d.name AS dept_name
 FROM jobs j
 LEFT JOIN states s ON j.state_id = s.id
 LEFT JOIN departments d ON j.department_id = d.id
 WHERE j.is_published = 1 AND j.last_date >= DATE('now')
 ORDER BY j.created_at DESC
 LIMIT 50;

 Output shape (per spec lines 795–814)

 - Channel: title, link (SITE_URL), description, lastBuildDate (current time, RFC 822).
 - One <item> per job:
   - <title> — "{job.title} — {dept_name}" when dept present, else just title
   - <link> and <guid> — {SITE_URL}/jobs/{slug}
   - <description> — "{vacancies ?? 'See post for'} vacancies. Last date: {last_date}. State: {state_name ?? 'All India'}."
   - <pubDate> — convert created_at to RFC 822 via a small helper: new Date(created_at + 'Z').toUTCString() then replace GMT with +0000
  (UTC is fine; spec example uses +0530 but RFC 822 accepts either).

 XML-escape all text fields (&, <, >, ", '). Content-type application/rss+xml; charset=utf-8.

 ---
## Verification

 Run after each step:

 npm run build
 npx wrangler dev

 Then with the dev server up:

 1. F-11 — curl -s http://localhost:8787/jobs/<seeded-slug> | grep -A2 'application/ld+json'. Paste the JSON block into Google's Rich
 Results Test (https://search.google.com/test/rich-results) — must validate as JobPosting with no errors. Confirm validThrough ends
 with T00:00:00 and addressCountry is IN.
 2. F-12 — curl -s http://localhost:8787/sitemap.xml | head -40 returns valid XML; xmllint --noout <(curl -s
 http://localhost:8787/sitemap.xml) exits 0. Spot-check that an expired job slug is absent and /state/all-india/government appears (2
 seeded govt jobs in All India).
 3. F-13 — curl -s http://localhost:8787/rss.xml | head -30; paste into https://validator.w3.org/feed/ — must report "valid RSS".
 Confirm <pubDate> parses (e.g. Sat, 14 Jun 2026 00:00:00 +0000).
 4. Check npx wrangler dev log shows no exceptions on any of the three routes.

 ---
## Files touched

 - src/layouts/BaseLayout.astro (add head slot)
 - src/pages/jobs/[slug].astro (inject JSON-LD)
 - src/pages/sitemap.xml.ts (new)
 - src/pages/rss.xml.ts (new)
     LIMIT 50;

     Output shape (per spec lines 795–814)

     - Channel: title, link (SITE_URL), description, lastBuildDate (current time, RFC 822).
     - One <item> per job:
       - <title> — "{job.title} — {dept_name}" when dept present, else just title
       - <link> and <guid> — {SITE_URL}/jobs/{slug}
       - <description> — "{vacancies ?? 'See post for'} vacancies. Last date: {last_date}. State: {state_name ?? 'All India'}."
       - <pubDate> — convert created_at to RFC 822 via a small helper: new Date(created_at + 'Z').toUTCString() then replace GMT with
     +0000 (UTC is fine; spec example uses +0530 but RFC 822 accepts either).

     XML-escape all text fields (&, <, >, ", '). Content-type application/rss+xml; charset=utf-8.

     ---
     Verification

     Run after each step:

     npm run build
     npx wrangler dev

     Then with the dev server up:

     1. F-11 — curl -s http://localhost:8787/jobs/<seeded-slug> | grep -A2 'application/ld+json'. Paste the JSON block into Google's
     Rich Results Test (https://search.google.com/test/rich-results) — must validate as JobPosting with no errors. Confirm validThrough
     ends with T00:00:00 and addressCountry is IN.
     2. F-12 — curl -s http://localhost:8787/sitemap.xml | head -40 returns valid XML; xmllint --noout <(curl -s
     http://localhost:8787/sitemap.xml) exits 0. Spot-check that an expired job slug is absent and /state/all-india/government appears
     (2 seeded govt jobs in All India).
     3. F-13 — curl -s http://localhost:8787/rss.xml | head -30; paste into https://validator.w3.org/feed/ — must report "valid RSS".
     Confirm <pubDate> parses (e.g. Sat, 14 Jun 2026 00:00:00 +0000).
     4. Check npx wrangler dev log shows no exceptions on any of the three routes.

     ---
     Files touched

     - src/layouts/BaseLayout.astro (add head slot)
     - src/pages/jobs/[slug].astro (inject JSON-LD)
     - src/pages/sitemap.xml.ts (new)
     - src/pages/rss.xml.ts (new)

     No schema or lib/ changes — buildJobPostingSchema is already complete and reused as-is.

---

## What was done

### F-11

**Files changed:**
- `src/layouts/BaseLayout.astro` — added `<slot name="head" />` just before `</head>`
- `src/pages/jobs/[slug].astro` — added import of `buildJobPostingSchema`; added `jsonLd` computation after existing data fetch; added `<Fragment slot="head">` block at top of BaseLayout usage

**`buildJobPostingSchema` in `src/lib/seo.ts` was already complete — no changes needed there.**

`dept` constructed inline as `{ id: job.department_id, name: job.dept_name, logo_r2_key: job.logo_r2_key }` from the flat join row. `state` as `{ id: job.state_id, name: job.state_name, slug: job.state_slug, is_union_territory: 0 }` — only `name` is consumed by the builder.

**Output confirmed (`upsc-engineer-2026`):**
```json
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "UPSC Engineering Services 2026",
  "description": "UPSC Engineering Services 2026 — UPSC",
  "datePosted": "2026-06-13 21:56:20",
  "employmentType": "FULL_TIME",
  "identifier": { "@type": "PropertyValue", "name": "UPSC", "value": "upsc-engineer-2026" },
  "hiringOrganization": { "@type": "Organization", "name": "UPSC" },
  "validThrough": "2026-06-16T00:00:00",
  "jobLocation": {
    "@type": "Place",
    "address": { "@type": "PostalAddress", "addressCountry": "IN", "addressRegion": "All India" }
  },
  "baseSalary": {
    "@type": "MonetaryAmount", "currency": "INR",
    "value": { "@type": "QuantitativeValue", "value": 56100, "unitText": "MONTH" }
  }
}
```

---

### F-12

**File created:** `src/pages/sitemap.xml.ts`

5 queries in `Promise.all`:
```sql
-- 1. Jobs with lastmod
SELECT slug, COALESCE(updated_at, created_at) AS lastmod
FROM jobs WHERE is_published = 1 AND last_date >= DATE('now') ORDER BY lastmod DESC;

-- 2. States with any active job
SELECT DISTINCT s.slug FROM states s JOIN jobs j ON j.state_id = s.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now');

-- 3. States with govt job
SELECT DISTINCT s.slug FROM states s
JOIN jobs j ON j.state_id = s.id JOIN job_types jt ON j.job_type_id = jt.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now') AND jt.slug = 'government';

-- 4. States with PSU job  (same, jt.slug = 'psu')

-- 5. Categories with any active job
SELECT DISTINCT c.slug FROM categories c JOIN jobs j ON j.category_id = c.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now');
```

URLs emitted: `/`, `/jobs`, `/states`, `/state/{slug}`, `/state/{slug}/government` (if ≥1 govt job), `/state/{slug}/psu` (if ≥1 PSU job), `/category/{slug}`, `/jobs/{slug}` with lastmod/changefreq/priority.

**Verified:** 200, valid XML, `/state/all-india/government` present, expired jobs absent.

---

### F-13

**File created:** `src/pages/rss.xml.ts`

Query:
```sql
SELECT j.slug, j.title, j.last_date, j.vacancies, j.created_at,
       s.name AS state_name, d.name AS dept_name
FROM jobs j
LEFT JOIN states s ON j.state_id = s.id
LEFT JOIN departments d ON j.department_id = d.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now')
ORDER BY j.created_at DESC LIMIT 50
```

Each `<item>`:
- `<title>` — `"{title} — {dept_name}"` when dept present, else just title
- `<link>` + `<guid>` — `{SITE_URL}/jobs/{slug}`
- `<description>` — `"{vacancies} vacancies. Last date: {last_date}. State: {state_name ?? 'All India'}."`
- `<pubDate>` — `new Date(created_at + 'Z').toUTCString().replace('GMT', '+0000')`

**Verified:** 200, RSS 2.0, `<pubDate>` in RFC 822 format.

---

## Verification commands

```bash
npm run build
npx wrangler dev
curl -s http://localhost:8787/jobs/upsc-engineer-2026 | grep 'ld+json'
curl -s http://localhost:8787/sitemap.xml
curl -s http://localhost:8787/rss.xml
```