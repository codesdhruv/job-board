# F-23 — Auth Middleware Implementation Plan

## Context

F-23 protects all `/admin/*` routes (except `/admin/login`) with a session cookie check. The file `src/middleware/index.ts` already exists and implements the correct logic, but has one bug: it reads `ADMIN_SECRET` via `context.locals.runtime?.env?.ADMIN_SECRET`, which is the Astro v5 API removed in Astro v6. Every other file in the project uses `import { env } from 'cloudflare:workers'` instead.

## What needs to change

**File:** `src/middleware/index.ts`

Single change:
- Remove: `const secret = context.locals.runtime?.env?.ADMIN_SECRET;`
- Add: `import { env } from 'cloudflare:workers';` at the top
- Use: `const secret = (env as any).ADMIN_SECRET as string | undefined;`

The rest of the middleware is already correct:
- Public routes (`!pathname.startsWith('/admin')`) → `next()`
- `/admin/login` → `next()`
- No cookie → `redirect('/admin/login')`
- Invalid/expired session → delete cookie + `redirect('/admin/login')`
- Valid session → `next()`

## Critical files

- `src/middleware/index.ts` — the only file to modify
- `src/lib/auth.ts` — `verifySession()` already implemented, no changes

## Verification

```bash
# Start dev server
npm run dev

# Test 1: /admin/dashboard with no cookie → 302 to /admin/login
curl -v http://localhost:4321/admin/dashboard 2>&1 | grep -E "< HTTP|Location:"

# Test 2: /admin/login with no cookie → 200
curl -v http://localhost:4321/admin/login 2>&1 | grep "< HTTP"

# Test 3: /jobs with no cookie → 200
curl -v http://localhost:4321/jobs 2>&1 | grep "< HTTP"
```
