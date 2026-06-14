# F-15 — Admin Dashboard

## Context

F-14 (admin login) and F-23 (auth middleware) are built and verified, but the login redirect target `/admin/dashboard` currently 404s. This plan implements F-15 from `.claude/specs/02-job-board-feature-spec.md` (lines 877–928): an at-a-glance overview shown immediately after login with 4 metric counts, an "Expiring soon" table, and a "Recently added" table. It also upgrades `AdminLayout.astro` with the persistent sidebar nav (Dashboard | All Jobs | Add New Job | Logout) called out in the spec mockup at line 888.

The Edit / Delete / Add-New links and the Logout endpoint don't exist yet (F-16–F-19) — they will be rendered as `<a>` tags pointing at the eventual routes (`/admin/jobs`, `/admin/jobs/new`, `/admin/jobs/[id]/edit`, `/admin/jobs/[id]/delete`, `/admin/logout`). They'll 404 until those features land; that's acceptable and matches how F-14 already links to this dashboard.

## Files

### 1. `src/layouts/AdminLayout.astro` (modify)

Add a left sidebar wrapper around the slot. Keep the existing `noindex` meta and `title` prop. Layout:

- `<body>` becomes a flex container: `<aside>` (240px sidebar) + `<main>` (flex:1).
- Sidebar shows site name + 4 nav links: Dashboard → `/admin/dashboard`, All Jobs → `/admin/jobs`, Add New Job → `/admin/jobs/new`, Logout → `/admin/logout`.
- Active link uses `aria-current="page"` based on `Astro.url.pathname` (matching the prefix pattern from `src/pages/jobs/index.astro:169–187`).
- Inline styles only — design tokens from `CLAUDE.md` (ink `#171717`, body `#4d4d4d`, hairline `#ebebeb`, canvas-soft `#fafafa`). Geist font.
- Login page already uses `AdminLayout`. Sidebar would look odd there — gate it: only render the sidebar when `Astro.url.pathname !== '/admin/login'`. This keeps F-14 untouched.

### 2. `src/pages/admin/dashboard.astro` (new)

SSR page at `/admin/dashboard`. Auth is already enforced by `src/middleware/index.ts` (F-23), so no per-page session check needed.

Frontmatter:

```ts
import AdminLayout from '../../layouts/AdminLayout.astro';
import { getDb } from '../../lib/db';

const db = getDb();

// 4 count queries + 2 list queries in one Promise.all (spec lines 907–920)
const [liveCount, expiringCount, draftCount, expiredCount, expiringRows, recentRows] =
  await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE is_published = 1 AND last_date >= DATE('now')").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE is_published = 1 AND last_date BETWEEN DATE('now') AND DATE('now', '+7 days')").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE is_published = 0").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE last_date < DATE('now')").first<{ n: number }>(),
    db.prepare(`
      SELECT j.id, j.slug, j.title, j.last_date, d.name AS dept_name
      FROM jobs j LEFT JOIN departments d ON j.department_id = d.id
      WHERE j.is_published = 1
        AND j.last_date BETWEEN DATE('now') AND DATE('now', '+7 days')
      ORDER BY j.last_date ASC
    `).all<{ id:number; slug:string; title:string; last_date:string; dept_name:string|null }>(),
    db.prepare(`
      SELECT j.id, j.slug, j.title, j.created_at,
             jt.name AS type_name, s.name AS state_name
      FROM jobs j
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      LEFT JOIN states s ON j.state_id = s.id
      ORDER BY j.created_at DESC
      LIMIT 5
    `).all<{ id:number; slug:string; title:string; created_at:string; type_name:string|null; state_name:string|null }>(),
  ]);
```

Rendering:

- 4 metric cards in a 4-col responsive grid: label + big number. Use card styling matching the design system (hairline border, 8px radius, white bg).
- "Expiring soon" `<table>`: columns Title, Department, Last date, Actions. Actions = Edit (`/admin/jobs/{id}/edit`) + Delete (`/admin/jobs/{id}/delete`). Render "—" if dept_name is null. Format `last_date` with `toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})` matching `src/pages/jobs/[slug].astro`. If `expiringRows.results.length === 0`, render "No jobs expiring in the next 7 days." instead of an empty table.
- "Recently added" `<table>`: columns Title, Type, State, Posted, Actions. Same date format. Same empty-state fallback.
- Page heading `<h1>Dashboard</h1>`.

No KV caching (admin pages are never cached per spec line 1250).

## Verification

1. `npm run build` to confirm no TS errors.
2. `npm run dev` (NOT `wrangler dev` — per the CLAUDE.md note, wrangler dev serves from stale `dist/`).
3. Log in at `/admin/login` with seeded admin creds.
4. Should land on `/admin/dashboard` with sidebar visible and 4 metric cards filled.
5. Cross-check counts against D1 directly:
   ```
   npx wrangler d1 execute job-board-db --local --command "SELECT COUNT(*) FROM jobs WHERE is_published=1 AND last_date>=DATE('now')"
   ```
   and the other three count SQLs from the spec.
6. Confirm sidebar nav links render with Dashboard marked `aria-current="page"`.
7. Confirm `/admin/login` still renders WITHOUT the sidebar (path-gated).
8. Paste the rendered HTML of the metric cards section back to the user so they can verify counts against known seed data.

## Out of scope

- Wiring Edit/Delete/Add-New/Logout endpoints (F-16, F-17, F-19; logout is implicit in F-14 surface but no separate spec section). Links will 404 until those land.
- Pagination on the expiring/recent tables (not in F-15 spec).
- Client-side search/filter on the dashboard.
