# Plan: F-01 — Minimal /jobs listing page

## Context

The spec `.claude/specs/04-Implement-F-01.md` asks for the *first slice* of F-01: prove the D1 binding + SSR pipeline works end-to-end by rendering a plain unfiltered list of jobs at `/jobs`. No filters, no pagination, no styling, no components — those land in later iterations of F-01 (filters F-03/04/05/06, pagination F-20, JobCard component, etc.). Goal is a working page that loads via `wrangler dev` without errors.

## Approach

Create one new file: `src/pages/jobs/index.astro`.

1. Call `getDb()` from `src/lib/db.ts`.
2. Run the F-01 SQL from `.claude/specs/02-job-board-feature-spec.md`, stripped of the four optional filter brackets and the `LIMIT/OFFSET` (per spec: "no filters yet — just fetch all published, non-expired jobs").
3. Render via `BaseLayout` with a `<ul>` of `{title} — {last_date} — {slug}`.

### SQL used

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
  AND j.last_date >= DATE('now')
ORDER BY j.created_at DESC
```

## Files

- **Created**: `src/pages/jobs/index.astro`
- **Modified**: `src/lib/db.ts` — `Astro.locals.runtime.env` was removed in Astro v6. Switched `getDb()` to use `import { env } from 'cloudflare:workers'` (no `locals` arg). Required to make the page run at all.

## Verification (completed)

1. `npm run build` — clean.
2. `npx wrangler dev` — `Ready on http://localhost:8787`, DB binding attached as `env.DB (job-board-db)` local.
3. `curl http://localhost:8787/jobs` → `HTTP 200 OK (21ms)`. Empty `<ul>` (table has no rows yet) — the SQL executed cleanly, confirming the D1 + SSR pipeline.

## Follow-ups (out of scope for this slice)

- Filters (F-03/04/05/06), pagination (F-20), `JobCard` component, styling, full SEO meta, KV cache (F-22).
- `src/middleware/index.ts` still uses the removed `locals.runtime.env` pattern — will break on first `/admin/*` request. Fix when starting F-14/F-23.
