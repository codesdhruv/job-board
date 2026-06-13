-- SarkariNaukriBoard — D1 schema
-- Idempotent: safe to re-run. Uses IF NOT EXISTS + INSERT OR IGNORE.

-- 1. job_types -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_types (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

INSERT OR IGNORE INTO job_types (name, slug) VALUES
  ('Government',       'government'),
  ('PSU / Semi-Govt',  'psu'),
  ('Private',          'private'),
  ('Freelance / Gig',  'freelance');

-- 2. states ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS states (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  slug               TEXT UNIQUE NOT NULL,
  is_union_territory INTEGER NOT NULL DEFAULT 0
);

-- 28 states
INSERT OR IGNORE INTO states (name, slug, is_union_territory) VALUES
  ('Andhra Pradesh',     'andhra-pradesh',     0),
  ('Arunachal Pradesh',  'arunachal-pradesh',  0),
  ('Assam',              'assam',              0),
  ('Bihar',              'bihar',              0),
  ('Chhattisgarh',       'chhattisgarh',       0),
  ('Goa',                'goa',                0),
  ('Gujarat',            'gujarat',            0),
  ('Haryana',            'haryana',            0),
  ('Himachal Pradesh',   'himachal-pradesh',   0),
  ('Jharkhand',          'jharkhand',          0),
  ('Karnataka',          'karnataka',          0),
  ('Kerala',             'kerala',             0),
  ('Madhya Pradesh',     'madhya-pradesh',     0),
  ('Maharashtra',        'maharashtra',        0),
  ('Manipur',            'manipur',            0),
  ('Meghalaya',          'meghalaya',          0),
  ('Mizoram',            'mizoram',            0),
  ('Nagaland',           'nagaland',           0),
  ('Odisha',             'odisha',             0),
  ('Punjab',             'punjab',             0),
  ('Rajasthan',          'rajasthan',          0),
  ('Sikkim',             'sikkim',             0),
  ('Tamil Nadu',         'tamil-nadu',         0),
  ('Telangana',          'telangana',          0),
  ('Tripura',            'tripura',            0),
  ('Uttar Pradesh',      'uttar-pradesh',      0),
  ('Uttarakhand',        'uttarakhand',        0),
  ('West Bengal',        'west-bengal',        0);

-- 8 union territories
INSERT OR IGNORE INTO states (name, slug, is_union_territory) VALUES
  ('Andaman and Nicobar Islands',                'andaman-nicobar',    1),
  ('Chandigarh',                                 'chandigarh',         1),
  ('Dadra and Nagar Haveli and Daman and Diu',   'dadra-nagar-haveli', 1),
  ('Delhi',                                      'delhi',              1),
  ('Jammu and Kashmir',                          'jammu-kashmir',      1),
  ('Ladakh',                                     'ladakh',             1),
  ('Lakshadweep',                                'lakshadweep',        1),
  ('Puducherry',                                 'puducherry',         1);

-- "All India" sentinel for central govt jobs (UPSC, SSC, Railways, etc.)
INSERT OR IGNORE INTO states (name, slug, is_union_territory) VALUES
  ('All India', 'all-india', 0);

-- 3. categories ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

INSERT OR IGNORE INTO categories (name, slug) VALUES
  ('Banking',                  'banking'),
  ('Defence',                  'defence'),
  ('Engineering',              'engineering'),
  ('IT / Software',            'it-software'),
  ('Medical / Health',         'medical-health'),
  ('Police / Law',             'police-law'),
  ('Railways',                 'railways'),
  ('Teaching / Education',     'teaching-education'),
  ('Clerical / Administration','clerical-administration'),
  ('Accounts / Finance',       'accounts-finance'),
  ('Agriculture',              'agriculture'),
  ('Research / Science',       'research-science');

-- 4. departments -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  logo_r2_key  TEXT
);

-- 5. admins ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. jobs (core) -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  department_id  INTEGER REFERENCES departments(id),
  job_type_id    INTEGER REFERENCES job_types(id),
  category_id    INTEGER REFERENCES categories(id),
  state_id       INTEGER REFERENCES states(id),
  location       TEXT,
  vacancies      INTEGER,
  qualification  TEXT,
  age_limit      TEXT,
  salary         TEXT,
  last_date      DATE NOT NULL,
  apply_url      TEXT,
  apply_email    TEXT,
  description    TEXT,
  is_published   INTEGER NOT NULL DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME
);

CREATE INDEX IF NOT EXISTS idx_jobs_type       ON jobs(job_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category   ON jobs(category_id);
CREATE INDEX IF NOT EXISTS idx_jobs_state      ON jobs(state_id);
CREATE INDEX IF NOT EXISTS idx_jobs_last_date  ON jobs(last_date);
CREATE INDEX IF NOT EXISTS idx_jobs_published  ON jobs(is_published);
CREATE INDEX IF NOT EXISTS idx_jobs_type_state ON jobs(job_type_id, state_id);
