# F-04 — State Filter Dropdown — Implementation Plan & Verification

**Spec:** `.claude/specs/08-State-filter.md`
**File touched:** `src/pages/jobs/index.astro`
**Date:** 2026-06-14

---

## Plan

### 1. Read & whitelist `?state=`

```ts
const stateParam = Astro.url.searchParams.get('state');
```

No hard-coded whitelist (37 rows). Validate against the slug set built from the states fetch — unknown slug falls back to no filter, same pattern as `type`.

### 2. Fetch states

```sql
SELECT id, name, slug, is_union_territory
FROM states
ORDER BY is_union_territory, name
```

`ORDER BY is_union_territory, name` puts states first, UTs second, each alphabetical. The seeded `all-india` slug is **excluded from the dropdown** — per product decision, the first `<option value="">All India</option>` means "clear filter / show all states", not "filter by central-govt slug". Jobs tagged `state_id → all-india` still appear under the no-filter view.

### 3. Extend jobs query

Append `AND s.slug = ?` conditionally; bindings pushed in order behind the existing type bind:

```ts
const where = ['j.is_published = 1', "j.last_date >= DATE('now')"];
const binds: string[] = [];
if (activeType)  { where.push('jt.slug = ?'); binds.push(activeType); }
if (activeState) { where.push('s.slug = ?');  binds.push(activeState); }
```

Composite index `idx_jobs_type_state` already covers `(job_type_id, state_id)`. Tab counts query left untouched — counts intentionally remain across all states so the tabs don't shrink to zero when a state is picked.

### 4. Tab promotion logic

```ts
const promoteState = activeType === 'government' || activeType === 'psu';
```

When true: render the `<select>` **above** the type tabs with a visible `<label>Select your state</label>`. When false: render **below** the tabs with `aria-label="Filter by state"`.

### 5. Submit via GET form + hidden inputs

Spec requires a `<select>` with URL change on selection. No client framework. Solution: `<form method="get" action="/jobs">` with `onchange="this.form.submit()"`. To preserve unknown params (matching `hrefFor` behavior for the tabs), iterate `Astro.url.searchParams` once and emit a hidden input for every key except `state` and `page`:

```ts
const preservedParams: { key: string; value: string }[] = [];
for (const [key, value] of Astro.url.searchParams.entries()) {
  if (key === 'state' || key === 'page') continue;
  preservedParams.push({ key, value });
}
```

Empty `value=""` option doesn't emit `state` in the resulting URL, keeping it clean (`/jobs`, not `/jobs?state=`).

### 6. Render

```
[ if promoteState ]
  <form>
    <label for="state-select">Select your state</label>
    <select id="state-select" name="state" onchange="this.form.submit()">
      <option value="">All India</option>
      <optgroup label="States">...</optgroup>
      <optgroup label="Union Territories">...</optgroup>
    </select>
    {hidden inputs for preserved params}
  </form>
  <nav> type tabs </nav>
[ else ]
  <nav> type tabs </nav>
  <form> (same select, aria-label only) </form>
```

### 7. Verify (`npx wrangler dev`)

- `/jobs` — no filter
- `/jobs?state=delhi` — filtered to Delhi
- `/jobs?state=all-india` — central-govt jobs (slug still valid in DB)
- `/jobs?state=bogus` — fallback to no filter
- `/jobs?type=government&state=delhi` — dropdown promoted, label visible
- `/jobs?type=private&state=delhi` — dropdown below tabs, no large label
- `/jobs?type=government&state=delhi&foo=bar` — `foo=bar` survives state change

### Out of scope

- Category dropdown (F-05)
- Keyword search (F-06)
- Pagination wiring beyond stripping `page` (F-20)
- KV caching of states list (F-22)
- Styling polish

---

## Implementation

Single file edit: `src/pages/jobs/index.astro`. Build passes cleanly (`npm run build` → `Server built in 2.08s`).

---

## Verification results (wrangler dev @ localhost:8788)

| URL | Status | Jobs | Promoted | Selected | `foo=bar` preserved |
|---|---|---|---|---|---|
| `/jobs` | 200 | 2 | no | All India | n/a |
| `/jobs?state=delhi` | 200 | 0 | no | Delhi | n/a |
| `/jobs?state=all-india` | 200 | 2 | no | — (excluded from dropdown) | n/a |
| `/jobs?state=bogus` | 200 | 2 | no | All India (fallback) | n/a |
| `/jobs?type=government&state=delhi` | 200 | 0 | yes | Delhi | n/a |
| `/jobs?type=private&state=delhi` | 200 | 0 | no | Delhi | n/a |
| `/jobs?type=government&state=delhi&foo=bar` | 200 | 0 | yes | Delhi | yes |

### Acceptance criteria

- [x] `?state=` filter applied server-side to D1 query
- [x] States fetched with required ordering
- [x] `<select>` with two `<optgroup>`s (States / Union Territories)
- [x] "All India" as first option outside both groups (clears filter)
- [x] State dropdown promoted above tabs with "Select your state" label when type=Government or PSU
- [x] Selecting a state updates `?state={slug}` and preserves other params (including unknown ones)
- [x] Unknown state slug falls back gracefully
