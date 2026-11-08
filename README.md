# Aasveer Singh | AI/ML Engineer Portfolio

A static, single-page portfolio that presents Aasveer Singh's AI/ML projects, skills, education,
certifications and professional links to recruiters, hiring managers and collaborators.

- **Next.js 16** (App Router, static export) · **React 19** · **TypeScript** (strict) · **Tailwind CSS 4**
- Content lives in versioned JSON files under `content/`, validated with **Zod**.
- A build-time, read-only **SQLite** database (`better-sqlite3`) feeds both the page and three
  static JSON resources. No server runs in production.
- Motion: **Motion** (motion/react) with selected **Motion Primitives** components; hero entrance in CSS.
- Tests: **Vitest** (content, data layer, API, components), **Playwright** + **axe** (end to end).

Release status: not yet deployed. `pnpm release:check` lists what remains; see Production
configuration below.

## Interactive systems

The page includes Behind the System (`#about`), the AI Systems Laboratory (`#ai-lab`), the Skill
Connection Matrix (`#skill-map`), an architecture explorer on each project card, and the NEXUS
Command Centre. Their content lives in `content/about.json`, `content/lab.json`,
`content/architecture.json` and `content/skill-map.json`, and follows the same validation and
database path as the rest of the site (see D26 and D27 in `docs/TECHNICAL_DECISIONS.md`).

## Requirements

- Node.js 24 (`.nvmrc`)
- pnpm 10. Use `npx pnpm@10.34.9 <command>`, or install it once with `npm i -g pnpm@10` (or
  `corepack enable`) and use `pnpm <command>`. The examples below assume `pnpm` is available.

## Install

```bash
pnpm install
pnpm exec playwright install chromium   # browser for the end-to-end tests
```

## Content and database

All visible text, links and certifications come from four files:

| File | Holds |
| --- | --- |
| `content/profile.json` | name, headline, status label, summary, location, education, links |
| `content/skills.json` | the seven skill categories, in resume order |
| `content/projects.json` | the five project entries and their publication state |
| `content/certifications.json` | the twelve certifications (eight prominent) |

Build the database from them (this also runs automatically before `dev` and `build`):

```bash
pnpm db:build     # validates content/*.json, writes data/portfolio.db
```

An invalid file stops the build with the file and field, for example
`DATA_INVALID in content/projects.json: projects.0.publish_status: ...`.

### Publishing a project

A project appears on the site and in `/api/projects.json` only when **all** of these hold:

1. `role_statement` holds owner-approved wording and `role_status` is `"approved"`;
2. `repository_status` is `"verified"` (after opening the repository by hand);
3. `publish_status` is `"published"`.

Anything less fails the build or keeps the entry hidden. Never set these values on someone
else's behalf.

## Develop

```bash
pnpm dev            # http://localhost:3000 (or http://127.0.0.1:3000): development preview
pnpm dev:release    # the same dev server with production data rules
```

`pnpm dev` shows all five project entries from `content/projects.json` under a DEVELOPMENT
PREVIEW banner, so the full design can be reviewed before approvals exist. Unapproved role
statements and unverified repository or demo links are withheld even there. The preview works
only with the development server: a production build refuses to run while `PORTFOLIO_PREVIEW`
is set, and `/api/projects.json` never includes drafts.

Stop the dev server before running `pnpm build` or `pnpm db:build`: on Windows a running
`next dev` keeps `data/portfolio.db` open and the rebuild cannot replace it.

## Build and run the static site

```bash
pnpm build          # db:build -> next build -> verify-static
pnpm start          # serves out/ at http://127.0.0.1:4173 (production rules: no draft projects)
```

`out/` is the complete site: `index.html`, assets and `out/api/*.json`. Any static host can
serve it. Nothing has been deployed.

### Static JSON resources

| Resource | Contents |
| --- | --- |
| `GET /api/profile.json` | profile, education, links and the seven skill groups |
| `GET /api/projects.json` | published projects only, in display order |
| `GET /api/certifications.json` | all twelve certifications with `is_prominent` |

Each uses the envelope `{ "data": ... }`; build errors use
`{ "error": { "code": "DATA_INVALID" | "DATA_MISSING" | "INTERNAL_ERROR", "message": "..." } }`.
`pnpm verify:static` (run by `pnpm build`) checks that the three files exist, validate against
their schemas, are served as `application/json`, and that no draft text, phone number, email
(while withheld), database file, private file or preview marker reaches `out/`.

## Test

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test           # Vitest: content, data layer, API (including out/api, so build first), components
pnpm test:e2e       # Playwright + axe against out/ (run `pnpm build` first)
pnpm test:e2e:preview  # Playwright against the development preview (starts next dev on port 3100)
```

## Production configuration

Two settings must be real before a public release. Both are public by design (they are inlined
into the static site), so neither is a secret. Set them in the hosting provider's environment, or
in a local `.env.local` for a production build, then rebuild. `pnpm release:check` lists either as
a blocker while it is missing.

**`NEXT_PUBLIC_SITE_URL`**: the site's own https address, for example the domain you deploy to.
With it, the build writes the canonical URL, the link preview tags (Open Graph and Twitter, using
`public/social/link-preview.png`), `robots.txt` and `sitemap.xml`. Without it, none of these are
written, so nothing points at localhost, and local development works as before. Localhost and
example or test domains are rejected by the release check.

**`NEXT_PUBLIC_CONTACT_FORM_ENDPOINT`**: where the contact form posts. Any form service that accepts
a JSON POST and answers with a 2xx status works. With Formspree, for example:

1. Create a form at formspree.io and verify the address that should receive messages.
2. Copy the form's endpoint, `https://formspree.io/f/<form-id>`.
3. Set `NEXT_PUBLIC_CONTACT_FORM_ENDPOINT` to it and rebuild.
4. Send one real test message from the live site and confirm it arrives.

The form sends `{ name, email, message, _gotcha }` (`_gotcha` is the spam trap) and shows
"Message sent" only after the service confirms. Without an endpoint, it says it is not accepting
messages and sends nothing.

## Release readiness

```bash
pnpm release:check  # lists every content blocker; exits 1 while any remain
pnpm check:links    # requests every external link; confirm failures by hand
pnpm lighthouse     # three mobile Lighthouse runs on out/; writes lighthouse-reports/summary.json
```

Before a public release, also do a screen-reader pass and a manual smoke test in Firefox,
Safari, iOS Safari and Android Chrome: the automated tests run in Chromium only.

## Project layout

```
content/                 versioned content (the only files to edit for text changes)
db/schema.sql            five tables: profile, skill, project, project_technology, certification
scripts/                 build-db, verify-static, serve-out, check-links, release-check, lighthouse,
                         generate-og-image, generate-icons
src/app/                 layout, page, globals.css, api/*.json/route.ts
src/components/          layout, profile, certifications, projects, contact, ui, motion
src/components/motion-primitives/  vendored Motion Primitives components (official CLI)
src/lib/db/              read-only client and shared queries
src/lib/data/            loadPortfolio(), focus-area selection, preview switch
src/lib/validation/      Zod schemas, including the publication rule
tests/                   content, api, unit, e2e, fixtures (redacted resume text)
docs/                    technical decisions
```

## Privacy

Private source files, `_resume_extract.txt`, `.env*` files (except `.env.example`), databases and their
backups, logs and test reports are git-ignored. The site never shows a phone number. The email
address is not published on the website or in its JSON (`links.email` is null); it appears only in
the downloadable resume. The page shows a background-removed cutout of the owner's photograph; the
original is not in the repository.
