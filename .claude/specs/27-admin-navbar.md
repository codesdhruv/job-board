Create admin top navbar in src/layouts/AdminLayout.astro
Plain CSS only inside a <style> block — no Tailwind, no framework.
Read @.claude/skills/frontend-design/SKILL.md before writing any code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Desktop (> 768px):
  ┌─────────────────────────────────────────────────────┐
  │ 🔷 Admin Panel  │ Dashboard  All Jobs  Add Job  │ 🌙 Logout │
  └─────────────────────────────────────────────────────┘
  [ page content below — full width ]

Mobile (< 768px):
  ┌─────────────────────────────────┐
  │ 🔷 Admin Panel     🌙  ☰       │
  └─────────────────────────────────┘
  [ hamburger opens dropdown below navbar ]
  [ page content below ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CSS VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define on :root inside AdminLayout <style> block:

  --anav-height: 56px;
  --anav-bg: #1a1d23;
  --anav-border-color: #2d3748;
  --anav-text: #a0aec0;
  --anav-text-active: #ffffff;
  --anav-accent: #FF6B00;
  --anav-hover-bg: #2d3748;
  --anav-active-bg: rgba(255, 107, 0, 0.12);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAVBAR CONTENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Left:
  Logo text "Admin Panel" → links to /admin/dashboard
  font-weight: 600, color: white, no underline

Center (desktop only):
  Dashboard        → /admin/dashboard
  All Jobs         → /admin/jobs
  Add New Job      → /admin/jobs/new
  View Site        → / (target="_blank", rel="noopener")

Right:
  🌙 Theme toggle button (inline SVG sun/moon)
  Logout (POST form button, red-tinted)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAV LINK STYLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Default .anav-link:
  color: var(--anav-text)
  padding: 8px 14px
  border-radius: 6px
  font-size: 14px
  text-decoration: none
  transition: background 0.15s, color 0.15s

Hover:
  background: var(--anav-hover-bg)
  color: var(--anav-text-active)

Active (.anav-link.active):
  background: var(--anav-active-bg)
  color: var(--anav-accent)
  font-weight: 500
  border-bottom: 2px solid var(--anav-accent)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVE LINK LOGIC (server-side)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In AdminLayout.astro frontmatter:

  const path = Astro.url.pathname;
  const isActive = (href: string) =>
    href === '/admin/dashboard'
      ? path === '/admin/dashboard'
      : path.startsWith(href);

Apply to each link:
  <a href="/admin/jobs"
     class={`anav-link ${isActive('/admin/jobs') ? 'active' : ''}`}>
    All Jobs
  </a>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOGOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create src/pages/admin/logout.astro (if not already created):
  POST handler only — on GET return 405
  Delete admin_session cookie
  Redirect to /admin/login

Logout button in navbar:
  <form method="POST" action="/admin/logout">
    <button type="submit" class="anav-logout">Logout</button>
  </form>

.anav-logout styles:
  background: none
  border: none
  color: #fc8181
  font-size: 14px
  padding: 8px 14px
  border-radius: 6px
  cursor: pointer

.anav-logout:hover:
  background: rgba(252, 129, 129, 0.08)
  color: #feb2b2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THEME TOGGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Same localStorage key "theme" as public navbar
- Toggle adds/removes class="dark" on <html>
- Button shows moon SVG in light mode, sun SVG in dark mode
- Inline SVGs only — no icon library

Button style .anav-theme-btn:
  background: none
  border: none
  color: var(--anav-text)
  cursor: pointer
  padding: 8px
  border-radius: 6px
  display: flex
  align-items: center

.anav-theme-btn:hover:
  background: var(--anav-hover-bg)
  color: var(--anav-text-active)

JS (inside <script> tag in AdminLayout.astro):
  const btn = document.getElementById('anav-theme-btn');
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    // swap SVG visibility
    document.getElementById('icon-moon').style.display = isDark ? 'none' : 'block';
    document.getElementById('icon-sun').style.display = isDark ? 'block' : 'none';
  });
  // set initial icon state on load
  const saved = localStorage.getItem('theme') || 'light';
  document.getElementById('icon-moon').style.display = saved === 'dark' ? 'none' : 'block';
  document.getElementById('icon-sun').style.display = saved === 'dark' ? 'block' : 'none';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOBILE HAMBURGER MENU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hamburger button (.anav-hamburger):
  Only visible below 768px (display:none on desktop)
  Inline SVG — 3 lines icon
  background: none, border: none, color: white, cursor: pointer

Mobile dropdown (.anav-mobile-menu):
  position: fixed
  top: var(--anav-height)
  left: 0, right: 0
  background: var(--anav-bg)
  border-bottom: 1px solid var(--anav-border-color)
  padding: 8px 0
  display: none  ← hidden by default
  z-index: 39

  When open (.anav-mobile-menu.open):
    display: block

Mobile menu links:
  Same links as desktop center nav
  display: block
  padding: 12px 20px
  font-size: 15px
  border-left: 3px solid transparent

  Active mobile link:
    border-left-color: var(--anav-accent)
    color: var(--anav-accent)
    background: var(--anav-active-bg)

Mobile logout:
  display: block in mobile menu
  padding: 12px 20px
  border-top: 1px solid var(--anav-border-color)
  margin-top: 4px

JS for hamburger (add to existing <script>):
  const hamburger = document.getElementById('anav-hamburger');
  const mobileMenu = document.getElementById('anav-mobile-menu');

  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') mobileMenu.classList.remove('open');
  });

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDIA QUERIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@media (max-width: 768px):
  .anav-links       { display: none }      /* hide desktop center links */
  .anav-hamburger   { display: flex }      /* show hamburger */
  .anav-logout-desktop { display: none }   /* hide desktop logout */

@media (min-width: 769px):
  .anav-hamburger   { display: none }      /* hide hamburger */
  .anav-mobile-menu { display: none !important } /* never show on desktop */

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE CONTENT AREA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

.admin-content:
  padding-top: var(--anav-height)
  min-height: 100vh
  background: #0f1117   /* slightly darker than navbar */

<slot /> renders inside .admin-content

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES TO CREATE / UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update:
  src/layouts/AdminLayout.astro
    → full navbar HTML + <style> block + <script> block
    → remove any existing sidebar markup

Create (if not exists):
  src/pages/admin/logout.astro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run `wrangler dev`, log in, then confirm and paste results for:

1. Desktop > 768px:
   - Navbar fixed at top, all links visible
   - Active link highlighted:
       visit /admin/dashboard → Dashboard link active
       visit /admin/jobs → All Jobs link active
       visit /admin/jobs/new → Add New Job link active
   - View Site opens / in new tab
   - No hamburger visible

2. Mobile < 768px:
   - Only logo + theme toggle + hamburger visible
   - Tap hamburger → dropdown opens with all links
   - Tap outside → dropdown closes
   - Escape key → closes dropdown
   - Active link has left accent border in mobile menu

3. Logout:
   - Click logout → cookie cleared → redirect to /admin/login
   - Visit /admin/dashboard after logout →
     redirected to /admin/login (middleware active)

4. Theme toggle:
   - Click → dark/light switches instantly
   - Refresh → preference persists
   - Same "theme" key shared with public site navbar

Paste the full rendered navbar HTML from view-source
so I can verify link structure, active classes, and
that no sidebar markup remains.