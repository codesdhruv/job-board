# F-16 — Admin Job List

## Context

Admin needs a full management view of every job in the system (live, draft, expired) to drive Edit/Delete actions and post-action flash feedback. The dashboard (F-15) only shows expiring-soon + last 5; there is no current way to browse all jobs. This page is the management hub that F-17 (new), F-18 (edit), and F-19 (delete) will redirect back to with success flashes.

Pagination shared component (F-20) is not yet built — implementing pagination inline here, per user direction. The shared component can be extracted later when F-20 lands.

## File to create

`src/pages/admin/jobs/index.astro` — SSR page at `/admin/jobs`. Auth enforced by middleware (`src/middleware/index.ts`, F-23), no per-page session check.

## Implementation

### Frontmatter
- `import AdminLayout from '../../../layouts/AdminLayout.astro'`
- `import { getDb } from '../../../lib/db'`
- Read `?page` query param, parse to int, default 1, clamp ≥1.
- Read flash query params: `?success=1`, `?updated=1`, `?deleted=1` (mutually exclusive — first match wins).
- `pageSize = 50`, `offset = (page - 1) * 50`.
- Two queries via `Promise.all`:
  1. `SELECT COUNT(*) AS n FROM jobs` (no filter — include drafts + expired).
  2. ```sql
     SELECT j.id, j.title, j.last_date, j.is_published,
            jt.name AS type_name,
            s.name AS state_name
     FROM jobs j
     LEFT JOIN job_types jt ON j.job_type_id = jt.id
     LEFT JOIN states s ON j.state_id = s.id
     ORDER BY j.created_at DESC
     LIMIT 50 OFFSET ?
     ```
- `totalPages = Math.max(1, Math.ceil(total / 50))`.
- Reuse `formatDate()` from `dashboard.astro` (copy inline — handles `YYYY-MM-DD` and D1 datetime).
- Today comparison for status: `const today = new Date().toISOString().slice(0,10)` (compare string-wise with `last_date` since both `YYYY-MM-DD`; D1 datetime suffix `' HH:MM:SS'` still compares correctly via prefix). Use `row.last_date.slice(0,10) < today` to be safe.

### Status logic (per row)
```ts
function statusFor(row): { label: string; color: string } {
  if (row.is_published === 0) return { label: 'Draft',   color: '#f5a623' };
  if (row.last_date.slice(0,10) < today) return { label: 'Expired', color: '#ee0000' };
  return { label: 'Live', color: '#22a565' };
}
```
(Green chosen to match design-token "success" semantic — spec says "Live = green".)

### Markup
- `AdminLayout` with title `"All Jobs — SarkariNaukriBoard"`.
- Header row: `<h1>All Jobs</h1>` left, `<a href="/admin/jobs/new" class="btn">+ Add New Job</a>` right (flex justify-between).
- Flash banner (when any of success/updated/deleted=1): green inline alert with text:
  - `success=1` → "Job posted successfully."
  - `updated=1` → "Job updated."
  - `deleted=1` → "Job deleted."
- Empty state when `rows.length === 0` on page 1: "No jobs yet. Click + Add New Job to create one."
- Table columns: `ID | Title | Type | State | Last Date | Status | Edit | Delete`
  - Mirror table styling from `dashboard.astro` (white bg, `#ebebeb` border, 8px radius, zebra rows, 14px text).
  - Status cell: inline `<span>` with `color:{statusColor}` + `font-weight:500`.
  - Edit: `<a href="/admin/jobs/{id}/edit">Edit</a>` blue link.
  - Delete: inline `<form method="POST" action="/admin/jobs/{id}/delete" onsubmit="return confirm('Delete this job?')" style="display:inline"><button type="submit">Delete</button></form>` — button styled as a red link (no border, transparent bg).
- Pagination (only when `totalPages > 1`): centered row.
  - `« Prev` link (disabled span on page 1) → `?page={page-1}`.
  - Up to 5 numeric page links centered on current page; current page rendered as bold non-link.
  - `Next »` link (disabled span on last page) → `?page={page+1}`.
  - Each link preserves only `page` (no other params on this page yet).

### Inline styles
Match design tokens already used in `dashboard.astro`: ink `#171717`, body `#4d4d4d`, muted `#888888`, hairline `#ebebeb`, link `#0070f3`, error `#ee0000`, warning `#f5a623`, success green `#22a565`. No CSS framework, no JS beyond the inline `confirm()`.

## Notes / out of scope
- Title-search and type/status filter controls (spec lines 944) — deferred. Spec lists them but they're not in the user's task scope for this prompt.
- `Pagination.astro` shared component — deferred to F-20.
- The delete POST endpoint (`/admin/jobs/[id]/delete`) is F-19 (not yet built); the form will 404 until then. Confirmed acceptable since this task is F-16 only.

## Verification

```bash
npm run build                                                # ensure build passes
npx wrangler dev --port 8789                                 # local server

# Auth: log in via /admin/login first to get admin_session cookie, save jar.
curl -c jar.txt -b jar.txt -H "Origin: http://127.0.0.1:8789" \
  -X POST -d "username=admin&password=<seeded>" \
  http://127.0.0.1:8789/admin/login

# Fetch the list
curl -b jar.txt http://127.0.0.1:8789/admin/jobs            # 200, table renders
curl -b jar.txt http://127.0.0.1:8789/admin/jobs?success=1  # green flash visible
curl -b jar.txt http://127.0.0.1:8789/admin/jobs?page=2     # paginates (if >50 rows)
curl -I http://127.0.0.1:8789/admin/jobs                    # 302 → /admin/login without cookie
```

Visit `/admin/jobs` in browser; confirm:
- 4 status combinations render correctly (Live/Draft/Expired/no-state).
- Edit link goes to `/admin/jobs/{id}/edit` (404 until F-18, expected).
- Delete button shows `confirm()` dialog; cancelling does not submit.
- Flash banner appears with `?success=1`, `?updated=1`, `?deleted=1`.
- Sidebar (AdminLayout, F-15) highlights "All Jobs" via `aria-current` if path matches — verify sidebar entry exists.

Then paste the first 3 rendered `<tr>` rows of the table back into the chat.
