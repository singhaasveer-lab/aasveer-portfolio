-- Aasveer Singh | AI/ML Engineer Portfolio: build-time, read-only database.
-- Built by scripts/build-db.ts from content/*.json. Never written at runtime, never shipped to the browser.
-- Additions to the original data model, such as profile.status_label (D3) and
-- project.repository_status (D2), are explained in docs/TECHNICAL_DECISIONS.md.

PRAGMA foreign_keys = ON;

-- Entity 1: profile (singleton)
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  headline TEXT NOT NULL CHECK (length(trim(headline)) > 0),
  status_label TEXT NOT NULL CHECK (length(trim(status_label)) > 0),
  role TEXT NOT NULL CHECK (length(trim(role)) > 0),
  intro TEXT NOT NULL CHECK (length(trim(intro)) > 0),
  -- Hero focus labels, as a JSON array of strings in display order.
  focus_areas TEXT NOT NULL CHECK (json_valid(focus_areas) AND json_type(focus_areas) = 'array'),
  summary TEXT NOT NULL CHECK (length(trim(summary)) > 0),
  location TEXT NOT NULL,
  education_degree TEXT NOT NULL,
  education_institution TEXT NOT NULL,
  education_period TEXT NOT NULL,
  github_url TEXT NOT NULL CHECK (github_url LIKE 'https://%'),
  linkedin_url TEXT NOT NULL CHECK (linkedin_url LIKE 'https://%'),
  email TEXT NULL,
  resume_href TEXT NULL
);

-- Entity 2: skill
CREATE TABLE skill (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN (
    'Languages',
    'AI / ML',
    'Generative AI & NLP',
    'AI Models & Platforms',
    'Backend & APIs',
    'Data & Databases',
    'Frontend',
    'Tools & Concepts'
  )),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  display_order INTEGER NOT NULL UNIQUE,
  UNIQUE (category, name)
);

CREATE INDEX idx_skill_category_order ON skill (category, display_order);

-- Entity 3: project
CREATE TABLE project (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  display_name TEXT NOT NULL,
  resume_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (length(trim(category)) > 0),
  period TEXT NULL,
  problem_statement TEXT NOT NULL,
  description TEXT NOT NULL,
  role_statement TEXT NULL,
  role_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (role_status IN ('pending', 'approved')),
  publish_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (publish_status IN ('draft', 'published')),
  repository_url TEXT NOT NULL CHECK (repository_url LIKE 'https://%'),
  repository_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (repository_status IN ('unverified', 'verified')),
  demo_url TEXT NULL CHECK (demo_url IS NULL OR demo_url LIKE 'https://%'),
  display_order INTEGER NOT NULL UNIQUE,
  -- Optional walkthrough (D31): a local file and its poster, set together or not at all.
  walkthrough_src TEXT NULL,
  walkthrough_poster TEXT NULL,
  walkthrough_description TEXT NULL,
  CHECK (
    (walkthrough_src IS NULL AND walkthrough_poster IS NULL AND walkthrough_description IS NULL)
    OR (walkthrough_src IS NOT NULL AND walkthrough_poster IS NOT NULL AND walkthrough_description IS NOT NULL)
  ),
  -- Publish rule (D24): a published row needs a verified repository. Contribution wording is
  -- shown only when approved; the CHECK below keeps pending rows free of wording.
  CHECK (publish_status = 'draft' OR repository_status = 'verified'),
  -- An approved status must carry wording; pending rows carry none.
  CHECK (role_status = 'pending' OR (role_statement IS NOT NULL AND length(trim(role_statement)) > 0)),
  CHECK (role_status = 'approved' OR role_statement IS NULL)
);

-- Entity 4: project_technology (child of project)
CREATE TABLE project_technology (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  UNIQUE (project_id, position),
  UNIQUE (project_id, name)
);

-- Entity 4b: project_highlight (child of project). Owner-supplied results; often empty.
CREATE TABLE project_highlight (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  value TEXT NOT NULL CHECK (length(trim(value)) > 0),
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  UNIQUE (project_id, position)
);

-- Entity 5: certification
CREATE TABLE certification (
  completed_on TEXT,
  credential_url TEXT,
  certificate_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'standard' CHECK (visibility IN ('standard', 'featured', 'hidden')),
  id INTEGER PRIMARY KEY,
  issuer TEXT NOT NULL CHECK (length(trim(issuer)) > 0),
  course_name TEXT NOT NULL CHECK (length(trim(course_name)) > 0),
  is_prominent INTEGER NOT NULL DEFAULT 0 CHECK (is_prominent IN (0, 1)),
  display_order INTEGER NOT NULL UNIQUE,
  UNIQUE (issuer, course_name)
);

-- Build information (not portfolio content): fingerprints of db/schema.sql and content/*.json
-- recorded by the builder. src/lib/db/client.ts compares them with the files on disk and
-- refuses (or, in development, rebuilds) a database built from older sources.
-- Laboratory, architecture, skill-map and About content: one validated JSON document each. They are read
-- whole by the page, so normalising their nested stages and diagrams would add nothing.
CREATE TABLE explorer_document (
  key TEXT PRIMARY KEY CHECK (key IN ('lab', 'architecture', 'skill_map', 'about', 'evidence', 'capabilities', 'casebook')),
  document TEXT NOT NULL CHECK (json_valid(document))
);

CREATE TABLE build_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
