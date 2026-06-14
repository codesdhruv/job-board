# Admin Navbar — Implementation Plan

## Context
The current `AdminLayout.astro` uses a **sidebar layout** (220px fixed left column). The spec replaces it with a fixed **top navbar** — dark-themed, with desktop center links, a theme toggle, a POST-based logout, and a mobile hamburger dropdown. A `logout.astro` page must also be created since it doesn't exist yet.

---

## Files to Change

| File | Action |
|---|---|
| `src/layouts/AdminLayout.astro` | Full rewrite — remove sidebar, add top navbar |
| `src/pages/admin/logout.astro` | Create new — POST handler, clears cookie, redirects |

---

## Implementation Steps

### 1. `src/pages/admin/logout.astro`
- GET → return 405
- POST → delete `admin_session` cookie (Max-Age=0) → redirect to `/admin/login`

### 2. `src/layouts/AdminLayout.astro` — Full Rewrite

**Frontmatter:**
```ts
const path = Astro.url.pathname;
const showNav = path !== '/admin/login';
const isActive = (href: string) =>
  href === '/admin/dashboard'
    ? path === '/admin/dashboard'
    : path.startsWith(href);
```

**CSS variables on `:root`:**
- `--anav-height: 56px`, `--anav-bg: #1a1d23`, `--anav-border-color: #2d3748`
- `--anav-text: #a0aec0`, `--anav-text-active: #ffffff`, `--anav-accent: #FF6B00`
- `--anav-hover-bg: #2d3748`, `--anav-active-bg: rgba(255,107,0,0.12)`

**Structure:** fixed top `.anav` bar → left brand, center `.anav-links`, right (theme btn + logout form + hamburger)

**Mobile:** `.anav-mobile-menu` fixed below navbar, hidden by default, `.open` shows it

**JS:** theme toggle (localStorage `"theme"` key, swap SVG), hamburger toggle, outside-click + Escape to close

---

## Verification
1. `npm run build && npx wrangler dev` → log in
2. Desktop: all links, active states, logout form, no hamburger
3. Mobile: hamburger opens/closes dropdown, active left-border
4. Logout: cookie cleared, middleware blocks re-access
5. Theme toggle persists on refresh
