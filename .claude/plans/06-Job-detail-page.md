# F-02 — Job Detail Page (`/jobs/[slug]`)

Spec: `.claude/specs/06-Job-detail-page.md` (references F-02 in `.claude/specs/02-job-board-feature-spec.md`).

## File

- **New:** `src/pages/jobs/[slug].astro`
- No changes to `db.ts`, `BaseLayout`, or `JobCard`.

## Frontmatter — data

1. Read `slug` from `Astro.params`; `getDb()`.
2. Run F-02 detail SQL with `.bind(slug).first()`:
   ```sql
   SELECT j.*, jt.name AS type_name, jt.slug AS type_slug,
          c.name AS category_name, c.slug AS category_slug,
          s.name AS state_name, s.slug AS state_slug,
          d.name AS dept_name, d.logo_r2_key
   FROM jobs j
   LEFT JOIN job_types jt ON j.job_type_id = jt.id
   LEFT JOIN categories c ON j.category_id = c.id
   LEFT JOIN states s ON j.state_id = s.id
   LEFT JOIN departments d ON j.department_id = d.id
   WHERE j.slug = ? AND j.is_published = 1
   ```
3. If `!job` → `Astro.response.status = 404`, render minimal "Not found" body.
4. Derive flags:
   - `isExpired = job.last_date < todayStr` (string compare on `YYYY-MM-DD` avoids TZ drift).
   - `isUrgent` if `0 <= daysLeft <= 7` and not expired (matches `JobCard` rule).
   - `applyMode = 'url' | 'email' | 'none'`.
5. Similar jobs (only if `category_id` not null):
   ```sql
   SELECT j.id, j.slug, j.title, j.last_date, d.name AS dept_name
   FROM jobs j
   LEFT JOIN departments d ON j.department_id = d.id
   WHERE j.category_id = ? AND j.id != ? AND j.is_published = 1
   ORDER BY j.created_at DESC LIMIT 5
   ```
   Spec query selects `dept_name` directly — added the `LEFT JOIN departments` so the column resolves.
6. Canonical: `${env.SITE_URL}/jobs/${job.slug}`.
7. Meta description: strip HTML from `description`, take first 155 chars; fallback to a generated string from title + dept + state + last_date.

## Markup (inside `<BaseLayout>`)

- Breadcrumb: Home › Jobs › {Category, if any} › {Title}.
- Header: dept name, `<h1>` title, `[type]` · state · "Posted YYYY-MM-DD".
- Info grid (`<dl>`): vacancies, last_date (red `#ee0000` if urgent), salary, qualification, age_limit, category, location. Skip null cells.
- Description: render with `set:html` only if non-null. Sanitization deferred to F-17 admin write path.
- Apply section:
  - Expired → "Applications closed" banner; apply button suppressed.
  - `apply_url` → `<a target="_blank" rel="noopener">Apply Now →</a>`.
  - `apply_email` → `<a href="mailto:…">Apply via Email</a>`.
  - Both null → "Check official website for application details".
- Similar jobs `<aside>`: up to 5 `<li>` linking to `/jobs/{slug}` with dept + last_date. Section omitted if empty.

## Out of scope for this slice

- **F-11 `JobPosting` JSON-LD** — separate ticket.
- Department logo from R2 — bindings exist; no logos seeded.
- Description HTML sanitization — belongs to admin write path (F-17).
- Design-system styling polish — only the inline `#ee0000` urgent color from `JobCard` is used.

## Verification

- `npm run build` → clean.
- `npx wrangler dev`:
  - `/jobs/<seeded-slug>` → 200; all sections render; apply behaviour matches data.
  - `/jobs/does-not-exist` → 404 with body.
  - Flip a seed row's `is_published = 0` → 404.
  - Backdate `last_date` → "Applications closed" banner; apply button hidden.
