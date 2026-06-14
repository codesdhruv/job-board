# F-08 — State Jobs Page

**Status:** ✅ Built & verified end-to-end on 2026-06-14 against `wrangler dev` (after `npm run build`).

## Context

F-08 adds three dedicated SEO routes for state-level job listings:

- `/state/[slug]` — all jobs in a state (renders sub-type tabs)
- `/state/[slug]/government` — Government jobs in that state
- `/state/[slug]/psu` — PSU jobs in that state

These are the primary SEO surface for queries like "government jobs in Uttar Pradesh" / "sarkari naukri Delhi" — the platform's main differentiator. Before F-08, the F-07 `/states` index page linked to `/state/[slug]` but every click 404'd. F-08 closes that loop.

## Files created

1. `src/pages/state/[slug].astro` — all jobs in state + sub-type tabs
2. `src/pages/state/[slug]/government.astro` — Government-only filter
3. `src/pages/state/[slug]/psu.astro` — PSU-only filter

No existing files modified.

## Shared logic (inline per file — no new helper)

Each of the three files runs the same skeleton:

1. `const db = getDb();` from `src/lib/db.ts`.
2. Read `slug` from `Astro.params`.
3. Look up the state row: `SELECT id, name, slug FROM states WHERE slug = ?`.
4. If not found → `return new Response(null, { status: 404 });`.
5. Run the F-01 job query (lines 61–70 of `src/pages/jobs/index.astro`) constrained to `s.slug = ?`, plus `jt.slug = 'government'` or `'psu'` for the two sub-pages. Always include `j.is_published = 1 AND j.last_date >= DATE('now')`.
6. Render `BaseLayout` with state-specific title, description, canonical (built from `(env as any).SITE_URL` per `src/pages/states.astro:32–33`).
7. Render breadcrumb, `<h1>`, count lede, (sub-type tabs only on `/state/[slug]`), then map results through `JobCard`. Empty results → "No active jobs in this state right now. Check back soon."

## File-by-file

### `src/pages/state/[slug].astro`

- Tabs row: `All | Government | PSU / Semi-Govt | Private`
  - `All` → `/state/{slug}` (active, `aria-current="page"`)
  - `Government` → `/state/{slug}/government`
  - `PSU / Semi-Govt` → `/state/{slug}/psu`
  - `Private` → `/jobs?state={slug}&type=private` (user decision: cross-link to F-01; no dedicated route exists per spec)
- Reuse the inline-style tab pattern from `src/pages/jobs/index.astro` lines 169–187 (ink `#171717`, 2px underline for active).
- Title: `Jobs in {state.name} 2026 — Sarkari & Private`
- Description: `Find latest govt, PSU and private sector jobs in {state.name}. {count} active vacancies.`
- Breadcrumb: `Home › States › {state.name}`.
- `<h1>Jobs in {state.name}</h1>`, lede `{count} active vacancies in {state.name}`.

### `src/pages/state/[slug]/government.astro`

- WHERE adds `AND jt.slug = 'government'`.
- No sub-type tabs (spec line 485: tabs on `/state/[slug]` only).
- Title: `Government Jobs in {state.name} 2026 — Sarkari Naukri {state.name}`
- Description: `Latest sarkari naukri in {state.name}. {count} active government vacancies. Apply now.`
- Breadcrumb: `Home › States › {state.name} › Government` (the `{state.name}` segment links back to `/state/{slug}`).
- `<h1>Government Jobs in {state.name}</h1>`.

### `src/pages/state/[slug]/psu.astro`

- WHERE adds `AND jt.slug = 'psu'`.
- No sub-type tabs.
- Title: `PSU Jobs in {state.name} 2026 — Sarkari Naukri {state.name}`
- Description: `Latest PSU and semi-government jobs in {state.name}. {count} active vacancies. Apply now.`
- Breadcrumb: `Home › States › {state.name} › PSU`.
- `<h1>PSU Jobs in {state.name}</h1>`.

## SEO

- Canonical: `${SITE_URL}/state/{slug}` (and `/government` or `/psu` for sub-pages). Built with `(env as any).SITE_URL ?? ''` and `replace(/\/$/, '')` exactly as in `src/pages/states.astro:32–33`.
- `title`, `description`, `canonical` passed to `BaseLayout` (already supports all three).

## Out of scope (deferred)

- **Pagination** — F-20 not built; matches current `/jobs` behaviour.
- **KV caching** — F-22.
- **JSON-LD `ItemList`** (spec line 521) — bundled with F-11/F-21.
- **CSS framework** — inline styles only, per project convention.

## Edge cases covered

- Invalid `slug` → 404 (spec line 522).
- Valid slug, 0 jobs → render page with empty-state message, not 404 (spec line 523).
- `/state/all-india/government` → works via the seeded `all-india` state row + `jt.slug = 'government'` filter (spec line 525).

## Verification — 2026-06-14

Ran `npm run build` then `npx wrangler dev --port 8788`. Local D1 has 2 published, non-expired jobs both tagged `state=all-india, type=government`.

| Route | HTTP | Title | Description | Canonical | Body checks |
|---|---|---|---|---|---|
| `/state/all-india` | 200 | `Jobs in All India 2026 — Sarkari & Private` | `Find latest govt, PSU and private sector jobs in All India. 2 active vacancies.` | `https://example.com/state/all-india` | tabs render with `aria-current="page"` on All; 2 job cards |
| `/state/all-india/government` | 200 | `Government Jobs in All India 2026 — Sarkari Naukri All India` | `Latest sarkari naukri in All India. 2 active government vacancies. Apply now.` | `https://example.com/state/all-india/government` | 2 job cards; no sub-tabs |
| `/state/all-india/psu` | 200 | `PSU Jobs in All India 2026 — Sarkari Naukri All India` | `Latest PSU and semi-government jobs in All India. 0 active vacancies. Apply now.` | `https://example.com/state/all-india/psu` | empty-state message |
| `/state/uttar-pradesh` | 200 | `Jobs in Uttar Pradesh 2026 — Sarkari & Private` | `...in Uttar Pradesh. 0 active vacancies.` | `https://example.com/state/uttar-pradesh` | empty-state, tabs still render |
| `/state/uttar-pradesh/government` | 200 | `Government Jobs in Uttar Pradesh 2026 — Sarkari Naukri Uttar Pradesh` | `...0 active government vacancies. Apply now.` | `https://example.com/state/uttar-pradesh/government` | empty-state |
| `/state/xyz-invalid` | 404 | Astro default 404 | — | — | — |

All six matched expected output.

**Note on dev workflow:** `wrangler dev` serves from the built `dist/` and does not auto-rebuild on source changes. For iteration use `npm run dev` (Astro dev with Cloudflare emulation); use `wrangler dev` only after `npm run build` when verifying the production bundle.

## Critical files referenced

- `src/pages/jobs/index.astro` lines 50–75 (WHERE/SQL/bind pattern), 169–187 (tab rendering)
- `src/pages/states.astro` lines 32–33 (SITE_URL + canonical pattern)
- `src/components/JobCard.astro` (reused as-is)
- `src/layouts/BaseLayout.astro` (props: title, description, canonical)
- `src/lib/db.ts` (`getDb()`)
- `.claude/specs/02-job-board-feature-spec.md` lines 465–536 (F-08 spec)
