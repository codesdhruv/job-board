# Plan: F-21 SEO Meta Tags

## Context
F-21 requires every public page to have a unique `<title>`, `<meta name="description">` (≤155 chars), `<link rel="canonical">`, and `<meta name="robots" content="index, follow">`. Admin pages (already use AdminLayout) must have `noindex, nofollow`. Most pages already passed title/description/canonical to BaseLayout, but three gaps existed. This plan documents exactly what was changed.

---

## What already worked (no changes needed)
- **AdminLayout.astro** — already had `<meta name="robots" content="noindex, nofollow">` ✓
- **`/`** — title, description, canonical all correct per spec ✓
- **`/state/[slug]`** — title/description/canonical matched spec F-21 + F-08 ✓
- **`/state/[slug]/government`** — matched spec F-21 template ✓
- **`/state/[slug]/psu`** — no explicit F-21 template; format was fine ✓
- **`/category/[slug]`** — title/description/canonical matched spec ✓

---

## Changes made (3 files)

### 1. `src/layouts/BaseLayout.astro`
Added `<meta name="robots" content="index, follow">` after viewport meta.  
BaseLayout is used only by public pages; AdminLayout (noindex) covers admin — no prop needed.

### 2. `src/pages/jobs/index.astro`
Was passing only `title="Jobs — SarkariNaukriBoard"` — no description or canonical.

- Added `import { env } from 'cloudflare:workers'`
- Added `siteUrl`, `listingCanonical`, `listingDescription` vars
- Changed `<BaseLayout>` call to:
  - `title="Browse Government & Private Jobs in India 2026 | SarkariNaukriBoard"`
  - `description="Browse government, PSU and private jobs in India. Filter by state, category and job type. Updated daily."`
  - `canonical={listingCanonical}` → `https://example.com/jobs` (no query params — canonical is the base URL)

### 3. `src/pages/jobs/[slug].astro`
Two fixes — title format was missing `{dept_name}`, description was using stripped HTML text instead of spec template.

**Title** (spec: `{title} — {dept_name} | SarkariNaukriBoard`):
```ts
const pageTitle = job
  ? `${job.title}${job.dept_name ? ' — ' + job.dept_name : ''} | SarkariNaukriBoard`
  : 'Not found — SarkariNaukriBoard';
```

**Description** (spec: `Apply for {title} at {dept_name}. {vacancies} vacancies. Last date: {last_date_formatted}. State: {state_name}.`):
```ts
function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
const metaDescription = job
  ? [
      `Apply for ${job.title}${job.dept_name ? ' at ' + job.dept_name : ''}.`,
      job.vacancies ? `${job.vacancies} vacancies.` : '',
      `Last date: ${formatDate(job.last_date)}.`,
      job.state_name ? `State: ${job.state_name}.` : '',
    ].filter(Boolean).join(' ').slice(0, 155)
  : undefined;
```
Removed old `stripped` variable (was only used for metaDescription).

---

## Verified output (wrangler dev)

**`/jobs`**
```html
<meta name="robots" content="index, follow">
<title>Browse Government &amp; Private Jobs in India 2026 | SarkariNaukriBoard</title>
<meta name="description" content="Browse government, PSU and private jobs in India. Filter by state, category and job type. Updated daily.">
<link rel="canonical" href="https://example.com/jobs">
```

**`/jobs/upsc-engineer-2026`**
```html
<meta name="robots" content="index, follow">
<title>UPSC Engineering Services 2026 — UPSC | SarkariNaukriBoard</title>
<meta name="description" content="Apply for UPSC Engineering Services 2026 at UPSC. 250 vacancies. Last date: 16 Jun 2026. State: All India.">
<link rel="canonical" href="https://example.com/jobs/upsc-engineer-2026">
```

**`/state/uttar-pradesh/government`**
```html
<meta name="robots" content="index, follow">
<title>Government Jobs in Uttar Pradesh 2026 — Sarkari Naukri Uttar Pradesh</title>
<meta name="description" content="Latest sarkari naukri in Uttar Pradesh. 0 active government vacancies. Apply now.">
<link rel="canonical" href="https://example.com/state/uttar-pradesh/government">
```
