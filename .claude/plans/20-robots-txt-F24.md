# F-24 — robots.txt

## Context

Spec F-24 requires a `robots.txt` at `/robots.txt` that:
- Allows all crawlers on `/`
- Blocks crawlers from `/admin/`
- Includes the sitemap URL

This is the last Phase 4 SEO/infrastructure feature. All other F-24 dependencies (F-12 sitemap, F-21 SEO meta) are already in place.

---

## Approach

`public/robots.txt` — a plain static file served directly by Cloudflare's asset binding.

**Why static, not an SSR endpoint?**
- robots.txt never changes per-request; static is the correct model.
- `public/` files are served at the root URL (`/robots.txt`) automatically by the Astro + Cloudflare adapter without any routing config.
- `SITE_URL` is `https://example.com` in `wrangler.jsonc` `vars` — the sitemap URL is hardcoded from this known value. To change the domain, update `wrangler.jsonc` and rebuild.
- No `.ts` endpoint needed (unlike sitemap/rss which need live D1 queries).

---

## Implementation

**File to create:** `public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /admin/*

Sitemap: https://example.com/sitemap.xml
```

`SITE_URL` in `wrangler.jsonc` is `https://example.com` — that value is used directly.

---

## Files changed

| File | Action |
|---|---|
| `public/robots.txt` | Create (new) |

No other files need changes. No DB queries, no KV, no middleware.

---

## Verification

1. Run `npm run build && wrangler dev`
2. Visit `http://localhost:8787/robots.txt`
3. Confirm exact content matches spec:
   - `Disallow: /admin/` present
   - `Disallow: /admin/*` present
   - `Sitemap:` line present with the correct URL
4. Confirm `/admin/login` returns a redirect (middleware still works — robots.txt served before Workers code runs)
