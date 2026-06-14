# F-14 — Admin Login

## Context

Implement the password-protected admin entry page at `/admin/login`. The auth middleware (`src/middleware/index.ts`) and signing utilities (`src/lib/auth.ts`) are already in place; this is the only public-facing admin route — every other `/admin/*` path is guarded by the middleware. The page must accept a username + password, verify against the `admins` table, mint an HMAC-signed `admin_session` cookie, and redirect to `/admin/dashboard` (which does not yet exist — login will succeed but the destination will 404 until F-15 lands; that is acceptable per the feature priority matrix).

**Hash algorithm note:** The user's prompt mentioned `bcryptjs`, but the existing `src/lib/auth.ts` already implements PBKDF2-SHA256 via Web Crypto (format `pbkdf2$iters$salt$hash`). Per the user's confirmation, F-14 reuses the existing PBKDF2 helpers — no new npm dependency, no schema migration.

## Files

**New:**
- `src/pages/admin/login.astro` — GET renders form; POST verifies and sets cookie.
- `scripts/hash-password.mjs` — one-off Node script to generate a PBKDF2 hash string for seeding the test admin.

**No changes:**
- `src/lib/auth.ts` — reuse `verifyPassword`, `signSession`, `SessionPayload`.
- `src/middleware/index.ts` — already lets `/admin/login` through.
- `src/layouts/AdminLayout.astro` — used as wrapper.

## Implementation

### `src/pages/admin/login.astro`

Frontmatter logic:

1. **Already-logged-in short-circuit (GET and POST):** Read `admin_session` cookie; if present and `verifySession(value, ADMIN_SECRET)` returns a payload, return `Astro.redirect('/admin/dashboard')`.
2. **POST branch** (`Astro.request.method === 'POST'`):
   - Parse `await Astro.request.formData()` → `username`, `password` (coerce to string, trim username).
   - If either missing → set `error = 'Invalid username or password'` and fall through to render.
   - Query D1: `SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1` via `getDb()`.
   - If no row → generic error.
   - `await verifyPassword(password, row.password_hash)` — if false → generic error.
   - On success:
     - `expiresAt = Date.now() + 8 * 60 * 60 * 1000`
     - `token = await signSession({ adminId: row.id, username: row.username, expiresAt }, ADMIN_SECRET)`
     - `Astro.cookies.set('admin_session', token, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', expires: new Date(expiresAt) })`
     - `return Astro.redirect('/admin/dashboard')`
3. **GET branch:** just render the form with `error = null`.

Pull `ADMIN_SECRET` via `import { env } from 'cloudflare:workers'` then `(env as any).ADMIN_SECRET as string` (mirrors `middleware/index.ts:14`). Throw if missing.

Markup (inside `<AdminLayout title="Admin Login — SarkariNaukriBoard">`):

```astro
<main style="max-width:360px;margin:80px auto;padding:0 24px;font-family:Geist,system-ui,sans-serif;">
  <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.5px;margin:0 0 24px;color:#171717;">Admin Login</h1>
  {error && <p role="alert" style="background:#fff1f0;border:1px solid #ee0000;color:#ee0000;padding:10px 12px;border-radius:6px;margin:0 0 16px;font-size:14px;">{error}</p>}
  <form method="POST" autocomplete="off">
    <label style="display:block;font-size:14px;color:#4d4d4d;margin-bottom:6px;">Username</label>
    <input name="username" type="text" required autofocus value={submittedUsername ?? ''} style="width:100%;padding:10px 12px;border:1px solid #ebebeb;border-radius:6px;margin-bottom:16px;font-size:14px;" />
    <label style="display:block;font-size:14px;color:#4d4d4d;margin-bottom:6px;">Password</label>
    <input name="password" type="password" required style="width:100%;padding:10px 12px;border:1px solid #ebebeb;border-radius:6px;margin-bottom:20px;font-size:14px;" />
    <button type="submit" style="width:100%;padding:10px 16px;background:#171717;color:#fff;border:0;border-radius:6px;font-weight:500;font-size:14px;cursor:pointer;">Log in</button>
  </form>
</main>
```

`submittedUsername` preserved across failed POSTs so the admin doesn't retype it. Password field always blank on re-render.

### `scripts/hash-password.mjs`

Pure Node 22 (uses built-in `globalThis.crypto.subtle`) — same PBKDF2 params as `src/lib/auth.ts:1-46` so output is verifiable by `verifyPassword`:

```js
const password = process.argv[2];
if (!password) { console.error('usage: node scripts/hash-password.mjs <password>'); process.exit(1); }
const ITERS = 100_000;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERS, hash: 'SHA-256' }, key, 256);
const b64 = (u8) => Buffer.from(u8).toString('base64');
console.log(`pbkdf2$${ITERS}$${b64(salt)}$${b64(new Uint8Array(bits))}`);
```

Run once locally to seed:
```bash
HASH=$(node scripts/hash-password.mjs testpass123)
npx wrangler d1 execute job-board-db --local --command \
  "INSERT INTO admins (username, password_hash) VALUES ('admin', '$HASH')"
```

## Out of scope (deferred to later prompts per spec priority matrix)

- Rate limiting (5 fails / IP / 15 min via KV) — spec calls for it under F-14 but no F-14 plan exists for it yet; flag and defer.
- `/admin/dashboard` (F-15) — login will redirect to a 404 until F-15 ships.

I will note the rate-limit omission in the implementation so it's visible.

## Verification

1. `node scripts/hash-password.mjs testpass123` prints `pbkdf2$100000$…$…`.
2. Insert the row via the `wrangler d1 execute --local` command above; confirm with `SELECT username FROM admins`.
3. Ensure `ADMIN_SECRET` is set in `.dev.vars` (any string, e.g. `dev-secret-change-me`). If missing, login will throw.
4. `npm run dev`, then:
   - **GET `/admin/login`** → form renders, no error.
   - **POST wrong password** (`admin` / `nope`) → form re-renders with red "Invalid username or password" banner, username pre-filled, no `admin_session` cookie set, no redirect.
   - **POST correct credentials** (`admin` / `testpass123`) → 302 redirect to `/admin/dashboard` (which will 404 — expected). `admin_session` cookie set with `HttpOnly; Secure; SameSite=Strict; Path=/; Expires=…`.
   - **GET `/admin/login` again with cookie present** → immediate redirect to `/admin/dashboard` (already-logged-in short-circuit).
   - **Tamper with cookie** (edit one char in DevTools) → middleware deletes cookie and bounces to `/admin/login`.
