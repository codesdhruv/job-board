# Phase 1 Foundation — Project Scaffold

## Context

The repo currently has an Astro 6.4.6 boilerplate (default welcome page) with `@astrojs/cloudflare` installed but no Cloudflare bindings wired up, no database schema, and no application libraries. Before any of the F-01 to F-24 features can be built, we need the foundational plumbing: D1/KV/R2 bindings declared, a SQLite schema with seed data, and the four library modules (`db`, `auth`, `seo`, `kv`) plus the auth middleware and empty layout shells that the rest of the codebase will depend on.

This plan delivers Phase 1 of the spec (`specdoc § 15`) only — no pages, no UI, no features. Goal: a deployable scaffold that `wrangler types` can generate bindings for, that `wrangler d1 execute` can migrate, and that future feature work can import from without touching infra.

## Decisions locked

| Question | Decision |
|---|---|
| Wrangler config format | Extend existing `wrangler.jsonc` (keep CLAUDE.md's choice) |
| Astro version | Keep 6.4.6 (already installed) |
| Password hashing | Web Crypto **PBKDF2-SHA256, 100k iters** (deviation from spec's "bcrypt cost 12" — native to Workers, zero deps, fast; rate-limit in F-14 covers brute-force) |
| Session signing | HMAC-SHA256 via Web Crypto, `ADMIN_SECRET` env var |
| D1 binding | `DB` |
| KV binding | `KV` |
| R2 binding | `R2` |

## Files to create / modify

### 1. `wrangler.jsonc` (modify)
Add three binding blocks alongside existing config. Placeholder IDs the user replaces after `wrangler d1 create` / `kv namespace create` / `r2 bucket create`.

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "job-board-db", "database_id": "PLACEHOLDER_D1_ID" }
],
"kv_namespaces": [
  { "binding": "KV", "id": "PLACEHOLDER_KV_ID" }
],
"r2_buckets": [
  { "binding": "R2", "bucket_name": "job-board-assets" }
],
"vars": {
  "SITE_URL": "https://example.com"
}
```
(Note: `ADMIN_SECRET` is set via dashboard, not in `vars`, since it's a secret.)

### 2. `schema.sql` (new, repo root)
All six tables in spec order, all indexes, seed data for `job_types` (4 rows) and `states` (37 rows = 28 states + 8 UTs + "All India"). Tables: `job_types`, `states`, `categories`, `departments`, `admins`, `jobs`. Matches specdoc § 5 exactly. Uses `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE` so the file is idempotent and safe to re-run.

### 3. `src/lib/db.ts` (new)
Thin typed wrapper around D1. Two exports:
- `getDb(locals: App.Locals): D1Database` — pulls `DB` off `locals.runtime.env` with a clear error if missing.
- Type definitions for each row (`JobRow`, `JobTypeRow`, `StateRow`, `CategoryRow`, `DepartmentRow`, `AdminRow`) mirroring the schema.

No query builders — feature code uses `db.prepare(...).bind(...).all<T>()` directly. Keeps surface minimal.

### 4. `src/lib/auth.ts` (new)
Web Crypto only. Four exports:
- `hashPassword(password: string): Promise<string>` — PBKDF2-SHA256, 100k iters, random 16-byte salt, returns `pbkdf2$100000$<salt_b64>$<hash_b64>`.
- `verifyPassword(password: string, stored: string): Promise<boolean>` — parses stored format, recomputes, constant-time compare.
- `signSession(payload: { adminId: number; username: string; expiresAt: number }, secret: string): Promise<string>` — `<payload_b64>.<hmac_sha256_b64>`.
- `verifySession(token: string, secret: string): Promise<SessionPayload | null>` — verifies HMAC, checks `expiresAt > Date.now()`, returns payload or null.

### 5. `src/lib/seo.ts` (new)
`buildJobPostingSchema(job, dept, state)` per F-11. Returns a plain object ready for `JSON.stringify`. Handles:
- HTML strip from description (regex `/<[^>]+>/g`, then truncate 500 chars).
- `validThrough` formatted as `YYYY-MM-DDT00:00:00`.
- Salary parse: extract first integer from text via `/\d[\d,]*/` → strip commas.
- Omit `hiringOrganization` / `jobLocation` / `baseSalary` blocks entirely when source fields are null (per F-11 edge cases).
- `addressCountry` always `"IN"`.

### 6. `src/lib/kv.ts` (new)
Two exports per F-22:
- `getListingCached<T>(kv: KVNamespace, key: string, fetchFn: () => Promise<T>, ttlSeconds = 300): Promise<T>` — cache-aside, JSON-encoded, falls through to `fetchFn` on miss or parse error.
- `invalidateAllListingCaches(kv: KVNamespace): Promise<void>` — `kv.list({ prefix: 'jobs:' })` + `Promise.all(delete)`, loops if `list_complete` is false.

### 7. `src/layouts/BaseLayout.astro` (new)
Empty shell: `<html><head><meta charset/><meta viewport/><title>{Astro.props.title}</title></head><body><slot/></body></html>`. Accepts `title`, `description`, `canonical` props but does not render meta tags yet (F-21 deferred to Phase 4). No nav, no footer.

### 8. `src/layouts/AdminLayout.astro` (new)
Empty shell with `<meta name="robots" content="noindex,nofollow">`. Accepts `title` prop. No sidebar yet.

### 9. `src/middleware/index.ts` (new)
Per F-23. Uses `defineMiddleware` from `astro:middleware`. Logic:
1. If path doesn't start with `/admin` → `next()`.
2. If path is exactly `/admin/login` → `next()`.
3. Read `admin_session` cookie; if missing → `redirect('/admin/login')`.
4. Call `verifySession(cookie, context.locals.runtime.env.ADMIN_SECRET)`; if null → delete cookie, redirect to login.
5. Else `next()`.

### 10. `src/env.d.ts` (modify or new)
Augment `App.Locals` with `runtime.env` typing for `DB`, `KV`, `R2`, `ADMIN_SECRET`, `SITE_URL`. Lets the lib modules and middleware type-check without `as any`.

## Files NOT touched

- `src/pages/index.astro` — leave the welcome page; Phase 2 work.
- `astro.config.mjs` — already configured with the Cloudflare adapter.
- `package.json` — no new deps needed (Web Crypto is native).
- `public/`, `DESIGN.md`, `CLAUDE.md`, spec files.

## Verification

After implementation, run in order:

```bash
npm run generate-types        # should emit types for DB, KV, R2 bindings
npm run build                 # should compile with no TS errors
npx wrangler d1 create job-board-db                          # capture the ID
# paste ID into wrangler.jsonc
npx wrangler kv namespace create KV                          # capture the ID, paste
npx wrangler r2 bucket create job-board-assets
npx wrangler d1 execute job-board-db --local --file=./schema.sql
npx wrangler d1 execute job-board-db --local \
  --command "SELECT COUNT(*) FROM states;"                   # expect 37
npx wrangler d1 execute job-board-db --local \
  --command "SELECT COUNT(*) FROM job_types;"                # expect 4
npm run dev                                                  # boots, welcome page renders
```

Smoke test for middleware (manual): hit `/admin/dashboard` in the browser — should redirect to `/admin/login` (which 404s for now; that's expected — login page is Phase 3).

## Out of scope for this plan

Anything from F-01 through F-24 beyond what's listed above. No pages, no components, no admin forms, no JSON-LD injection, no sitemap, no RSS, no `robots.txt`. Phases 2–5.
