"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { useExplorer } from "@/components/explorer/ExplorerProvider";
import type { CaseStudy } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

const pad = (n: number) => String(n).padStart(2, "0");

const CONTRIBUTION: Record<CaseStudy["contribution_status"], string> = {
  approved: "Confirmed contribution",
  owner_stated: "Stated by Aasveer",
};

const PANEL_ID = "casebook-dossier";

/** The five chapters of every case, in reading order. */
function Chapters({ study }: { study: CaseStudy }) {
  const chapters: [string, React.ReactNode][] = [
    ["The challenge", <p key="c">{study.challenge}</p>],
    ["The investigation", <p key="i">{study.investigation}</p>],
    [
      "The approach",
      <ul key="a">
        {study.approach.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>,
    ],
    [
      "The result",
      <ul key="r">
        {study.result.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>,
    ],
    ["The takeaway", <p key="t">{study.takeaway}</p>],
  ];
  return (
    <ol className="cb-chapters">
      {chapters.map(([title, body], i) => (
        <li
          key={title}
          className="cb-chapter"
          data-chapter={i + 1}
          style={{ "--i": i } as React.CSSProperties}
        >
          <p className="cb-chapter-mark" aria-hidden="true">
            {pad(i + 1)}
          </p>
          <div className="cb-chapter-body">
            <h4 className="cb-chapter-title">{title}</h4>
            {body}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The margin notes beside a case: what was contributed and where to read the code. */
function Margin({ study, projectName }: { study: CaseStudy; projectName: string }) {
  return (
    <aside className="cb-margin" aria-label={`Notes on ${study.title}`}>
      <div className="cb-note">
        <p className="cb-note-label">My contribution</p>
        <p className="cb-status" data-status={study.contribution_status}>
          {CONTRIBUTION[study.contribution_status]}
        </p>
        <p className="cb-note-text">{study.contribution}</p>
      </div>
      <div className="cb-note">
        <p className="cb-note-label">Read the source</p>
        <ul className="cb-sources">
          {study.sources.map((source) => (
            <li key={source.path}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                <span className="cb-source-label">{source.label}</span>
                <span className="cb-source-path">{source.path}</span>
                <span className="sr-only"> (opens GitHub in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <a className="cb-project-link" href={`#project-${study.project}`}>
        See {projectName} in Projects <span aria-hidden="true">→</span>
      </a>
    </aside>
  );
}

/**
 * The Engineering Casebook: how a problem was approached, told as a case file. The archive lists
 * each case; exploring one opens its full story beneath the archive, in five chapters with margin
 * notes. Escape or the close button shuts it and returns focus to the case that opened it. Cases
 * live in content/casebook.json and are checked against each project's repository at build time.
 */
export function Casebook({ cases }: { cases: CaseStudy[] }) {
  const { projects } = useExplorer();
  const [open, setOpen] = useState<string | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const opener = useRef<string | null>(null);
  const reduced = useReducedMotion();
  const nameOf = (slug: string) => projects.find((p) => p.slug === slug)?.display_name ?? slug;

  const index = cases.findIndex((c) => c.id === open);
  const study = index >= 0 ? cases[index] : undefined;

  const show = (id: string) => {
    opener.current = id;
    pendingFocus.current = true;
    setOpen(id);
  };
  const close = () => {
    const id = opener.current ?? open;
    pendingFocus.current = false;
    setOpen(null);
    if (id) triggers.current.get(id)?.focus();
  };

  /**
   * A newly shown case mounts only after the previous one has animated out, so its title takes
   * focus as it mounts: the case comes into view and focus moves to its title.
   */
  const pendingFocus = useRef(false);
  const titleRef = (el: HTMLHeadingElement | null) => {
    if (!el || !pendingFocus.current) return;
    pendingFocus.current = false;
    document
      .getElementById(PANEL_ID)
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  };

  return (
    <div className="cb" data-testid="casebook">
      <ol className="cb-archive" aria-label="Case files">
        {cases.map((c, i) => {
          const isOpen = c.id === open;
          return (
            <li key={c.id} className="cb-file" data-open={isOpen || undefined}>
              <div className="cb-file-meta">
                <span>Case {pad(i + 1)}</span>
                <span>{c.category}</span>
              </div>
              <p className="cb-file-number" aria-hidden="true">
                {pad(i + 1)}
              </p>
              <p className="cb-file-project">{nameOf(c.project)}</p>
              <h3 className="cb-file-title">{c.title}</h3>
              <p className="cb-file-intro">{c.intro}</p>
              <button
                ref={(el) => {
                  if (el) triggers.current.set(c.id, el);
                  else triggers.current.delete(c.id);
                }}
                type="button"
                className="cb-explore"
                aria-expanded={isOpen}
                aria-controls={PANEL_ID}
                data-testid={`case-open-${c.id}`}
                onClick={() => (isOpen ? close() : show(c.id))}
              >
                {isOpen ? "Close case" : "Explore case"}
                <span className="sr-only">: {c.title}</span>
                <span className="cb-explore-mark" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div id={PANEL_ID} className="cb-panel">
        <AnimatePresence mode="wait" initial={false}>
          {study && (
            <motion.article
              key={study.id}
              className="cb-dossier"
              data-testid="case-dossier"
              data-case={study.id}
              aria-labelledby={`${PANEL_ID}-title`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  close();
                }
              }}
            >
              <header className="cb-dossier-head">
                <p className="cb-dossier-meta">
                  <span>Case {pad(index + 1)}</span>
                  <span>{nameOf(study.project)}</span>
                  <span>{study.category}</span>
                </p>
                <h3
                  ref={titleRef}
                  id={`${PANEL_ID}-title`}
                  className="cb-dossier-title"
                  tabIndex={-1}
                >
                  {study.title}
                </h3>
                <p className="cb-dossier-intro">{study.intro}</p>
                <button type="button" className="cb-close" data-testid="case-close" onClick={close}>
                  Close case <span aria-hidden="true">✕</span>
                </button>
              </header>
              <div className="cb-dossier-grid">
                <Chapters study={study} />
                <Margin study={study} projectName={nameOf(study.project)} />
              </div>
              {cases.length > 1 && (
                <nav className="cb-dossier-foot" aria-label="Other cases">
                  {cases
                    .filter((c) => c.id !== study.id)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="cb-next"
                        data-testid={`case-switch-${c.id}`}
                        onClick={() => show(c.id)}
                      >
                        <span className="cb-next-label">
                          Case {pad(cases.indexOf(c) + 1)} · {nameOf(c.project)}
                        </span>
                        <span className="cb-next-title">{c.title}</span>
                      </button>
                    ))}
                </nav>
              )}
            </motion.article>
          )}
        </AnimatePresence>
      </div>

      <noscript>
        <div className="cb-noscript">
          {cases.map((c, i) => (
            <article key={c.id} className="cb-dossier">
              <header className="cb-dossier-head">
                <p className="cb-dossier-meta">
                  <span>Case {pad(i + 1)}</span>
                  <span>{nameOf(c.project)}</span>
                  <span>{c.category}</span>
                </p>
                <h3 className="cb-dossier-title">{c.title}</h3>
              </header>
              <div className="cb-dossier-grid">
                <Chapters study={c} />
                <Margin study={c} projectName={nameOf(c.project)} />
              </div>
            </article>
          ))}
        </div>
      </noscript>
    </div>
  );
}
