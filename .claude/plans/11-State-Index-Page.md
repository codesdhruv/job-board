# F-07 — State Index Page

## Context

F-07 is a P2 public SEO hub page at `/states`. It links out to all `/state/[slug]` pages (to be built in F-08) so crawlers can discover every state's listing page. It also gives human visitors a single browsable index with live, non-expired job counts per state. Spec: `.claude/specs/02-job-board-feature-spec.md` lines 406–462. Route confirmed as `/states` (plural) by both F-07 and the F-12 sitemap section; the CLAUDE.md "state/index.astro" entry was misleading.

Self-contained read-only page — one SQL query, one layout, no filters, no pagination, no JS.

## Approach

Single Astro SSR page at `src/pages/states.astro` that:

1. Calls `getDb()` from `src/lib/db.ts` (D1 binding via `cloudflare:workers` env — same pattern as `src/pages/jobs/index.astro`).
2. Runs the F-07 count query, joining `states` with non-expired published `jobs`:
   ```sql
   SELECT s.name, s.slug, s.is_union_territory,
          COUNT(j.id) AS job_count
   FROM states s
   LEFT JOIN jobs j ON j.state_id = s.id
     AND j.is_published = 1
     AND j.last_date >= DATE('now')
   GROUP BY s.id
   ORDER BY s.is_union_territory, s.name
   ```
3. Splits result rows into three buckets:
   - `allIndia` — the row with `slug = 'all-india'` (featured card at top).
   - `states` — rows where `is_union_territory = 0` and slug ≠ `all-india`.
   - `unionTerritories` — rows where `is_union_territory = 1`.
4. Wraps content in `BaseLayout` with SEO props:
   - `title="Browse Jobs by State in India | SarkariNaukriBoard"`
   - `description="Find government, PSU, and private sector jobs in your state. Browse all 36 states and union territories."`
   - `canonical="${SITE_URL}/states"` (reads `SITE_URL` from the same `cloudflare:workers` env import).
5. Renders:
   - `<h1>Browse Jobs by State</h1>` and a one-line lede.
   - Featured "All India — Central Govt (N)" card → `/state/all-india`.
   - `<section><h2>States</h2>` with grid of state cards.
   - `<section><h2>Union Territories</h2>` with grid of UT cards.
6. Each card is `<a href="/state/{slug}">{name} ({job_count})</a>`. When `job_count === 0`, applies inline `color:#888888` (muted token) and `aria-label="{name} — 0 active jobs"`. Link stays enabled so the F-08 page is reachable for crawlers.
7. No CSS framework — inline styles consistent with existing `jobs/index.astro`. Grid via `grid-template-columns:repeat(auto-fill,minmax(200px,1fr))`.

## Files

- **Created** `src/pages/states.astro` — the only new file.
- **Reused** `src/lib/db.ts` → `getDb()`.
- **Reused** `src/layouts/BaseLayout.astro` (`title`, `description`, `canonical` props).

No schema changes, no new lib helpers, no middleware changes. F-08 (`/state/[slug]`) is out of scope — links will 404 until F-08 ships.

## Edge cases handled

- 0-job states still rendered (greyed via muted color).
- `all-india` excluded from both grids; promoted to featured card.
- States table has all 36 + All India seeded — no empty-state branch needed.

## Verification

Ran `npm run dev` on 2026-06-14; `curl http://localhost:4321/states`:

| Check | Result |
|---|---|
| HTTP status | 200 |
| Page bytes | 15,398 |
| `<title>` | `Browse Jobs by State in India \| SarkariNaukriBoard` ✓ |
| `<meta name="description">` | matches spec string ✓ |
| `<link rel="canonical">` | `https://example.com/states` ✓ (uses `SITE_URL`) |
| `<h1>` | `Browse Jobs by State` ✓ |
| Featured card | `All India — Central Govt` present above grids ✓ |
| States section links | 28 ✓ |
| Union Territories section links | 8 ✓ |
| Total state links | 37 (28 + 8 + All India) ✓ |
| Cards greyed with `#888888` | 36 (only one state currently has live jobs) ✓ |

Acceptance criteria from spec lines 455–461 all met.
