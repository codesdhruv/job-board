# F-06 — Keyword Search

## Context

`/jobs` already supports type, state, and category filters (F-01/F-03/F-04/F-05). F-06 adds free-text search across `jobs.title` and `departments.name` via a `?q=` param, combining with the existing filters. Spec source: `.claude/specs/02-job-board-feature-spec.md` §F-06.

Requirements from spec:
- Input + submit button on `/jobs`; submits as GET, sets `?q={term}` in URL
- SQL: `j.title LIKE '%'||?||'%' OR d.name LIKE '%'||?||'%'` (parameterised, no interpolation)
- Min 2 chars after trim; empty / <2 chars → no filter applied
- Combines with type, state, category
- Search term persists in input on reload

## Implementation

All changes in `src/pages/jobs/index.astro`:

1. **Parse `q` param** — trim, gate at ≥2 chars; `activeQuery` is `null` otherwise.
2. **SQL** — when `activeQuery` is non-null, append `(j.title LIKE ? OR d.name LIKE ?)` to the `where` array and push `%term%` twice into `binds`. Parameterised; no string interpolation.
3. **`preservedForSearch`** array — mirrors `preservedParams` / `preservedForCategory`, excluding `q` and `page`. Feeds hidden inputs in the search form so submitting search drops pagination but keeps type/state/category/unknown params.
4. **Search form** — rendered directly under `<h1>Jobs</h1>`, above the promoted-state slot and tabs:

```astro
<form method="get" action="/jobs" role="search" style="margin-bottom:24px">
  {preservedForSearch.map((p) => <input type="hidden" name={p.key} value={p.value} />)}
  <input
    type="search"
    name="q"
    value={qTrimmed}
    minlength="2"
    placeholder="Search jobs by title, department…"
    aria-label="Search jobs"
    style="padding:8px;border:1px solid #ebebeb;border-radius:6px;min-width:320px"
  />
  <button type="submit" style="padding:8px 16px;border:1px solid #171717;background:#171717;color:#fff;border-radius:6px;font-weight:500">Search</button>
</form>
```

Notes:
- `value={qTrimmed}` (not raw `qParam`) — keeps the input clean if the user submitted whitespace.
- `minlength="2"` is a UX hint; server-side gating at `qTrimmed.length >= 2` is the authoritative check.
- The existing `hrefFor()` for tabs already preserves `q` via `URLSearchParams(Astro.url.searchParams)`. The state and category forms already preserve `q` because their preserved-params loops include every param except their own key + `page`. No further changes needed there.

## Critical file

- `src/pages/jobs/index.astro` — only file touched.

## Verification — 2026-06-14

Ran `npm run dev` against `localhost:4322` with the seeded jobs (`rrb-tech-2026`, `upsc-engineer-2026`).

| Scenario | Expected | Actual |
|---|---|---|
| `/jobs` renders search form | `role="search"`, `name="q"` present | ✓ |
| `?q=engineer` | only `upsc-engineer-2026` | ✓ |
| `?q=rrb` | only `rrb-tech-2026` | ✓ |
| `?q=e` (1 char) | filter ignored, all jobs | ✓ |
| `?q=%20%20` (whitespace) | filter ignored, all jobs | ✓ |
| `?q=xyznomatch` | empty | ✓ |
| `?q=engineer` reload | input shows `value="engineer"` | ✓ |
| `?type=government&q=engineer` | only matching govt job | ✓ |
| `?q='; DROP TABLE jobs;--` | HTTP 200, table intact | ✓ |
| Tab links preserve `q` | `/jobs?q=engineer&type=psu` etc. | ✓ |
| State/category forms emit hidden `q` | `<input type="hidden" name="q" value="engineer">` | ✓ |
