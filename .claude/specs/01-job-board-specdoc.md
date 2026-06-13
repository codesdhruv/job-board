# Job Board Platform — Technical Specification

**Project name:** SarkariNaukriBoard (working title)
**Version:** 1.1
**Date:** June 2026
**Author:** Dhruv
**Deployment target:** Cloudflare Workers + Pages

---

## 1. Overview

A dynamic job listing platform for Indian job seekers, covering Government, PSU/Semi-Govt, Private, and Freelance/Gig sectors. The platform has two surfaces:

- **Public job board** — browse, search, and filter jobs; click external apply link
- **Admin panel** — single admin login; post, edit, delete jobs; manage categories

---

## 2. Competitor Analysis

### SarkariResult.com

**What they do well:**
- Extremely high-traffic — trusted by millions for govt job updates, admit cards, results, and answer keys
- Covers the full recruitment lifecycle: online form → admit card → result → merit list
- Strong URL structure (state + org based) helps SEO
- Also covers non-job content: results, admit cards, syllabus, UP Scholarship — driving repeat visits

**Gaps / weaknesses:**
- Outdated UI — dense link-dump layout, no filtering, no search
- No state-wise filter — users must browse category pages manually
- No structured data / JSON-LD — missing Google Jobs rich results
- No job detail pages with canonical SEO — most are just blog-style posts
- Mobile experience is poor

**Takeaway for our platform:**
- Our state filter, clean card UI, and JSON-LD structured data are direct differentiators
- They own the "results and admit card" niche — we focus purely on active job listings (our moat is freshness + UX + SEO structure)

---

### Talentd.in

**What they do well:**
- Modern, clean Next.js UI — good mobile experience
- Targets freshers and private sector well
- Has value-added tools: resume review, cover letter builder, ATS hack, DSA practice, career roadmaps
- Free job posting for employers
- WhatsApp community + social presence for distribution
- Job Tracker feature (kanban-style application tracking)

**Gaps / weaknesses:**
- Almost entirely private sector focused — zero Sarkari/PSU coverage
- No state-level filtering
- No JSON-LD `JobPosting` schema — not in Google Jobs
- No results/admit card coverage (different audience)

**Takeaway for our platform:**
- Talentd owns freshers + private sector; we own govt + PSU — no direct conflict, different user intent
- Their tool ecosystem (resume, ATS) is v2+ territory for us — note for future roadmap
- We should match their UI quality level — card-based, clean, mobile-first

---

### Our differentiation

| Feature | SarkariResult | Talentd | Our platform |
|---|---|---|---|
| Govt / Sarkari jobs | Yes (link dump) | No | Yes (structured, filterable) |
| PSU / Semi-Govt | Partial | No | Yes |
| Private / Freelance | No | Yes | Yes |
| State filter | No | No | **Yes — first-class** |
| Google Jobs (JSON-LD) | No | No | **Yes** |
| Clean card UI | No | Yes | Yes |
| Admit cards / Results | Yes | No | No (v1 out of scope) |
| Mobile friendly | Poor | Yes | Yes |
| Search | No | Yes | Yes |

---

## 3. Goals

- High SEO — every job page server-rendered with full meta tags and `JobPosting` JSON-LD (eligible for Google Jobs rich results)
- Dynamic listings — jobs added/removed without rebuild
- Deployable entirely on Cloudflare free/paid tier (Workers, D1, KV, R2)
- Simple admin — single login, no multi-tenant complexity in v1
- India-first — categories, departments, and job types relevant to Indian public sector
- **State filter for govt jobs** — first-class state-wise browsing, a gap neither SarkariResult nor Talentd fills

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Astro 4.x (SSR mode) | Server-side rendering, routing, page generation |
| Runtime | Cloudflare Workers | Executes Astro SSR on the edge |
| Database | Cloudflare D1 (SQLite) | Jobs, categories, departments, admins |
| Cache | Cloudflare KV | Cache listing queries, filter counts |
| Assets | Cloudflare R2 | Department logos, uploaded images |
| Deploy | Wrangler CLI | Local deploy and CI/CD push |
| Adapter | `@astrojs/cloudflare` | Bridges Astro SSR to Workers runtime |

---

## 4. Project Structure

```
/
├── src/
│   ├── pages/
│   │   ├── index.astro               # Homepage — latest jobs, category filter
│   │   ├── jobs/
│   │   │   ├── index.astro           # All jobs listing with filters
│   │   │   └── [slug].astro          # Individual job detail page (SSR)
│   │   ├── category/
│   │   │   └── [slug].astro          # Jobs filtered by category
│   │   ├── sitemap.xml.ts            # Dynamic sitemap generator
│   │   ├── rss.xml.ts                # RSS feed
│   │   └── admin/
│   │       ├── login.astro           # Admin login page
│   │       ├── dashboard.astro       # Admin dashboard
│   │       └── jobs/
│   │           ├── index.astro       # Manage all jobs
│   │           ├── new.astro         # Post new job form
│   │           └── [id]/
│   │               └── edit.astro    # Edit existing job
│   ├── components/
│   │   ├── JobCard.astro             # Job listing card (public)
│   │   ├── JobFilters.astro          # Category/type/state filters
│   │   ├── Pagination.astro          # Page navigation
│   │   ├── AdminJobRow.astro         # Admin job table row
│   │   └── JsonLd.astro             # JobPosting JSON-LD injector
│   ├── layouts/
│   │   ├── BaseLayout.astro          # Public layout (nav, footer, head)
│   │   └── AdminLayout.astro         # Admin layout (sidebar, auth guard)
│   ├── lib/
│   │   ├── db.ts                     # D1 query helpers
│   │   ├── auth.ts                   # Cookie session auth
│   │   ├── kv.ts                     # KV cache read/write helpers
│   │   └── seo.ts                    # Meta tag and JSON-LD builders
│   └── middleware/
│       └── index.ts                  # Auth check on /admin/* routes
├── public/
│   └── robots.txt
├── wrangler.toml                     # Cloudflare config (D1, KV, R2 bindings)
├── astro.config.mjs
└── package.json
```

---

## 5. Database Schema (D1 / SQLite)

### 5.1 `job_types`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT | Government, PSU/Semi-Govt, Private, Freelance/Gig |
| `slug` | TEXT UNIQUE | `government`, `psu`, `private`, `freelance` |

**Seed data:**

```sql
INSERT INTO job_types (name, slug) VALUES
  ('Government', 'government'),
  ('PSU / Semi-Govt', 'psu'),
  ('Private', 'private'),
  ('Freelance / Gig', 'freelance');
```

### 5.2 `states` (new — for state filter)

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT | e.g. Uttar Pradesh, Delhi, Maharashtra |
| `slug` | TEXT UNIQUE | `uttar-pradesh`, `delhi`, `maharashtra` |
| `is_union_territory` | INTEGER DEFAULT 0 | 1 for UTs like Delhi, Chandigarh |

**Seed data (all 28 states + 8 UTs):**

```sql
INSERT INTO states (name, slug, is_union_territory) VALUES
  ('Andhra Pradesh', 'andhra-pradesh', 0),
  ('Arunachal Pradesh', 'arunachal-pradesh', 0),
  ('Assam', 'assam', 0),
  ('Bihar', 'bihar', 0),
  ('Chhattisgarh', 'chhattisgarh', 0),
  ('Goa', 'goa', 0),
  ('Gujarat', 'gujarat', 0),
  ('Haryana', 'haryana', 0),
  ('Himachal Pradesh', 'himachal-pradesh', 0),
  ('Jharkhand', 'jharkhand', 0),
  ('Karnataka', 'karnataka', 0),
  ('Kerala', 'kerala', 0),
  ('Madhya Pradesh', 'madhya-pradesh', 0),
  ('Maharashtra', 'maharashtra', 0),
  ('Manipur', 'manipur', 0),
  ('Meghalaya', 'meghalaya', 0),
  ('Mizoram', 'mizoram', 0),
  ('Nagaland', 'nagaland', 0),
  ('Odisha', 'odisha', 0),
  ('Punjab', 'punjab', 0),
  ('Rajasthan', 'rajasthan', 0),
  ('Sikkim', 'sikkim', 0),
  ('Tamil Nadu', 'tamil-nadu', 0),
  ('Telangana', 'telangana', 0),
  ('Tripura', 'tripura', 0),
  ('Uttar Pradesh', 'uttar-pradesh', 0),
  ('Uttarakhand', 'uttarakhand', 0),
  ('West Bengal', 'west-bengal', 0),
  -- Union Territories
  ('Andaman and Nicobar Islands', 'andaman-nicobar', 1),
  ('Chandigarh', 'chandigarh', 1),
  ('Dadra and Nagar Haveli and Daman and Diu', 'dadra-nagar-haveli', 1),
  ('Delhi', 'delhi', 1),
  ('Jammu and Kashmir', 'jammu-kashmir', 1),
  ('Ladakh', 'ladakh', 1),
  ('Lakshadweep', 'lakshadweep', 1),
  ('Puducherry', 'puducherry', 1);
```

Also add a special entry for national/central govt jobs:

```sql
INSERT INTO states (name, slug, is_union_territory) VALUES ('All India', 'all-india', 0);
```

### 5.4 `categories`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT | e.g. Engineering, Teaching, Banking, IT |
| `slug` | TEXT UNIQUE | |

### 5.5 `departments`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT | e.g. UPSC, SSC, DRDO, Infosys |
| `logo_r2_key` | TEXT NULL | R2 object key for logo image |

### 5.6 `jobs` (core table)

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `slug` | TEXT UNIQUE NOT NULL | URL-safe, used in `/jobs/[slug]` |
| `title` | TEXT NOT NULL | Job title |
| `department_id` | INTEGER FK → departments | |
| `job_type_id` | INTEGER FK → job_types | |
| `category_id` | INTEGER FK → categories | |
| `state_id` | INTEGER FK → states | **Required for govt/PSU jobs; optional for private/freelance** |
| `location` | TEXT | City / district (freetext within state) |
| `vacancies` | INTEGER NULL | Number of posts |
| `qualification` | TEXT NULL | Required qualification |
| `age_limit` | TEXT NULL | e.g. "18–30 years" |
| `salary` | TEXT NULL | e.g. "₹35,400 – ₹1,12,400" |
| `last_date` | DATE NOT NULL | Application deadline |
| `apply_url` | TEXT NULL | External apply link (URL) |
| `apply_email` | TEXT NULL | Apply via email (if no URL) |
| `description` | TEXT | Full job description (HTML or Markdown) |
| `is_published` | INTEGER DEFAULT 1 | 1 = live, 0 = draft |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | Updated on edit |

**Full SQL:**

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  job_type_id   INTEGER REFERENCES job_types(id),
  category_id   INTEGER REFERENCES categories(id),
  state_id      INTEGER REFERENCES states(id),
  location      TEXT,
  vacancies     INTEGER,
  qualification TEXT,
  age_limit     TEXT,
  salary        TEXT,
  last_date     DATE NOT NULL,
  apply_url     TEXT,
  apply_email   TEXT,
  description   TEXT,
  is_published  INTEGER DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME
);

CREATE INDEX IF NOT EXISTS idx_jobs_type     ON jobs(job_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category_id);
CREATE INDEX IF NOT EXISTS idx_jobs_state    ON jobs(state_id);
CREATE INDEX IF NOT EXISTS idx_jobs_last_date ON jobs(last_date);
CREATE INDEX IF NOT EXISTS idx_jobs_published ON jobs(is_published);

-- Composite index for the most common govt filter combo
CREATE INDEX IF NOT EXISTS idx_jobs_type_state ON jobs(job_type_id, state_id);
```

### 5.7 `admins`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `username` | TEXT UNIQUE | |
| `password_hash` | TEXT | bcrypt hash |
| `created_at` | DATETIME | |

---

## 6. Pages and Routes

### 6.1 Public pages

| Route | Description | SSR |
|---|---|---|
| `/` | Homepage — latest 10 jobs, category pills, hero search | Yes |
| `/jobs` | All jobs listing — paginated, filterable | Yes |
| `/jobs/[slug]` | Job detail — full info, apply button, JSON-LD | Yes |
| `/category/[slug]` | Jobs filtered by category | Yes |
| `/state/[slug]` | **Jobs filtered by state — all types** | Yes |
| `/state/[slug]/government` | **Govt jobs in a specific state** | Yes |
| `/state/[slug]/psu` | **PSU jobs in a specific state** | Yes |
| `/states` | **Browse all states — index page** | Yes |
| `/sitemap.xml` | Dynamic sitemap of all published jobs | Yes |
| `/rss.xml` | RSS feed | Yes |

### 6.2 Admin pages (all behind `/admin/*` auth guard)

| Route | Description |
|---|---|
| `/admin/login` | Login form (username + password) |
| `/admin/dashboard` | Counts: total jobs, expiring soon, drafts |
| `/admin/jobs` | Table of all jobs with edit/delete actions |
| `/admin/jobs/new` | Post new job form |
| `/admin/jobs/[id]/edit` | Edit existing job |

---

## 7. SEO Implementation

### 7.1 Per-page meta tags

Every job detail page (`/jobs/[slug]`) server-renders:

```html
<title>{title} — {department} | SarkariNaukriBoard</title>
<meta name="description" content="Apply for {title} at {department}. {vacancies} vacancies. Last date: {last_date}.">
<meta property="og:title" content="{title}">
<meta property="og:description" content="...">
<link rel="canonical" href="https://yourdomain.com/jobs/{slug}">
```

### 7.2 JobPosting JSON-LD (Google Jobs eligible)

```json
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "Junior Engineer",
  "description": "...",
  "datePosted": "2026-06-01",
  "validThrough": "2026-07-15T00:00:00",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "DRDO",
    "sameAs": "https://drdo.gov.in"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "New Delhi",
      "addressCountry": "IN"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "value": { "@type": "QuantitativeValue", "value": 35400, "unitText": "MONTH" }
  }
}
```

### 7.3 Sitemap

`/sitemap.xml` is generated dynamically from D1 — includes:
- All `is_published = 1` job detail pages with `<lastmod>` = `updated_at`
- All `/state/[slug]` pages
- All `/state/[slug]/government` and `/state/[slug]/psu` pages (only states that have jobs)
- All `/category/[slug]` pages

---

## 8. Authentication (Admin)

- Single admin account stored in `admins` table (password hashed with bcrypt)
- Login sets an `httpOnly`, `Secure`, `SameSite=Strict` cookie containing a signed session token
- Astro middleware (`src/middleware/index.ts`) checks cookie on every `/admin/*` request; redirects to `/admin/login` if missing or invalid
- No JWT, no OAuth, no Identity — intentionally minimal for v1
- Session expiry: 8 hours

---

## 9. Caching Strategy (KV)

| KV key | Value | TTL |
|---|---|---|
| `jobs:listing:page:{n}` | JSON array of 20 jobs | 5 min |
| `jobs:listing:{type}:page:{n}` | Filtered by job type | 5 min |
| `jobs:listing:state:{slug}:page:{n}` | All jobs in a state | 5 min |
| `jobs:listing:state:{slug}:{type}:page:{n}` | State + type combo (e.g. UP govt jobs) | 5 min |
| `jobs:count:total` | Integer | 10 min |
| `jobs:count:{type}` | Integer per job type | 10 min |
| `jobs:count:state:{slug}` | Integer per state | 10 min |

Cache is invalidated (key deleted) on any admin create/edit/delete operation.

---

## 10. Admin Panel — Features

### Post new job

Form fields:
- Title (required)
- Department (dropdown from `departments`)
- Job type (Government / PSU / Private / Freelance)
- Category (dropdown)
- Location (text)
- Vacancies (number)
- Qualification (text)
- Age limit (text)
- Salary (text)
- Last date (date picker) — required
- Apply URL or Apply email (one required)
- Description (textarea — accepts markdown or plain text)
- Published (toggle — draft vs live)

### Edit job

Same form, pre-populated. `updated_at` refreshed on save.

### Delete job

Soft or hard delete — either set `is_published = 0` (hide) or `DELETE FROM jobs`. KV cache cleared after.

### Dashboard counts

- Total published jobs
- Jobs expiring in next 7 days
- Draft jobs

---

## 12. Filters (Public)

Available on `/jobs` and all listing pages:

| Filter | Source | UI | Notes |
|---|---|---|---|
| Job type | `job_types` table | Pills / tabs | Always visible |
| **State** | `states` table | Dropdown (grouped: States / UTs) | **Shown for all job types; required field for govt/PSU** |
| Category | `categories` table | Dropdown | |
| Search | `jobs.title` LIKE | Text input | |

Filters are applied as query params: `?type=government&state=uttar-pradesh&category=engineering`

### State filter — special behaviour for govt jobs

When `type=government` or `type=psu` is active:

- State dropdown is **promoted** — shown first, above category, with a label "Select your state"
- "All India" option at the top of the dropdown (for central govt jobs like UPSC, SSC, Railways)
- States and Union Territories shown in two grouped sections in the dropdown
- State slug is also part of the SEO URL: `/state/uttar-pradesh/government`

### State filter — admin form

When posting a job with type = Government or PSU:
- State is a **required** field (validated before save)
- Shown as a searchable select with all 36 states/UTs + "All India"
- For Private/Freelance: state is optional freetext location field only

---

## 12. Cloudflare Config (`wrangler.toml`)

```toml
name = "job-board"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "job-board-db"
database_id = "YOUR_D1_ID"

[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID"

[[r2_buckets]]
binding = "R2"
bucket_name = "job-board-assets"
```

---

## 13. Environment Variables

| Variable | Purpose |
|---|---|
| `ADMIN_SECRET` | Used to sign/verify session cookie |
| `SITE_URL` | Base URL for canonical tags and sitemap |

Set via Cloudflare dashboard → Workers → Settings → Variables.

---

## 14. Deployment

```bash
# Install deps
npm install

# Local dev (with D1 local emulation)
npx wrangler dev

# Run D1 migrations
npx wrangler d1 execute job-board-db --file=./schema.sql

# Deploy to Cloudflare
npx wrangler deploy
```

---

## 15. Phases / Build Order

### Phase 1 — Foundation
- D1 schema creation and seed data
- `wrangler.toml` setup
- Astro project init with `@astrojs/cloudflare` adapter
- `db.ts` query helpers
- BaseLayout and AdminLayout

### Phase 2 — Public pages
- Homepage
- `/jobs` listing with pagination and all filters (type, state, category, search)
- `/jobs/[slug]` detail page with JSON-LD
- `/category/[slug]`
- `/states` — state index page
- `/state/[slug]` — all jobs in a state
- `/state/[slug]/government` and `/state/[slug]/psu` — govt/PSU jobs per state

### Phase 3 — Admin panel
- Login + cookie session auth
- Middleware auth guard
- Dashboard, job list, new/edit/delete forms

### Phase 4 — SEO and performance
- Sitemap and RSS
- KV caching layer
- robots.txt
- Open Graph meta

### Phase 5 — Polish
- R2 logo upload on department
- Mobile responsive design
- Expiry alerts in admin (jobs closing in 7 days)
- Pagination on admin job list

---

## 16. Out of Scope (v1)

- User registration or candidate accounts
- In-platform resume upload or application tracking
- Email notifications
- Multi-admin or role-based access
- Paid job listings or monetisation
- Social login (Google, LinkedIn)

---

## 17. Key Decisions Log

| Decision | Rationale |
|---|---|
| Astro SSR over static | Dynamic jobs without rebuild; full SSR SEO |
| D1 (SQLite) over Postgres | Native Cloudflare, zero external DB cost |
| KV cache over edge cache | Fine-grained invalidation on admin edits |
| Single admin login | No Identity overhead for v1 solo use |
| External apply link only | Avoids resume storage compliance complexity |
| No client-side JS framework | Astro islands only if needed; keeps bundle tiny |