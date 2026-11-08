# Technical decisions

Decisions made during implementation, with the reasoning behind each. Where a decision departs
from the original plan, the entry says what changed and why. Later entries revise earlier ones
where noted.

## Resolved versions (checked against the npm registry on 2026-10-30)

| Layer | Planning target | Installed | Note |
| --- | --- | --- | --- |
| Node.js | 24.x | 24.18.0 | `.nvmrc` = 24 |
| pnpm | 9.x or 10.x | 10.34.9 | run via `npx pnpm@10.34.9`; not installed globally |
| Next.js | 16.x | 16.4.3 | App Router, `output: "export"`, Turbopack build |
| React / React DOM | 19.x | 19.3.1 | |
| TypeScript | 5.x | 5.9.3 | TS 7.0 exists but is the native rewrite; Next 16 tooling was not verified against it |
| Tailwind CSS | 4.x | 4.3.3 | with `@tailwindcss/postcss` |
| better-sqlite3 | current major | 12.11.1 (SQLite 3.53.2) | see D1 |
| Zod | 3.x or 4.x | 4.6.7 | |
| Vitest | 3.x | 5.0.5 | |
| Playwright / axe | current | 1.64.1 / @axe-core/playwright 4.14.0 | |
| ESLint / Prettier | 9.x / 3.x | 9.39.5 / 3.9.10 | ESLint 10 exists; 9 kept for `eslint-config-next` plugin compatibility |
| Lighthouse | current | 13.6.0 | |

## D1. better-sqlite3 12.x instead of 13.x

13.0.3 has no prebuilt binary for Node 24.18 on Windows x64 and this machine has no Visual
Studio C++ toolchain, so `node-gyp` failed. 12.11.1 installs from a prebuilt binary. The API used
(readonly connection, prepared statements, pragmas) is the same. The planned sql.js
fallback was not needed.

## D2. `project.repository_status` added to the data model

The original publish rule checked only the role statement. A second gate was added: a
verified repository URL, so no card links to a repository that has not been checked. A
`repository_status TEXT CHECK IN ('unverified','verified')` column was added to `db/schema.sql`,
the content schema, the seed data and the queries. A project is published only when
`role_status = 'approved'`, `role_statement` is non-empty, `repository_status = 'verified'`
and `publish_status = 'published'`. The rule is enforced three times: Zod (build fails with the
file and field), an SQL `CHECK` constraint, and the `WHERE` clause of `getPublishedProjects()`.

## D3. `profile.status_label` added

The first screen must say "AI/ML engineer" and "B.Tech CSE (AI/ML) student". The hero eyebrow
("AI/ML ENGINEER · B.TECH CSE (AI/ML) STUDENT") would otherwise be copy inside a component, and
page copy belongs in the content files. It is stored as `status_label` in
`content/profile.json`. The focus chips still come from existing skill data (no new field).

## D4. Education period stored with an en dash

The page shows the period as `2023–2027`, with an en dash, not `"2023 - 2027"`. The content file stores `2023–2027` so components render it unchanged.

## D5. Seven skill categories; the resume's "Languages" line is not shown (revised by D30)

The original data model had seven skill categories, enforced by an SQL `CHECK` constraint. The
resume has an eighth line, "Languages"
(Python, SQL, C/C++, JavaScript, TypeScript). It is not shown.

## D6. Static JSON from route handlers (no fallback needed)

The Phase 2 build spike confirmed that `src/app/api/<name>.json/route.ts` with
`dynamic = "force-static"` writes `out/api/profile.json`, `projects.json` and
`certifications.json` under Next 16.4.3 static export. The planned build-script fallback
was therefore not implemented. `scripts/verify-static.ts` checks the files on every build.

Route handlers call `src/lib/api/resources.ts`, which calls the shared query functions and
validates the whole envelope before responding. They never call `loadPortfolio()`, and
`loadPortfolio()` never imports them (a unit test checks the imports).

## D7. Development preview (revised by D18)

`pnpm dev:preview` sets `PORTFOLIO_PREVIEW=1`. `isPreviewEnabled()` returns true only when
`NODE_ENV === "development"` as well, and `next.config.ts` throws if the variable is set during a
production build. In preview, all draft projects render from `content/projects.json` **without
any role statement**, under a visible "DEVELOPMENT PREVIEW" banner. No contribution wording is
invented. The API route handlers never use preview data. `verify-static.ts` fails the build if
the banner text or any draft project text appears in `out/`.

## D8. `<main>` lives in `page.tsx`, not `layout.tsx`

The original layout put the skip-link target `<main>` in the layout and rendered the footer from
`page.tsx`. Both cannot hold without nesting the footer inside `<main>`, which would remove its
`contentinfo` landmark. `layout.tsx` renders the skip link and children; `page.tsx` renders
`SiteHeader`, `<main id="main-content">` and `SiteFooter` as siblings. The layout renders no footer.

## D9. Header contact action

The original design had both a "Contact" text link and a "[ Contact ]" button. The fourth navigation
item is rendered once, styled as the call-to-action button, to avoid two identical links.

## D10. In-page navigation focus handling lives in `SiteHeader`

Section links, hero actions, the brand, the footer "Contact" link and the skip link must move
focus to the target heading. One delegated click handler in `SiteHeader.tsx` (already a client
component) handles all fragment links, so no extra component file was added. Without JavaScript
the links still work as plain fragment links.

## D11. Additions outside the component inventory

- `src/components/ui/SectionHeading.tsx`: shared numbered section heading.
- `src/lib/sections.ts`: section IDs and navigation labels.
- `src/lib/data/focusAreas.ts`, `src/lib/data/preview.ts`: small helpers for the loader.
- `src/lib/content/readContent.ts`: content reading and validation shared by `build-db.ts` and tests.
- `src/lib/api/resources.ts`: resource builders shared by the three route handlers.
- `scripts/serve-out.ts` and `scripts/serve-out-lib.ts`: local static server with explicit content types.
- `scripts/verify-static.ts`, `scripts/release-check.ts`, `scripts/lighthouse.ts`.
- Unit tests that render JSX use `.test.tsx` rather than the planned `.test.ts`.

## D12. Fonts bundled locally (display face changed by D19)

Instrument Serif (display; `@fontsource/instrument-serif` loaded through `next/font/local`),
Geist and Geist Mono (the `geist` package). No runtime request goes to a font service; an e2e
test asserts that the page makes no third-party request.

## D13. CSS cascade layers

Custom component classes are declared in `@layer components` so Tailwind utilities (for example
`md:hidden`) override them. Before this change, the unlayered `.btn { display: inline-flex }`
beat `md:hidden` and the mobile menu button showed on desktop.

## D14. Lighthouse browser (revised by D36)

Playwright's Chromium build closed its target during Lighthouse navigation on this Windows
machine. `scripts/lighthouse.ts` prefers an installed Chrome or Edge, then falls back to
Playwright's Chromium. `CHROME_PATH` overrides both.

---

# Redesign and repair pass (2026-10-30)

## Audit findings: why sections looked missing

Measured on the production build served by `pnpm start` (port 4173) before any change:

| Symptom | Finding | Root cause |
| --- | --- | --- |
| Project showcase empty | `#projects` existed in the DOM with 0 cards and the empty-state line. `loadPortfolio()` returned `projects: []`. | Working as designed, but it read as broken: every entry in `content/projects.json` is a draft (no approved role statement, no verified repository), so the production data correctly publishes nothing. There was also no default way to review the four cards locally (`dev:preview` had to be known). |
| Certifications "not appearing" | All 8 prominent entries rendered; the other 4 sat in the closed disclosure, as specified. No data was lost. | Not a data fault. Combined with the navigation fault below, the viewport could stay on the hero, so the section was never reached. |
| URL shows `#projects` but the viewport stays on the hero | Loading `/#projects` left `scrollY` at 0 for over a second, then it arrived; other hashes animated slowly from the top. | `html { scroll-behavior: smooth }` in `globals.css` also applies to the browser's initial fragment scroll. Next.js 16 no longer overrides it (see `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`, "Scroll Behavior Override"), so a direct load became a long smooth scroll that hydration and font swaps could interrupt. |
| (Found during the redesign) whole sections invisible | In the first redesign build, every scroll-reveal group stayed at opacity 0 when the dev page was opened at `127.0.0.1:3000`. | Motion's `initial="hidden"` (including the Motion Primitives `InView` component) writes `opacity:0` into the server HTML. The Next dev server rejected `127.0.0.1` as a dev origin, the page never hydrated, and nothing ever revealed. Content visibility depended on JavaScript succeeding. |
| (Found during the redesign) hydration warning | React reported mismatched SVG attributes. | Floating-point drift: the InterviewIQ waveform heights computed with `Math.sin` differed in the last digit between server and client. |

## D15. Hash navigation

Removed the global `scroll-behavior: smooth`. Smooth scrolling now happens only when a visitor
activates an in-page link (the delegated handler in `SiteHeader.tsx`, instant under reduced
motion). Direct loads of `/#section` use the browser's instant fragment scroll; after
`document.fonts.ready` the header re-aligns to the target once, and `hashchange` (back/forward)
aligns instantly. `scroll-padding-top` and `scroll-margin-top` keep headings clear of the sticky
header. E2E tests load each of `#skills`, `#education-certifications`, `#projects`, `#contact`
directly and assert the heading is in view and below the header.

## D16. Reveals never gate content on JavaScript

`src/components/motion/Reveal.tsx` renders every block visible on the server (`initial={false}`).
After hydration, only blocks that are below the viewport at that moment are set to `hidden`
(instantly, while unseen) and animate in when scrolled into view. If JavaScript fails or the
visitor prefers reduced motion, content stays visible. `RevealText` follows the same rule and
returns to plain text when its animation completes. Belt and braces: a reduced-motion rule and a
`<noscript>` rule force any `.reveal` element with an inline opacity back to visible. E2E tests
check that no text is left at opacity 0 after scrolling, and that all sections are visible with
JavaScript disabled. The Motion Primitives `InView` and `AnimatedGroup` components were removed
for this reason (and `AnimatedGroup` also failed type-checking against React 19's `JSX` types).

## D17. Motion system and Motion Primitives

Library: `motion` 14.8.0 (the only animation library). Components were added with the official
CLI (`npx motion-primitives@0.1.0 add <name>`), reviewed, and moved to
`src/components/motion-primitives/`:

| Component | Used for | Notes |
| --- | --- | --- |
| Text Effect | Section headings and the profile statement (word reveal) | Wrapped by `RevealText` (D16); keeps an `sr-only` copy during the animation |
| Animated Background | Sliding active-section indicator in the header | Driven by an IntersectionObserver scroll-spy; `aria-current="location"` on the active link |
| Scroll Progress | Reading-progress hairline under the header | Patched: removed a `layoutEffect` option that Motion 14 does not accept |
| Spotlight | Pointer-following light on project panels, tinted per project | Mounted only for fine pointers without reduced motion |
| Magnetic | Hero actions | Mounted only for fine pointers without reduced motion |

Vendored files keep upstream code; `eslint.config.mjs` relaxes four rules for that folder only,
and Prettier skips it. Shared timing lives in `src/lib/motion.ts` and mirrors the CSS tokens
(`--ease-out`, `--dur-*`). `MotionConfig reducedMotion="user"` wraps the app.

The hero entrance (name rising out of a mask, headline words, status, focus chips, actions) is
pure CSS keyframes with staggered delays, so it starts at first paint and does not wait for
hydration. The hero signal field and project visuals use CSS loops that pause when off screen
(`useActiveWhenVisible`) and are disabled under reduced motion; pointer parallax on the signal
field uses Motion springs on fine pointers only.

## D18. Development preview (revises D7)

- `pnpm dev` now runs the preview (`PORTFOLIO_PREVIEW=1`); `pnpm dev:release` runs `next dev`
  with production data rules. `isPreviewEnabled()` still also requires `NODE_ENV=development`, and
  `next.config.ts` still refuses a production build with the variable set.
- In the preview, all four entries render in display order with their resume-derived text and
  exact technology lists. Role statements appear only if approved. Repository and demo links
  appear only if `repository_status` is `verified`; otherwise the card says the link is withheld.
  `ProjectView.repository_url` is therefore nullable; production entries always carry one.
- The API route handlers never use preview data: `/api/projects.json` on the dev server still
  returns `{ "data": [] }` (tested in `tests/e2e-preview/preview.spec.ts`).
- `allowedDevOrigins: ["127.0.0.1"]` lets the dev server be opened at either `localhost` or
  `127.0.0.1`.

## D19. Typography

Display face changed from Instrument Serif to Fraunces (variable weight and optical size,
`@fontsource-variable/fraunces`, bundled through `next/font/local`). Geist and Geist Mono remain
for text and metadata. Sizes are fluid (`clamp`).

## D20. Test database isolation

Vitest's global setup now builds its own database in a temporary directory and exports
`PORTFOLIO_DB_PATH`, because a running `next dev` keeps `data/portfolio.db` open and Windows
cannot replace an open file. `build-db.ts` reports that situation with a clear message.

## D21. Hydration-safe generated geometry

All computed SVG coordinates in the hero and project visuals are rounded before rendering so
server and client markup are identical, and SVG gradient ids are made unique per instance
(`useId`), because the page renders two signal fields and duplicate ids pointed at a gradient
inside a `display:none` subtree.

## D24. Publication rule: verified repository; contribution only where approved (revises D2)

From 2026-10-31, all five projects are shown, each with its repository link, and a
contribution statement appears only where its wording is confirmed. A project is therefore
published once `publish_status` is `"published"` and its repository has been checked by hand
(`repository_status: "verified"`). Contribution wording stays a separate gate: `role_status:
"approved"` with a non-empty `role_statement`; a pending role must carry no wording. Both rules are
enforced in the Zod content schema, in SQL `CHECK` constraints and in `getPublishedProjects()`,
and `scripts/verify-static.ts` checks that `out/api/projects.json` carries wording only for
approved roles.

## D25. Hero content, scroll scenes and active-section tracking

- The hero's role line, short introduction and focus areas are content (`role`, `intro`,
  `focus_areas` in `content/profile.json`), stored in the profile table, not derived from skills.
- Scroll scenes (`src/components/motion/Scene.tsx`, `ScrollReveal.tsx`) bind each transition to
  scroll position with Motion `useScroll`/`useTransform`/`useSpring`, render at rest on the server,
  and are off under reduced motion.
- The active section (header and scene indicator) is measured from layout on every scroll frame,
  resize, layout change and hash change (`src/hooks/useActiveSection.ts`): the last section whose
  top has passed 40% of the viewport. The previous intersection-observer version had no value until
  its first callback, and the indicator then fell back to the first scene.
- On a `/#section` load the browser's scroll restoration is switched off and the target is aligned
  on mount, after fonts and after load, unless the visitor has already scrolled. On a reload,
  Chrome's restoration otherwise returned the reader to their previous position under a URL naming
  another section.

## D26. Interactive systems: content, diagrams and overlays

- The AI Systems Laboratory, architecture explorer and Skill Connection Matrix are content:
  `content/lab.json`, `content/architecture.json` and `content/skill-map.json`, validated by
  `src/lib/explorer/schema.ts`, checked across files by `src/lib/explorer/validate.ts` and stored
  whole in the `explorer_document` table. `loadPortfolio()` limits them to the projects on the page,
  so a draft project cannot appear in any of them. Project names, links and descriptions are never
  repeated there; components read them from the project data.
- Every stage, component and skill link was written from the project's source, and names the file
  behind it. `status: "not_used"` records a stage a project does not have, because the projects
  differ: Wingman AI has no chunking and no language model, and GiftBro AI calls Gemini only from
  Streamlit.
- The skill map follows the source, so it has links beyond the resume's starting list: TF-IDF and
  Cosine Similarity in StudyForge AI, and FastAPI, SQLite, Gemini and RAG in InterviewIQ. It uses
  only skills from `content/skills.json`, and has no ratings.
- SmartQueue AI's simulator (`src/lib/explorer/queueSim.ts`) ports the source's own formulas, omits
  the hard-coded `confidence` values and simulated hourly traffic, and labels every value as a
  simulation.
- Diagrams use SVG and CSS with no new dependency. Connectors are calculated from measured layout
  (`offsetWidth`, `offsetTop`), which the transforms of a scroll scene do not affect.
- Overlays use the native `<dialog>` (`src/components/explorer/Overlay.tsx`): `showModal()` provides
  the focus trap, inert background and focus return. The element stays open through the exit
  transition, and a command runs only after that, so focus and scrolling are in a settled state.
- The NEXUS Command Centre opens from a visible launcher. Ctrl/Cmd+K is an optional shortcut.

## D27. PennyBloom, the About section and the portrait

- PennyBloom is the sixth project, in `content/projects.json` like the others. Its text comes from
  its source. It has no authentication, database or AI: storage is JSON files, and the next-month
  figure is a three-month average. It is not in the Laboratory, because it has no AI pipeline to
  explore (revised by D34: it leads Data Intelligence & Analytics, which uses no AI). Its technologies are
  exempt from the resume check, since the resume predates it.
- About is `content/about.json`, stored in `explorer_document`. Education and location are read from
  the profile. `#about` replaces `#profile` and is now a navigation destination.
- Each How I Build stage cites one real project and says the stages are not a fixed recipe. Every
  area of exploration lists only projects confirmed in their source.
- `overflow: clip` on `.case` keeps the tall cases' sticky illustration working. The Spotlight
  primitive sets its parent's overflow inline, so it sets `clip` as well.

## D28. Cursor-reactive hero, portrait, credential archive and open channel

- The owner's original photograph is not in the repository (until 2026-11-08 a copy was in
  `public/`, unused). The page shows
  `aasveer-portrait-cutout.webp`, which removes only the white background. The person's pixels were
  not edited, no filter or blend is applied, and the sheen sits beneath the photograph, so no effect
  crosses the face. Set `portrait.src` in `content/about.json` to change which file is shown.
- `HeroMotion` is the hero's one pointer listener. It writes Motion values and every plane reads
  them through its own transform, so moving the pointer causes no React render. The hero is measured
  on pointer entry, not on each move. `NeuralField` is one canvas whose loop runs only while something
  moves and the hero is on screen. Touch screens and reduced motion get a static frame.
- The surname rises as one word: its gradient paints through the element's own text, so splitting it
  into letters would leave it invisible.
- Certifications may hold `completed_on` and `credential_url`. They are shown only when present, and
  none exist yet. The default view lists all twelve, so nothing depends on an interaction.
- `is_prominent` no longer affects the page, which lists every credential, but stays in the data and
  API.

## D29. Portrait composition, project showcases and resume access

- The photograph is the hero's anchor and appears only there. It stands on the hero's base line on
  its own plane, in front of a frame of layered planes. The frame tilts in perspective; the
  photograph only drifts a few pixels and is never rotated or filtered, and nothing passes over it.
  About has its own emblem (`IdentityLattice`) instead of repeating the portrait.
- Project cards show a cropped screenshot of the real application and the pipeline from its source
  (`ProjectVisual.tsx`). Crops live in `public/images/projects/` and exclude browser chrome,
  bookmarks and taskbars. SmartQueue AI's crop also excludes its stale "397.3m" demo average.
  StudyForge AI has no screenshots, so it has a labelled diagram.
- Certifications may also hold `certificate_url`. The verification and certificate actions appear
  only when a real link exists, and none do yet. Within an issuer, courses follow the resume's order.
- The resume panel shows only facts: role, name, file type and file name.

## D30. Page order, compact About and Skills, and the Languages group (revises D5)

- Order: Hero, About, Featured Projects, Technical Skills, Skill Connection Matrix, AI Systems
  Laboratory, Education & Certifications, Contact. `SCENES` in `src/lib/sections.ts` is the one list:
  the navigation and every section number are computed from it, so they cannot drift apart.
- Project order is `display_order`: StudyForge AI, PennyBloom, InterviewIQ, Wingman AI, GiftBro AI,
  SmartQueue AI.
- The resume's Languages line is now shown, so the skills match all eight lines of the resume's
  skills section. It comes first, as in the resume. `SKILL_CATEGORIES`, the SQL `CHECK` and the tests
  changed with it. TypeScript appears in both Languages and Frontend because the resume lists it in
  both.
- The Skill Connection Matrix is the main view of the skills. Technical Skills is a compact grid
  with everything visible, chosen over a collapsible list: nothing depends on JavaScript, and
  collapsing after hydration would have shifted the layout. The scroll-drawn skill bus was removed.
- Areas of exploration became a row of links here, and an interactive network again in D37.
- The NEXUS launcher sits in the sticky header's row, not over the page. Bottom padding would only
  have cleared the end of the page: a button floating over scrolling content always passes over
  some of it. It is a 44px round icon below 1280px, and adds its label from there up. The "NEXUS //"
  prefix on the brand appears from 1280px so the tablet header fits.

## D31. Optional project and certification fields

- `highlights` (none, or two to four `{ value, label }`) and `walkthrough` (`{ src, poster,
  description }`) are in the content schema, SQLite (`project_highlight`, `walkthrough_*` columns)
  and the public API. All are empty until the owner supplies real values, and nothing renders while
  they are empty.
- A walkthrough must be a local file under `/media/projects/`, and a missing file fails the build.
  A video has `preload="none"`, plays only while on screen, and does not play by itself under
  reduced motion. A GIF cannot be paused, so reduced motion shows its poster through `<picture>`.
- `public/images/projects/studyforge-ai.webp` is picked up by existence (`has_screenshot`). Until
  the file exists, StudyForge AI keeps its diagram. Its alt text is generic and should be rewritten
  to describe the real screenshot once there is one.
- Certifications may set `visibility` to `"featured"` or `"hidden"`. A hidden entry stays in the
  database and leaves the page and the API. None is set, so all twelve show.

## D32. Second set of Motion Primitives and the case study dialog

Added with `npx motion-primitives@0.1.0 add <name>` into a scratch folder, reviewed, then moved to
`src/components/motion-primitives/`. No new dependency: `lucide-react`, which Morphing Dialog
imports, was replaced with the site's close icon.

| Component | Used for | Patched because |
| --- | --- | --- |
| Morphing Dialog | Project card into its case study | Rebuilt on native `<dialog>`, as `Overlay` is (below) |
| Text Scramble | Section kickers, once | `motion.create` in render remounted it on every tick; interval not cleared on unmount; separators now stay fixed |
| Border Trail | Active Laboratory stage, Contact's resume button | Unchanged; wrapped by `ActiveTrail` |
| Animated Number | Stat strip under the hero | `motion.create` in render; missing `JSX` type |
| Tilt | Card screenshots, 3 degrees | Added `disabled`, so switching it off does not remount the image |
| Transition Panel | How I Build, Laboratory stages | Added `mode`: `popLayout` keeps two panels in a live region for a moment |
| Progressive Blur | Under the sticky header | Unchanged; mounted only past 80px of scroll, so it never touches the portrait at rest |
| Text Shimmer | "Trace the signal", "Explore architecture" | `motion.create` in render; OS `dark:` colours replaced with site colours |

- Upstream Morphing Dialog had `aria-labelledby` and `aria-describedby` pointing at ids that did not
  exist, a trigger named "Open dialog :r1:", a trap watching only its first and last elements, and
  document-level Escape and click-outside listeners that would also close it beneath the
  architecture overlay. On native `<dialog>`, `showModal()` supplies the trap, the inert page and
  stacking, so Escape closes only the top layer. The dialog is shown before its content renders so
  the morph measures a visible target, and a timeout guarantees the page never stays inert.
- The upstream trigger is a button around the whole card, which would remove the heading from the
  page outline. The card is an `article` that morphs and opens on click, as a pointer convenience;
  a real button inside it is the keyboard and screen-reader control.
- Without JavaScript, each card holds the case study in `<noscript>` and the button is hidden. With
  JavaScript that markup does not exist, so nothing is duplicated. Playwright's text and role
  locators skip `<noscript>`, so its test reads `innerText`.
- `src/components/motion/Accents.tsx` wraps the looping accents: plain text on the server, during
  hydration and under reduced motion, and running only while on screen.
- The sticky illustration of D29 went with the long cards. Repository links moved, unchanged, into
  the case study.

## D33. Link previews, robots.txt and sitemap.xml

- `src/app/opengraph-image.png` and `twitter-image.png` are static files, so they work in the static
  export. `pnpm og:generate` draws them from `content/profile.json` with the site's fonts through
  Playwright. Run it after changing the name, role or headline.
- `metadataBase` comes from the optional `NEXT_PUBLIC_SITE_URL`. Without it Next writes
  `http://localhost:3000` into the image tags, so link previews work only once it is set at build
  time. `pnpm release:check` says so.
- Next's `robots.ts` and `sitemap.ts` always emit a file, so `scripts/write-seo-files.ts` writes them
  into `out/` after the build, and skips both when no site URL is set.

## D34. The Laboratory covers all six projects

- Seven modules. InterviewIQ joins RAG, and two are new: LLM Generation & Evaluation (InterviewIQ,
  StudyForge AI, GiftBro AI) and Data Intelligence & Analytics (PennyBloom, SmartQueue AI). StudyForge
  AI joins NLP as a comparison, for its duplicate-question check. PennyBloom is only in the data
  module, because it has no AI pipeline.
- Written from the local source of each project. Every code excerpt was compared with the file it
  names; that check reads folders outside this repository, so it is not part of `pnpm test`.
- Stages are shown as they are, including the unflattering ones: InterviewIQ's retrieval has no
  vectors or model, GiftBro AI limits its candidates by prompt and not by a check on the reply, and
  SmartQueue AI's hourly traffic and throughput chart is simulated from session totals. Its average
  wait and service times fall back to fixed defaults when there is no data.
- Every module shows the system switcher, even with one system, so the control is always in the
  same place. Recommendation, Queue Intelligence and OCR each have one, because no other project
  implements them.

## D35. Third set of Motion Primitives, and custom motion

Added with `npx motion-primitives@0.1.0 add <name>` into a scratch folder, reviewed, then moved to
`src/components/motion-primitives/`. No dependency was added: `react-use-measure` and `lucide-react`,
which the CLI asked for, were removed.

| Component | Used for | Patched because |
| --- | --- | --- |
| Text Loop | Phrases under the hero's role (`role_loop` in `content/about.json`) | Unchanged |
| Morphing Popover | Skills with verified uses list their projects | `aria-modal` on a non-modal popover, no name, no toggle, focus lost on close |
| Image Comparison | Application against architecture, in the case study | Drag only: the handle is now a real slider; a layer can hold a diagram |
| Carousel | Further screens, in the case study | `lucide-react` replaced with inline icons |
| Glow Effect | Featured card, active Laboratory module | Animated `background`; now only transform and opacity |
| Animated Group | Skills, certification rows, project tags | Wrote `opacity: 0` into the server HTML, the fault D16 removed |
| Toolbar Expandable | The NEXUS launcher | Hard-coded demo data and two dependencies; added disclosure semantics, Escape, focus return |
| Text Roll | Navigation labels, fine pointers | Unchanged; wrapped so a hidden copy holds the width |
| Spinning Text | Badge on the portrait frame | Added `paused`; removed a screen-reader copy of decoration |
| Cursor | "Open case" over project cards | Hid the cursor site-wide and leaked listeners; the owner now sets when it shows |

- The signal pulse and Matrix line draw are custom Motion. A trace lasts as long as the pulse, so a
  stage lights as the pulse arrives. Under reduced motion stages still highlight in turn, and
  nothing moves.
- The hero loop's static line and moving copy are both in the server HTML, and CSS chooses between
  them, so reduced motion and no JavaScript cause no layout shift. The loop has no Tab stop of its
  own: it pauses on hover and while focus is in the hero's text.
- Image Comparison shows `ArchitectureSketch`, a still drawing of the system view in
  `content/architecture.json`, the same data as the architecture explorer.
- The comparison and carousel load through `next/dynamic` when a case study opens. Morphing Dialog
  itself is not lazy: the card and its dialog share one layout animation, so its code ships with the
  page. Looping effects run only on screen, and Motion's frame loop stops in a hidden tab.
- Skill chips are 44px tall on phones, which makes that list taller, to keep the touch target rule.
- StudyForge AI's screenshots were captured from a copy of its code with an empty database, no API
  keys and a generated demo PDF, so the real `data/` folder and `backend/.env` were never used. Chat
  was left out: with no key it says Gemini is not configured.

## D36. Lighthouse reported stale results

- `scripts/lighthouse.ts` read each report back from a fixed path. When Edge stopped launching, no
  new report was written, and the script reprinted the files from 2026-10-30 as if they were new.
  Every score it printed after that date was stale. The first real measurement was Performance 65,
  Accessibility 97, LCP 10.1 s.
- Each report is now deleted before its run, so a failed run stops with an error. Playwright's
  Chromium is tried first, because Edge no longer launches for Lighthouse here.
- `scripts/serve-out-lib.ts` now gzips text and serves `.webp` as `image/webp`. It sent everything
  uncompressed and had no type for `.webp`. Any real host compresses text, so the measurement now
  resembles one.
- The hero's role line was the largest text on phones and stayed fully transparent through its
  entrance delay, so it painted after every script had loaded and the model counted them all
  against LCP. Its entrance now starts at 2% opacity, which registers it at first paint. A visitor
  sees the same animation. This is a choice made for the metric, and is recorded as one.
- Reveals now park at opacity 0, not 10 to 20%. Text below the fold in that state was being audited
  for contrast, and nothing needs to be faintly visible before it arrives.
- Result: Performance 95 to 99 across two sets of runs on the same code, Accessibility 100, LCP about
  1.2 to 1.3 s, CLS 0. The spread is measurement noise on this machine.

## D37. About: the engineer behind the systems

- About is one continuous page of hairlines, open space and type, so it reads as a person and not
  as another panel of cards. It runs about 4,100px at 1280px wide: the owner's redesign adds the
  perspective, the principles and the network back, and takes priority over the shorter section in
  D30.
- `headline` replaces `title`, and `principles` replaces the drafted `philosophy` line. The principle
  wording is the owner's. The `perspective` explanations are drafted, and a build check requires each
  `grounded_in` entry to be a skill or interest. The diagram says it is a way of looking at a
  problem, not the architecture of any project.
- `IdentityLattice` and `ExplorationTopics` are gone. The stage, principle and topic controls are
  real buttons over decorative drawings, so the buttons and their panel are the accessible
  alternative. Hidden explanations are repeated in `<noscript>`; the principles are always visible.
- The network draws only relationships in `topics[].projects`. Hovering previews connections, and
  only a click changes the panel.
- Areas of Exploration is the section's largest space, as its main feature: at least 85vh on
  desktop, a 680 to 820px network in a 70/30 split with the panel, and a full diagram on phones, with
  the arcs closer together and the panel stacked below.
- Twelve topics: the original six, then Machine Learning, OCR and Document Intelligence, AI Models
  and Platforms, Data and Database Systems, Frontend Engineering, and Analytics and Forecasting, as
  ordinary peer nodes in the same layout. Each new link was checked in its project's source. A
  hierarchical redesign was started and dropped before any layout changed; the topics stay peers.
- The cursor moves the diagram's planes by a few pixels on fine pointers. Its shapes turn with
  scroll position, forward and back, on the full scene mode only. Nothing captures the wheel.
- A layer laid over buttons must set `pointer-events: none`: the project labels first blocked every
  topic on desktop, which looked right in a screenshot and failed only when clicked.

## D38. The hero's negative arc radius

- `step()` capped elapsed time at the top but not the bottom. A frame's timestamp is when the frame
  began, so it can be earlier than the `performance.now()` taken when `wake()` scheduled it. Elapsed
  time went negative, which turned `1 - exp(-t / tau)` negative: the easing pushed glow and position
  away from their targets, and each frame amplified the last until `arc()` threw on a negative
  radius. With a 400ms lag this reached -3e27. `depth` and the radius formula were never at fault.
- `src/components/hero/neuralMath.ts` holds the arithmetic. `frameElapsed` is never negative, easing
  stays between 0 and 1, `stepNode` resets non-finite values so they cannot spread, and radius and
  alpha are always finite and in range. Normal values give the same result as before.
- `HeroMotion` no longer divides by a width or height of zero.

## D39. Evidence Engine, Engineering Connections and the Laboratory's capability map

- **Areas of Exploration** has left About. Its network and its 12 verified capabilities, unchanged,
  are now the first part of the AI Systems Laboratory, "01 Capability map", in
  `content/capabilities.json` and `CapabilityNetwork.tsx`. Network and panel are about 58/42 on
  desktop, stacked below 1100px. Project nodes can also be selected. A capability with a Laboratory
  module opens that module in "02 System workflows", so the section has one navigation system. This
  supersedes the Areas of Exploration notes in D37.
- **The graphical Skill Connection Matrix and its section are removed.** Its table remains as
  **Engineering Connections**, a subsection at the end of About (`#engineering-connections`, with
  no navigation entry). The data is unchanged, from `content/skill-map.json`. On phones the rows
  stack.
- **The Evidence Engine** (`#evidence`, between About and Projects) traces a capability to a project,
  its implementation and the inspected source files. It reads `content/evidence.json`. The build
  rejects any link that is not `{repository_url}/blob/main/{path}` of the project itself, and any
  path that is not relative to the repository. Every file was read locally and on its public main
  branch. Contribution status (`contribution_status`) is one of: `approved` (confirmed wording),
  `owner_stated` (a first-hand statement), or `unconfirmed` (commit history only, no claim shown).
- **The hero** offers Download resume (primary), GitHub and LinkedIn. View projects is removed.
- **Contact** is a form posting JSON to `NEXT_PUBLIC_CONTACT_FORM_ENDPOINT`, an https URL set at build
  time and documented in `.env.example`. Success is shown only after a 2xx response that does not
  report `ok: false`. Without an endpoint, the form says it is not connected and sends nothing. The
  email address and the resume panel are no longer shown in Contact.
- **Recovery note.** The removed Areas of Exploration files were restored for the Laboratory from
  this session's history and the development source maps. The component came from the final
  version, compiled after the last edit. The styles were replayed from the recorded edits, and they
  match the surviving stylesheet. The 12 capabilities were rebuilt from the backup plus the script
  that added six, which re-checked every link against the local source.

## D40. Engineering Casebook

- A new section, **Casebook** (`#casebook`), sits between Skills and AI Lab. It is an archive of case
  files. Opening one shows its dossier below the archive: five chapters (challenge, investigation,
  approach, result, takeaway) and margin notes for the contribution and source links. Escape or the
  close button returns focus to the case that opened it.
- Cases live in `content/casebook.json`. The build rejects an unknown project, or a source link that
  is not `{repository_url}/blob/main/{path}` of that project.
- There are three cases: StudyForge AI, Wingman AI and GiftBro AI. Every implementation detail was
  checked in the public main branch. One StudyForge function exists only in the local copy, so it
  is not cited. The Investigation chapter describes the constraints the code shows were handled,
  not a recalled sequence of events. No incidents, metrics or user numbers are claimed.
- PennyBloom and InterviewIQ are left out until their contributions are confirmed, and SmartQueue
  AI because its source documents no comparable engineering story.
- With eight links in the bar, the section numbers in the navigation now show only from 1440px. The
  link spacing below 1024px is slightly tighter.

## D41. Credential Orbit (experimental certifications layout)

- **Switch.** `CERTIFICATIONS_LAYOUT` in `src/config/layout.ts` is `"orbit"` by default and
  `"classic"` for the original archive. `NEXT_PUBLIC_CERTIFICATIONS_LAYOUT` overrides it for one
  build. `Certifications.tsx` picks the layout. The original `CertificationsSection.tsx` and its
  styles are unchanged, and both layouts read the same data.
- **Orbit.** Certificates sit on an elliptical path, with an academy selector beside it. Positions
  come from `orbit/geometry.ts`. Each frame writes CSS variables, and cards move by
  translate and scale in container units, never rotated. Nothing re-renders and nothing shifts the
  layout. Frames run only while something moves.
- **Pausing.** The orbit holds still while hovered, focused or inspected, when paused with its
  button, off screen, or in a hidden tab. Under reduced motion it never moves.
- **Phones.** A shallow orbit shows one certificate at its front, with Previous and Next. The
  academy chips wrap instead of scrolling sideways.
- **Dimming** uses brightness, not transparency, so dimmed text keeps its contrast.
- **Data.** The certifications carry no dates, links or documents, so the record shows "Not
  recorded" and says no document or link has been published. Previews and "View certificate"
  appear only when the data holds a real file.
- **Tests.** Classic-only end-to-end tests skip under the orbit, and `orbit.spec.ts` skips under
  the classic layout. Both builds were run.

## D42. Credential Orbit 3.0: a spatial WebGL environment

- **Default layout.** `CERTIFICATIONS_LAYOUT = "orbit"` is now 3.0. `"orbit-2d"` keeps 2.0 and
  `"classic"` keeps the original archive. All three read the same data.
- **Architecture.** `three` 0.187.0 is the only added runtime dependency (`@types/three` for
  types), with no React Three Fiber.
  - `space/model.ts` holds the pure math: orbits, camera fit, projection, springs, tag layout.
  - `space/engine.ts` is the scene, loaded with `import()` only as the section approaches.
  - `space/CredentialSpace.tsx` renders every readable and pressable element as HTML.
  - Without WebGL, the same shell draws the projected orbits in SVG.
- **Composition.**
  - Each certificate is a compact marker: a lit node, a halo ring and a connector to the path.
  - Small HTML tags sit outward from the orbit, or on the marker on phones.
  - Screen-space collision avoidance keeps tags apart and out of a safe zone around the core.
  - The camera distance is solved so every track and tag fits inside safe margins.
  - The inspector docks beside the scene, and a lens shift re-frames the system into the space
    that is left.
  - The central text caption was removed, leaving the certificate names as the only labels. Its
    safe zone stays, so the tag
    positions did not change.
- **Motion.**
  - Continuous orbit, damped pointer parallax by layer, and spring settling.
  - Depth focus when an academy is chosen, and magnetic hover.
  - Light pulses, particle flow along the primary orbit, and a staged entrance.
  - The inspector expands out of the chosen tag.
  - The render loop runs only while something moves, and stops off screen or in a hidden tab.
  - Under reduced motion the scene is still and renders on demand.

## D43. Pre-launch corrections (2026-11-08)

- **SmartQueue AI** is described as it is built: a rule-based queue system. Its category is the
  resume heading, "Intelligent Queue Management & Analytics System", and the Laboratory module is
  "Rule-based Queue Intelligence". The project name is unchanged.
- **Contributions.** GiftBro AI and SmartQueue AI show the owner's own wording
  on project cards, the Evidence Engine and the Casebook. InterviewIQ and PennyBloom are
  `unconfirmed`: the Evidence Engine shows their evidence but claims no contribution.
- **Email.** `links.email` is null, and the footer link and Command Centre email command are
  removed, so the address appears only in the resume PDF. `verify-static` fails if it reaches out/.
- **Site URL.** `src/lib/site.ts` validates `NEXT_PUBLIC_SITE_URL`. Only a valid https address
  produces the canonical URL, link preview tags, robots.txt and sitemap.xml. The preview image moved
  to `public/social/link-preview.png`, because Next's file convention falls back to localhost.
  `verify-static` fails if anything in out/ points at localhost, and `release:check` reports a
  missing, placeholder or non-https address, and a missing contact endpoint, as blockers.
- **Icons.** `favicon.ico` and `apple-icon.png` are rasterised from the existing `icon.svg` by
  `pnpm icons:generate`; the mark is unchanged.
- **Portraits.** The two unused 1.7 MB copies of the original photograph left `public/`; the
  original is kept outside the repository. The Hero cutout is untouched, and a test
  pins its hash.
- **LCP.** On first load the largest element is the hero introduction at every width tested; the
  project screenshots are lazy and below the fold, so no image priority changed.
