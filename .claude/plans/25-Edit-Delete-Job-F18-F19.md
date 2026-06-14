# F-18 (Edit Job) + F-19 (Delete Job) — Implementation Plan

## Context

The admin CRUD trio (post / edit / delete) is the operator's primary loop. F-17 (Post New Job) is built and verified — admins can create jobs and have them appear on the public site after KV invalidation. F-15 (dashboard) and F-16 (job list) already render "Edit" and "Delete" links that point at `/admin/jobs/[id]/edit` and `/admin/jobs/[id]/delete`, but those routes return 404. This plan adds both pages so the admin loop closes:

- **F-18** — Edit an existing job using the same 6-section form as F-17, with the existing slug-change warning so admins know they will break inbound links.
- **F-19** — Hard-delete a job via POST-only endpoint with KV cache invalidation, so the deletion is reflected on `/jobs` immediately.

The prompt also asks me to confirm `invalidateAllListingCaches()` is wired into F-17 — it already is (`src/pages/admin/jobs/new.astro:163-164`), so no change required there.

## Files to create

### 1. `src/pages/admin/jobs/[id]/edit.astro` — F-18

Mirror `src/pages/admin/jobs/new.astro` with these deltas:

**Frontmatter:**
- Read `id` from `Astro.params.id`; parse to int. If NaN or no matching row, return `new Response(null, { status: 404 })`.
- Load the existing job: `SELECT * FROM jobs WHERE id = ? LIMIT 1`.
- Load dropdown data exactly like F-17 (job_types / states / categories / departments via `Promise.all`).
- Capture the original slug (`originalSlug = job.slug`) so we can detect changes for the warning and for uniqueness handling.
- Seed the `values` object from the loaded job row on GET (rather than empty strings). All numeric FK fields stringified for `<select>` matching.

**POST handler — reuse F-17 validation verbatim**, with two differences:
1. **Slug uniqueness** — replace `makeUniqueSlug(slug)` with a uniqueness check that excludes the current job:
   ```ts
   async function makeUniqueSlugExcluding(slug: string, excludeId: number): Promise<string> {
     let candidate = slug;
     let n = 2;
     while (true) {
       const row = await db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE slug = ? AND id != ?')
         .bind(candidate, excludeId).first<{ n: number }>();
       if (!row || row.n === 0) return candidate;
       candidate = `${slug}-${n++}`;
     }
   }
   ```
   Only call this when `values.slug !== originalSlug` (otherwise keep slug as-is — no need to re-check).
2. **DB write** — replace INSERT with:
   ```sql
   UPDATE jobs SET
     slug = ?, title = ?, department_id = ?, job_type_id = ?, category_id = ?,
     state_id = ?, location = ?, vacancies = ?, qualification = ?, age_limit = ?,
     salary = ?, last_date = ?, apply_url = ?, apply_email = ?, description = ?,
     is_published = ?, updated_at = CURRENT_TIMESTAMP
   WHERE id = ?
   ```
   Bind in the same order as F-17's INSERT plus the trailing `id`. Use the same `nullOr` / `intOr` helpers from F-17.

**After successful UPDATE:**
- `await invalidateAllListingCaches(kv)` (same `(env as any).KV` lookup as F-17).
- `return Astro.redirect('/admin/jobs?updated=1')` — F-16 already detects `?updated=1` and shows "Job updated."

**Form HTML:**
- Copy the full 6-section form from `new.astro`. The `<h1>` becomes "Edit Job".
- Slug input gets a sibling `<span id="slug_warning">` (hidden by default) so the inline script can show the warning when the slug changes.

**Inline `<script is:inline>`:**
- Keep F-17's slugify + auto-generation logic and the `state_asterisk` toggle.
- Add a slug-change warning: capture the original slug as a `data-original` attribute on the slug input; on `input` event, compare current value to original — if different, show `slug_warning` with text "Changing the slug will break existing links."; if matched, hide it.
- The original slug is server-rendered into the input's `data-original` attribute so the script needs no other state.

### 2. `src/pages/admin/jobs/[id]/delete.astro` — F-19

POST-only endpoint. No form HTML — this route is only ever hit by F-16's inline delete form.

```astro
---
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../lib/db';
import { invalidateAllListingCaches } from '../../../../lib/kv';

if (Astro.request.method !== 'POST') {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

const id = parseInt(Astro.params.id ?? '', 10);
if (Number.isNaN(id)) return new Response(null, { status: 404 });

const db = getDb();
const result = await db.prepare('DELETE FROM jobs WHERE id = ?').bind(id).run();
// SQLite returns success even on no-op; that's fine — idempotent.

const kv = (env as any).KV as KVNamespace | undefined;
if (kv) await invalidateAllListingCaches(kv);

return Astro.redirect('/admin/jobs?deleted=1');
---
```

No body needed — the page only runs frontmatter and redirects. F-16 already detects `?deleted=1` and shows "Job deleted."

## KV invalidation audit (per prompt)

| Operation | File | Status |
|---|---|---|
| Create | `src/pages/admin/jobs/new.astro:163-164` | ✓ already wired |
| Update | `src/pages/admin/jobs/[id]/edit.astro` | will be added by this plan |
| Delete | `src/pages/admin/jobs/[id]/delete.astro` | will be added by this plan |

## Reused utilities

- `getDb()`, `JobRow`, `JobTypeRow`, `StateRow`, `CategoryRow`, `DepartmentRow` from `src/lib/db.ts`.
- `invalidateAllListingCaches(kv)` from `src/lib/kv.ts`.
- `AdminLayout` from `src/layouts/AdminLayout.astro` (sidebar auto-renders for any `/admin/*` path other than `/admin/login`).
- Auth is enforced globally by `src/middleware/index.ts` — no per-page check required.
- F-16's flash-banner logic (`src/pages/admin/jobs/index.astro:7-19`) already recognises `?updated=1` and `?deleted=1`.

## Verification (run after implementing)

```bash
npm run build && npx wrangler dev --port 8789
```

In a separate terminal, log in via the browser at `http://127.0.0.1:8789/admin/login` to get a session cookie, then:

1. **Edit title** — navigate to `/admin/jobs`, click Edit on a seeded job, change title, submit → redirected to `/admin/jobs?updated=1`, banner shows "Job updated.", then open `/jobs` and confirm the new title appears (cache invalidated).
2. **Slug change warning** — on the edit page, edit the slug field; the inline warning "Changing the slug will break existing links." should appear immediately. Restoring the original value should hide it. Submit → confirm the public `/jobs/[new-slug]` resolves and `/jobs/[old-slug]` returns 404.
3. **Delete** — from `/admin/jobs`, click Delete on a row, confirm the JS prompt → redirected to `/admin/jobs?deleted=1` with "Job deleted." banner; row no longer in the table; `/jobs` no longer shows it.
4. **Cache freshness** — immediately after delete, hit `/jobs` (page 1) — deleted job must not appear. This proves `invalidateAllListingCaches()` ran. Repeat by editing a job and confirming the updated title appears on `/jobs` without waiting for the 5-min TTL.
5. **405 on GET** — `curl -i http://127.0.0.1:8789/admin/jobs/1/delete` (with `-H "Cookie: admin_session=…"`) should return `405 Method Not Allowed` with `Allow: POST`.
6. **404 on bad id** — `/admin/jobs/99999/edit` → 404.

Paste the wrangler request logs + flash-banner screenshots / curl output back into the conversation.
