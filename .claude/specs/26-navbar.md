# F-26 — Responsive Navbar

Fully responsive navbar using inline styles + scoped CSS (no Tailwind — project uses inline styles throughout).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Desktop (≥ 1024px):
  [ Logo ]   [ primary links | secondary links ]   [ 🌙 theme toggle ]

Mobile (< 1024px):
  [ Logo ]   [ 🌙 theme toggle ]   [ ☰ hamburger ]
  ↓ open
  Main section:   [ primary links stacked ]
  More section:   [ secondary links stacked ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAV LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Primary (desktop + mobile menu):
  Home         → /                          exact match
  Jobs         → /jobs                      exact match
  Govt Jobs    → /jobs?type=government      pathname + ?type param
  By State     → /states
  About        → /about

Secondary (desktop + mobile menu):
  Private Jobs → /jobs?type=private         pathname + ?type param
  PSU Jobs     → /jobs?type=psu             pathname + ?type param
  Freelance    → /jobs?type=freelance        pathname + ?type param
  Contact      → /contact

Active link detection: server-side in Astro frontmatter via Astro.url.pathname
and Astro.url.searchParams. No client-side active-link logic needed.

Active style:   color #FF6B00 (accent), font-weight 600
Default style:  color #4d4d4d (body text), font-weight 400
Hover style:    color #171717, background #f5f5f5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN TOKENS (from DESIGN.md / CLAUDE.md)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Accent (brand saffron):  #FF6B00
  Ink / primary:           #171717
  Body text:               #4d4d4d
  Muted:                   #888888
  Hairline:                #ebebeb
  Canvas:                  #ffffff
  Canvas-soft:             #fafafa

  Dark mode equivalents (html.dark):
    Background:   #111111
    Border:       #2a2a2a
    Body text:    #aaaaaa
    Canvas hover: #1e1e1e

  Font: Geist, Inter, system-ui, -apple-system, sans-serif

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THEME TOGGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Adds/removes class="dark" on <html> element
- Persists in localStorage key "theme"
- Anti-FOUT: inline <script is:inline> in <head> BEFORE any CSS:
    const t = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', t === 'dark');
- Button: inline SVG moon icon (shown in light mode), sun icon (shown in dark mode)
  Visibility toggled via CSS: html.dark .icon-sun { display: block }
                                         .icon-sun { display: none }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSIVE / MOBILE MENU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Mobile menu: toggle `hidden` attribute via vanilla JS
- Click outside or Escape → close
- Body scroll lock when open: document.body.style.overflow = 'hidden'
- Hamburger button: two SVG icons (bars / X), swap via .menu-open class
- All JS in <script> inside Navbar.astro — no external JS files
- Works without JS: links remain accessible, theme falls back to system preference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPLEMENTATION NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Styling: <style is:global> block in Navbar.astro for media queries,
  dark mode selectors (html.dark ...), and transitions.
  No Tailwind — project uses inline styles / scoped CSS only.
- Dark mode selector pattern: html.dark #nav-root { ... }
- Navbar height: 60px. Sticky top-0, z-index 50.
- Max-width container: 1200px, centered, 24px side padding.
- Desktop divider between primary and secondary links:
  1px solid #ebebeb vertical line, 18px tall.
- Mobile menu sections labelled "Main" and "More" in uppercase 11px muted text.
- No Astro client:* directives — server-rendered only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES CREATED / UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created:
  src/components/Navbar.astro
    → Full navbar with <style is:global>, server-side active links, <script>

Updated:
  src/layouts/BaseLayout.astro
    → import Navbar, render <Navbar /> as first child of <body>
    → anti-FOUT <script is:inline> as first element in <head>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run `npm run dev` then confirm:

1. Desktop ≥ 1024px:
   - All 9 links visible (5 primary | divider | 4 secondary)
   - No hamburger button visible
   - Active link on / shows #FF6B00 + bold
   - Active link on /jobs shows #FF6B00 + bold
   - /jobs?type=government highlights "Govt Jobs" not "Jobs"

2. Mobile < 1024px:
   - Only logo + theme toggle + hamburger visible
   - Tap hamburger → mobile menu appears with "Main" and "More" sections
   - Tap outside menu → closes
   - Press Escape → closes
   - Scroll locked while menu is open

3. Theme toggle:
   - Click → dark mode applies instantly (background, text, borders all change)
   - Refresh → dark mode persists
   - DevTools → Application → localStorage → "theme" = "dark"

4. No FOUT:
   - Hard refresh in dark mode → no white flash before page styles load
   - view-source confirms anti-FOUT <script> is before any <link>/<style>
