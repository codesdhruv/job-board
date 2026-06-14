# Plan: 4 static MPA pages (About, Privacy, Terms, Contact)

## Context

The site currently has zero static informational pages. Search engines, users, and the (planned) `robots.txt`/legal footer expect About / Privacy / Terms / Contact. These are pure static MPA pages — no D1, no KV, no forms — so they're cheap to add and unlock F-21-compliant footer links across the site. They also need to appear in `sitemap.xml` so they're discoverable.

## Files to create

Each file uses `BaseLayout.astro` (which already emits `<title>`, `<meta name="description">`, `<link rel="canonical">`, and `<meta name="robots" content="index, follow">` — no per-page robots tag needed).

Canonical pattern (matches `src/pages/index.astro:89-90` and `states.astro:32-33`):
```ts
import { env } from 'cloudflare:workers';
const siteUrl = ((env as any).SITE_URL ?? '').replace(/\/$/, '');
const canonical = `${siteUrl}/about`;  // adjust per page
```

### `src/pages/about.astro`
- title: `About SarkariNaukriBoard — India's job board for govt and private jobs`
- description: `Learn about SarkariNaukriBoard — India's job board covering government, PSU, private and freelance roles with state-level filtering.`
- canonical: `${SITE_URL}/about`
- 2–3 placeholder `<p>` paragraphs inside `<main>` with `<h1>About SarkariNaukriBoard</h1>`

### `src/pages/privacy-policy.astro`
- title: `Privacy Policy — SarkariNaukriBoard`
- description: `Privacy policy for SarkariNaukriBoard. How we handle data, cookies and analytics.`
- canonical: `${SITE_URL}/privacy-policy`
- `<h1>Privacy Policy</h1>` + 2–3 placeholder paragraphs

### `src/pages/terms.astro`
- title: `Terms & Conditions — SarkariNaukriBoard`
- description: `Terms and conditions for using SarkariNaukriBoard.`
- canonical: `${SITE_URL}/terms`
- `<h1>Terms & Conditions</h1>` + 2–3 placeholder paragraphs

### `src/pages/contact.astro`
- title: `Contact Us — SarkariNaukriBoard`
- description: `Contact SarkariNaukriBoard. Reach out via email for questions, corrections or partnership.`
- canonical: `${SITE_URL}/contact`
- `<h1>Contact Us</h1>` + 1 short intro paragraph + an `<a href="mailto:contact@yourdomain.com">contact@yourdomain.com</a>` line. No `<form>`.

Styling: minimal inline styles matching the design tokens already in use (`color:#171717`, `font-family:Geist,Inter,system-ui,…`, `max-width:720px;margin:0 auto;padding:64px 24px;` container). No new components.

## Files to modify

### `src/layouts/BaseLayout.astro`
- Add a `<footer>` inside `<body>`, after the default `<slot />`, with links to: `/about`, `/privacy-policy`, `/terms`, `/contact`, `/sitemap.xml`, plus the existing `/states` and `/jobs` links so all pages get consistent navigation.
- Use the same visual treatment as the existing homepage footer (`src/pages/index.astro:218-227`) — 1px hairline `#ebebeb` top border, `64px 24px` padding, 14px muted `#4d4d4d` links, © line.
- **Skip header nav** — task says "your call on placement — footer is mandatory, header is optional"; BaseLayout currently has no nav at all and adding one risks layout regressions across already-built pages. Footer-only keeps blast radius small.

### `src/pages/index.astro`
- **Remove** the inline `<footer>` block at lines 218-227. Once BaseLayout emits a footer on every page, leaving the homepage's inline footer in place would render two stacked footers. Net diff: delete the inline block; the BaseLayout footer takes over.

### `src/pages/sitemap.xml.ts`
- Extend the `staticUrls` array at line 65 from `['/', '/jobs', '/states']` to `['/', '/jobs', '/states', '/about', '/privacy-policy', '/terms', '/contact']`. No other changes — these inherit the existing `<url><loc>` emission at line 70.

## Verification

After execution (cannot run in plan mode):

1. `npm run build` — confirm zero errors and the 4 new routes appear in build output.
2. `npm run dev` (preferred over `wrangler dev` per CLAUDE.md — wrangler dev serves stale `dist/`).
3. For each of `/about`, `/privacy-policy`, `/terms`, `/contact`:
   - `curl -s http://localhost:4321/<path> | grep -E '<title>|<meta name="description"|<link rel="canonical"|<meta name="robots"'`
   - Confirm title matches spec table above, description present, canonical = `${SITE_URL}/<path>`, robots = `index, follow`.
4. `curl -s http://localhost:4321/ | grep -E 'href="/about"|href="/privacy-policy"|href="/terms"|href="/contact"|href="/sitemap.xml"'` — all 5 hrefs present in homepage footer (rendered via BaseLayout).
5. `curl -s http://localhost:4321/sitemap.xml | grep -E '/about|/privacy-policy|/terms|/contact'` — all 4 paths in sitemap.
6. Paste the 4 `<title>` lines back to user for sign-off.

## Out of scope

- Writing real legal copy (user will replace placeholders).
- Header nav (footer-only per task wording).
- Contact form / backend.
- Adding `robots.txt` (F-24, separate ticket).
