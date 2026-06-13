# F-03 — Job Type Filter Tabs — Implementation Plan & Verification

**Spec:** `.claude/specs/07-Job-type-filter-tabs.md`
**File touched:** `src/pages/jobs/index.astro`
**Date:** 2026-06-14

---

## Plan

### 1. Read query params (frontmatter)

```ts
const typeParam = Astro.url.searchParams.get('type');
const validSlugs = ['government', 'psu', 'private', 'freelance']; // from schema.sql seed
const activeType = typeParam && validSlugs.includes(typeParam) ? typeParam : null;
```

Whitelist guards against arbitrary input even though the query is parameterised.

### 2. Extend the jobs query

Conditionally append `AND jt.slug = ?` and bind `activeType`:

```ts
const sql = `SELECT ... FROM jobs j LEFT JOIN job_types jt ...
             WHERE j.is_published = 1 AND j.last_date >= DATE('now')
             ${activeType ? 'AND jt.slug = ?' : ''}
             ORDER BY j.created_at DESC`;
const stmt = activeType ? db.prepare(sql).bind(activeType) : db.prepare(sql);
const { results } = await stmt.all();
```

### 3. Counts query (per F-03 spec)

```sql
SELECT jt.slug AS slug, COUNT(*) AS count
FROM jobs j JOIN job_types jt ON j.job_type_id = jt.id
WHERE j.is_published = 1 AND j.last_date >= DATE('now')
GROUP BY jt.slug
```

Build a `Map<slug, count>`. Sum all per-type counts into `counts.set(null, total)` for the "All" tab — one less DB round-trip than a separate `SELECT COUNT(*)`.

### 4. Tab list (hard-coded order)

```ts
const tabs = [
  { slug: null,         label: 'All' },
  { slug: 'government', label: 'Government' },
  { slug: 'psu',        label: 'PSU/Semi-Govt' },
  { slug: 'private',    label: 'Private' },
  { slug: 'freelance',  label: 'Freelance/Gig' },
];
```

Slugs verified against `schema.sql` `INSERT OR IGNORE INTO job_types` seed.

### 5. Preserve other params on tab links

Helper clones `Astro.url.searchParams`, sets/deletes `type`, drops `page` (filter change resets pagination per F-20 convention):

```ts
function hrefFor(slug: string | null) {
  const p = new URLSearchParams(Astro.url.searchParams);
  p.delete('page');
  if (slug) p.set('type', slug); else p.delete('type');
  const qs = p.toString();
  return qs ? `/jobs?${qs}` : '/jobs';
}
```

### 6. Render tabs

`<nav aria-label="Filter by job type">` with inline styles using DESIGN.md tokens:
- Active: `#171717` (ink), weight 600, 2px `#171717` underline, `aria-current="page"`
- Inactive: `#4d4d4d` (body), weight 400
- Container: hairline `#ebebeb` bottom border

### 7. Verify (`npx wrangler dev`)

- `/jobs`, `/jobs?type=government`, `/jobs?type=psu`, `/jobs?type=private`, `/jobs?type=freelance`
- `/jobs?type=bogus` (must fall back to All)
- `/jobs?type=government&foo=bar` (unknown param must survive across tab clicks)

### Out of scope (deferred)

- State / category / search params (F-04, F-05, F-06) — `hrefFor` already preserves unknown params
- Pagination — `page` is stripped on tab switch (F-20)
- KV caching of counts (F-22)
- Promoting state dropdown when type=govt/psu (F-04)

---

## Implementation

Single file rewrite: `src/pages/jobs/index.astro`. Build passes cleanly (`npm run build` → `Server built in 3.33s`).

---

## Verification results (wrangler dev @ localhost:8788)

| URL | Status | Active tab | Cards |
|---|---|---|---|
| `/jobs` | 200 | All (2) | 2 |
| `/jobs?type=government` | 200 | Government (2) | 2 |
| `/jobs?type=psu` | 200 | PSU/Semi-Govt (0) | 0 |
| `/jobs?type=private` | 200 | Private (0) | 0 |
| `/jobs?type=freelance` | 200 | Freelance/Gig (0) | 0 |
| `/jobs?type=bogus` | 200 | All (2) — fallback | 2 |
| `/jobs?type=government&foo=bar` | 200 | Government (2) | 2 |

### Rendered counts row

```
All (2) Government (2) PSU/Semi-Govt (0) Private (0) Freelance/Gig (0)
```

### Param preservation check

On `/jobs?type=government&foo=bar`, every tab link kept `foo=bar`:

```
href="/jobs?foo=bar"                     → All
href="/jobs?type=government&foo=bar"     → Government (aria-current="page")
href="/jobs?type=psu&foo=bar"            → PSU/Semi-Govt
href="/jobs?type=private&foo=bar"        → Private
href="/jobs?type=freelance&foo=bar"      → Freelance/Gig
```

### Acceptance criteria

- [x] 4 type tabs + All rendered on the listing page
- [x] Active tab visually distinct (`#171717` ink, 600 weight, 2px underline, `aria-current="page"`)
- [x] Job counts shown in tabs
- [x] Tab click preserves unknown query params (state/category/search will inherit this when added)
- [ ] Government/PSU tab promotes state filter — deferred to F-04
