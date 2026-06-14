# Plan: Responsive Navbar — F-26

## Context
The project had no navbar. All pages use `BaseLayout.astro` which had only a footer.
The project uses inline styles throughout — no CSS framework. This plan builds a fully
responsive navbar using a `<style is:global>` block + vanilla JS, consistent with the
existing codebase style.

---

## What was built

### New: `src/components/Navbar.astro`

**Server-side (frontmatter):**
- Defines `primaryLinks` (5) and `secondaryLinks` (4) as arrays
- `isActive(link)` helper: exact match for `/` and `/jobs`, `?type=` param check for
  type-filtered job links, `startsWith` for all others
- Reads `Astro.url.pathname` and `Astro.url.searchParams` — no client-side active logic

**Markup:**
- `<nav id="nav-root">` — sticky, z-50, white bg, 1px border-bottom
- `.nav-inner` — 1200px max-width, flex row, 60px height
- `.nav-logo` — saffron #FF6B00 bold link to `/`
- `.nav-links` — hidden on mobile, flex on ≥1024px; primary links + 1px divider + secondary links
- `.nav-controls` — theme toggle button + hamburger button (hamburger hidden on ≥1024px)
- `#mobile-menu` — hidden by default; "Main" / "More" labelled sections, all 9 links stacked

**`<style is:global>`:**
- Responsive breakpoint at 1024px (show/hide nav-links, hamburger)
- `html.dark` selectors for all dark mode states
- Sun/moon icon visibility: `.icon-moon` default visible; `.icon-sun` hidden until `html.dark`
- `.menu-open` class swaps hamburger bars → X SVG

**`<script>`:**
- Theme toggle: `classList.toggle('dark')` on `<html>`, saves to `localStorage`
- Hamburger: `setMenuOpen(bool)` — sets `hidden` attr, toggles `.menu-open`, locks body scroll
- Click outside: document click listener checks if target outside menu + hamburger
- Escape key: closes menu

---

## Updated: `src/layouts/BaseLayout.astro`

1. Import: `import Navbar from '../components/Navbar.astro'`
2. Anti-FOUT inline script — **first element in `<head>`**, before any stylesheet:
   ```js
   const t = localStorage.getItem('theme') ||
     (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
   document.documentElement.classList.toggle('dark', t === 'dark');
   ```
3. `<Navbar />` rendered as first child of `<body>`

---

## Design tokens used

| Token | Value |
|---|---|
| Accent (active link, logo) | `#FF6B00` |
| Body text | `#4d4d4d` |
| Ink | `#171717` |
| Hairline | `#ebebeb` |
| Canvas | `#ffffff` |
| Dark bg | `#111111` |
| Dark border | `#2a2a2a` |
| Dark text | `#aaaaaa` |

---

## Verification checklist

```
npm run dev
```

- [ ] Desktop ≥1024px: all 9 links visible, no hamburger, active link on `/` = saffron
- [ ] `/jobs?type=government` highlights "Govt Jobs", not "Jobs"
- [ ] Mobile <1024px: hamburger visible, links hidden by default
- [ ] Tap hamburger → menu opens with Main + More sections
- [ ] Tap outside or Escape → menu closes
- [ ] Theme toggle → dark mode instant; refresh → persists
- [ ] view-source: anti-FOUT `<script>` before any `<link>`/`<style>` in `<head>`
- [ ] Hard refresh in dark mode → no white flash (no FOUT)
