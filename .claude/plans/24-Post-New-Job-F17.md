# F-17 — Post New Job

## Context

`/admin/jobs/new` is the last missing piece of the Phase-3 admin write path. Currently `/admin/jobs/index.astro` exposes a `+ Add New Job` button that 404s; F-15/F-16 are live and seeded jobs were inserted via raw SQL. Implementing F-17 lets the operator post new jobs end-to-end from the UI: it must render the full form, validate per spec, write to D1, invalidate the KV listing cache so the new job appears immediately on `/jobs` and `/state/*`, and redirect back to `/admin/jobs?success=1` (the flash banner is already wired up at `src/pages/admin/jobs/index.astro:13`).

Auth is already handled by `src/middleware/index.ts` (covers `/admin/*` except `/admin/login`).

## File to create

- `src/pages/admin/jobs/new.astro` (single file — SSR, GET renders form, POST validates + inserts)

## Slugify (server-side helper, inline)

```ts
function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
```

No existing utility in `src/lib/` — keeping it inline.

## POST validation (per spec lines 1029-1038)

- `title` — required, ≤200 chars
- `job_type_id` — required, must match a fetched job_types.id
- `last_date` — required, valid `YYYY-MM-DD`, `>= today`
- `state_id` — required if selected job_type slug is `government` or `psu`
- `apply_url` OR `apply_email` — at least one non-empty
- `apply_url` — if present, must parse via `new URL()`
- `apply_email` — if present, must match email regex
- `slug` — if blank, derive from title via `slugify()`; if duplicate, auto-suffix `-2`, `-3`, … (spec line 1021)

On success: INSERT → `invalidateAllListingCaches(kv)` → redirect `/admin/jobs?success=1`.
On error: re-render form with `errors` + all submitted `values` preserved.

## Design tokens

Mirror `admin/login.astro` and `admin/jobs/index.astro`:
- Input: padding `10px 12px`, border `1px solid #ebebeb`, border-radius `6px`
- Primary button: `background:#171717`, `color:#fff`, padding `10px 20px`, radius `6px`
- Error: `color:#ee0000`, font-size `13px`
- h1: `22px`, weight `600`, color `#171717`
- Section heading: `15px`, weight `600`, margin-top `28px`

## Inline client JS

`<script is:inline>` that auto-generates slug from title on `input` event (same slugify regex), stops overwriting once user directly edits the slug field (`data-touched` flag).

## Key referenced files

- `src/lib/db.ts` — `getDb()`, `JobTypeRow`, `StateRow`, `CategoryRow`
- `src/lib/kv.ts` — `invalidateAllListingCaches(kv)`
- `src/pages/admin/login.astro:20-53` — POST/formData/env pattern
- `src/pages/admin/jobs/index.astro:13` — `?success=1` flash already wired
- `src/pages/jobs/index.astro:179-190` — state optgroup structure to mirror
- `schema.sql:11-15, 108-128` — job_type slugs (`government`, `psu`, `private`, `freelance`), jobs columns
