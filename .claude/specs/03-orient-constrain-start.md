Read the attached spec file `job-board-feature-spec.md` and `job-board-specdoc.md` completely before writing any code.

Your task is to scaffold the project foundation only — no features yet.

Do the following in order:
1. Init an Astro 4.x project with `@astrojs/cloudflare` SSR adapter
2. Create `wrangler.toml` with D1, KV, and R2 bindings (use placeholder IDs)
3. Create `schema.sql` with all tables: job_types, states, categories, departments, admins, jobs — including all indexes and seed data for job_types and states (all 36)
4. Create `src/lib/db.ts` — typed D1 query helper
5. Create `src/lib/auth.ts` — session sign/verify using ADMIN_SECRET env var
6. Create `src/lib/seo.ts` — buildJobPostingSchema() function
7. Create `src/lib/kv.ts` — getListingCached() and invalidateAllListingCaches()
8. Create `src/layouts/BaseLayout.astro` and `src/layouts/AdminLayout.astro` — shells only, no content yet
9. Create `src/middleware/index.ts` — auth guard for /admin/* per F-23

Do NOT build any pages yet. Do NOT add any UI. Foundation only.

After each file, confirm what was created and why. Stop and ask if any spec detail is ambiguous before guessing.