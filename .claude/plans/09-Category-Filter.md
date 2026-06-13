# F-05 — Category Filter

## Context

The `/jobs` page already implements F-01 (listing), F-03 (type tabs), and F-04 (state filter). F-05 adds a `<select>` dropdown that filters jobs by category via `?category={slug}`, combining with the existing type, state, and (future) keyword filters. The `categories` table existed in `schema.sql` but had no seed data — this task seeds it and wires up the filter.

Spec source: `.claude/specs/02-job-board-feature-spec.md` lines 321–359.

## Approach

Mirror the existing state filter pattern in `src/pages/jobs/index.astro` exactly — same shape of code, same form-submit-onchange UX, same slug whitelisting against a DB-fetched set, same hidden-input param preservation. Plus seed 12 categories in `schema.sql`.

### Changes to `src/pages/jobs/index.astro`

1. **Fetch categories** (frontmatter, after the states query):
   ```ts
   const { results: categoryRows } = await db
     .prepare(`SELECT id, name, slug FROM categories ORDER BY name`)
     .all();
   type CategoryRow = { id: number; name: string; slug: string };
   const categories = categoryRows as CategoryRow[];
   const validCategorySlugs = new Set(categories.map((c) => c.slug));
   ```

2. **Read + validate the query param**:
   ```ts
   const categoryParam = Astro.url.searchParams.get('category');
   const activeCategory =
     categoryParam && validCategorySlugs.has(categoryParam) ? categoryParam : null;
   ```
   Invalid slug falls through to no filter (matches F-01 edge case rule).

3. **Extend the WHERE clause** on the existing jobs query:
   ```ts
   if (activeCategory) { where.push('c.slug = ?'); binds.push(activeCategory); }
   ```
   The existing `LEFT JOIN categories c` is already in the SQL, so no JOIN change.

4. **Build a category-specific preserved-params list** alongside the existing `preservedParams`:
   ```ts
   const preservedForCategory: { key: string; value: string }[] = [];
   for (const [key, value] of Astro.url.searchParams.entries()) {
     if (key !== 'state' && key !== 'page') preservedParams.push({ key, value });
     if (key !== 'category' && key !== 'page') preservedForCategory.push({ key, value });
   }
   ```
   Preserves `type`, `state`, and any future `q` when category changes; drops `page` (filter change resets pagination).

5. **Render the category form** in both `promoteState` and `!promoteState` branches, placed directly below the state filter form. Same styling tokens as the state `<select>` (`padding:8px;border:1px solid #ebebeb;border-radius:6px;min-width:240px`).

### Changes to `schema.sql`

Add `INSERT OR IGNORE` seed for `categories` after the table definition:

```sql
INSERT OR IGNORE INTO categories (name, slug) VALUES
  ('Banking',                  'banking'),
  ('Defence',                  'defence'),
  ('Engineering',              'engineering'),
  ('IT / Software',            'it-software'),
  ('Medical / Health',         'medical-health'),
  ('Police / Law',             'police-law'),
  ('Railways',                 'railways'),
  ('Teaching / Education',     'teaching-education'),
  ('Clerical / Administration','clerical-administration'),
  ('Accounts / Finance',       'accounts-finance'),
  ('Agriculture',              'agriculture'),
  ('Research / Science',       'research-science');
```

Applied locally via `npx wrangler d1 execute job-board-db --local --file=./schema.sql`. Apply to remote with the same command + `--remote` before next deploy.

## Critical files

- `src/pages/jobs/index.astro` — filter wired in (categories query, param validation, WHERE clause, dual `preservedForCategory` list, two conditional `<form>` blocks).
- `schema.sql` — 12 category seeds added.
- `.claude/specs/02-job-board-feature-spec.md` (F-05, lines 321–359) — spec source.

## Verification (run on 2026-06-14)

Local dev server at `http://localhost:4322` via `npm run dev`. Both jobs reassigned for testing:
`UPDATE jobs SET category_id = (SELECT id FROM categories WHERE slug='engineering') WHERE slug='upsc-engineer-2026';`
`UPDATE jobs SET category_id = (SELECT id FROM categories WHERE slug='railways') WHERE slug='rrb-tech-2026';`

| Test | URL | Expected | Result |
|---|---|---|---|
| Default render | `/jobs` | Dropdown lists 12 categories alphabetically; "All categories" `selected` | ✅ |
| Filter by engineering | `/jobs?category=engineering` | Only UPSC Engineering Services 2026 shown; option `selected` | ✅ |
| Filter by railways | `/jobs?category=railways` | Only RRB Technician Recruitment shown | ✅ |
| Empty category | `/jobs?category=banking` | "No jobs found." | ✅ |
| Invalid slug | `/jobs?category=does-not-exist` | Ignored, full listing shown | ✅ |
| Combine with type | `/jobs?type=government&category=engineering` | UPSC Engineering matches both filters | ✅ |
| Combine with type, empty intersection | `/jobs?type=private&category=engineering` | "No jobs found." | ✅ |
| Preserve type in category form hidden inputs | `/jobs?type=government` | `<input type="hidden" name="type" value="government">` in category form | ✅ |
| Preserve state + type when both active | `/jobs?type=government&state=uttar-pradesh` | Category form emits both `type` and `state` hidden inputs | ✅ |

## Out of scope (deferred)

- Pagination (F-20) interaction — category form already drops `page` via `preservedForCategory`, awaiting F-20 to verify end-to-end.
- Keyword search (F-06) interaction — `q` will be preserved automatically via the unknown-param pass-through.
- Styling beyond the inline tokens that match the state filter.
- `--remote` D1 seed application — local only for now.
