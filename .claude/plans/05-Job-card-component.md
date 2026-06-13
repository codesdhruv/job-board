# Plan — 05 JobCard component (F-01)

Spec: `.claude/specs/05-Job-card-component.md`

## Goal
Extract the inline job row in `src/pages/jobs/index.astro` into a reusable `JobCard.astro` component per F-01.

## Steps

### 1. Create `src/components/JobCard.astro`
- Props: a single `job` object (typed loosely as the SQL row shape — `slug`, `title`, `dept_name`, `type_name`, `state_name`, `vacancies`, `last_date`, `salary`).
- Render plain semantic HTML — an `<article>` containing:
  - `<h2>` job title (linked to `/jobs/[slug]`)
  - department name
  - job type badge (`<span>` with the type name)
  - state name
  - vacancies
  - `last_date` — wrapped in a `<span>` with **inline `style="color:#ee0000"`** only when the date is ≤7 days from today
  - salary
  - `<a href={`/jobs/${slug}`}>View Details →</a>`
- Urgency check done in component frontmatter: `Math.floor((last - today) / 86_400_000) <= 7 && >= 0`.
- **No styling framework**, no classes — only the one inline red style allowed by the spec.

### 2. Update `src/pages/jobs/index.astro`
- Import `JobCard`.
- Replace the `<ul><li>{j.title}…</li></ul>` block with `{results.map(j => <JobCard job={j} />)}`.
- Keep the existing SQL and "No jobs found" empty state.

### 3. Verify
- `npm run build` — must pass clean.
- `npm run dev` → `GET /jobs` → 200.
- Seed an urgent (≤7d) and a non-urgent job; confirm only the urgent date renders with `style="color:#ee0000"`.
- Confirm all 8 fields present in card HTML.

## Outcome
Implemented and verified on 2026-06-14.
- `src/components/JobCard.astro` created.
- `src/pages/jobs/index.astro` updated to use it.
- Build clean; `/jobs` returns 200; red-date branch and plain branch both verified via seeded D1 rows.
