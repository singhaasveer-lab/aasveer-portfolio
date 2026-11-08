"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArchitectureTrigger } from "@/components/explorer/architecture/ArchitectureTrigger";
import { useExplorer } from "@/components/explorer/ExplorerProvider";
import type { Evidence, EvidenceApplication } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

const pad = (n: number) => String(n).padStart(2, "0");

const CONTRIBUTION: Record<EvidenceApplication["contribution_status"], string> = {
  approved: "Confirmed contribution",
  owner_stated: "Stated by Aasveer",
  unconfirmed: "",
};

const KIND: Record<string, string> = {
  source: "Source",
  test: "Test",
  api: "Endpoint",
  schema: "Data model",
  readme: "Docs",
};

/** How an evidence item was checked. Only what was actually done is ever claimed. */
function Verification({ url }: { url?: string }) {
  return (
    <span className="ev-checks">
      <span className="ev-check" data-check="source">
        Source verified
      </span>
      {url ? (
        <span className="ev-check" data-check="public">
          Public source available
        </span>
      ) : (
        <span className="ev-check" data-check="local">
          Not yet published
        </span>
      )}
    </span>
  );
}

/**
 * The Evidence Engine: every capability claimed here leads to the code behind it. Pick a capability
 * and follow the trail to a project, its implementation and the inspected source files, each a link
 * to the public file. Records live in content/evidence.json and are checked when the site is built.
 */
export function EvidenceEngine({ evidence }: { evidence: Evidence }) {
  const { projects } = useExplorer();
  const { records, quick_view: quick } = evidence;
  const [recordIndex, setRecordIndex] = useState(0);
  const [projectIndex, setProjectIndex] = useState(0);
  const [mode, setMode] = useState<"trace" | "quick">("trace");

  const record = records[recordIndex]!;
  const application = record.applications[Math.min(projectIndex, record.applications.length - 1)]!;
  const project = projects.find((p) => p.slug === application.project);
  const nameOf = (slug: string) => projects.find((p) => p.slug === slug)?.display_name ?? slug;
  const publicCount = application.evidence.filter((e) => e.url).length;

  const trace = (id: string, slug: string) => {
    const r = records.findIndex((x) => x.id === id);
    if (r < 0) return;
    setRecordIndex(r);
    setProjectIndex(
      Math.max(
        0,
        records[r]!.applications.findIndex((a) => a.project === slug),
      ),
    );
    setMode("trace");
  };

  return (
    <div className="ev" data-testid="evidence-engine">
      <div className="ev-bar">
        <p className="ev-bar-note">
          {records.length} capabilities · {records.reduce((n, r) => n + r.applications.length, 0)}{" "}
          implementations ·{" "}
          {records.reduce(
            (n, r) => n + r.applications.reduce((m, a) => m + a.evidence.length, 0),
            0,
          )}{" "}
          inspected source files
        </p>
        {quick.length > 0 && (
          <button
            type="button"
            className="ev-quick-toggle"
            aria-pressed={mode === "quick"}
            data-testid="evidence-quick-toggle"
            onClick={() => setMode(mode === "quick" ? "trace" : "quick")}
          >
            <span className="ev-quick-dot" aria-hidden="true" />
            {mode === "quick" ? "Back to all evidence" : "Recruiter quick view"}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mode === "quick" ? (
          <motion.div
            key="quick"
            className="ev-quick"
            data-testid="evidence-quick"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <p className="ev-quick-lede">
              The three strongest contributions with confirmed or stated authorship and inspected
              public source. About a minute to read.
            </p>
            <ol className="ev-quick-list">
              {quick.map((q, i) => {
                const r = records.find((x) => x.id === q.record)!;
                const a = r.applications.find((x) => x.project === q.project)!;
                return (
                  <li key={q.record} className="ev-quick-card" data-testid="evidence-quick-card">
                    <p className="ev-quick-index" aria-hidden="true">
                      {pad(i + 1)}
                    </p>
                    <h3 className="ev-quick-project">{nameOf(q.project)}</h3>
                    <p className="ev-quick-capability">{r.capability}</p>
                    <dl className="ev-quick-facts">
                      <div>
                        <dt>Worked on</dt>
                        <dd>{q.worked_on}</dd>
                      </div>
                      <div>
                        <dt>Why it matters</dt>
                        <dd>{q.why}</dd>
                      </div>
                      {a.contribution && (
                        <div>
                          <dt>Contribution</dt>
                          <dd>{CONTRIBUTION[a.contribution_status]}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="label">Inspect</p>
                    <ul className="ev-quick-links">
                      {a.evidence
                        .filter((e) => e.url)
                        .slice(0, 2)
                        .map((e) => (
                          <li key={e.label}>
                            <a href={e.url} target="_blank" rel="noopener noreferrer">
                              <span className="ev-path">{e.path}</span>
                              <span className="sr-only"> (opens GitHub in a new tab)</span>
                            </a>
                          </li>
                        ))}
                    </ul>
                    <button
                      type="button"
                      className="ev-trace-button"
                      data-testid="evidence-quick-trace"
                      onClick={() => trace(q.record, q.project)}
                    >
                      Trace the full evidence <span aria-hidden="true">→</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        ) : (
          <motion.div
            key="trace"
            className="ev-console"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <nav className="ev-index" aria-label="Capabilities">
              <p className="ev-col-label">Capability index</p>
              <ol>
                {records.map((r, i) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="ev-capability"
                      aria-pressed={i === recordIndex}
                      data-testid={`evidence-capability-${r.id}`}
                      onClick={() => {
                        setRecordIndex(i);
                        setProjectIndex(0);
                      }}
                    >
                      <span className="ev-capability-index" aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      <span className="ev-capability-name">{r.capability}</span>
                      <span className="ev-capability-count">
                        {r.applications.length}
                        <span className="sr-only">
                          {r.applications.length === 1 ? " project" : " projects"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="ev-dossier" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={`${record.id}:${application.project}`}
                  className="ev-record"
                  data-testid="evidence-record"
                  data-record={record.id}
                  data-project={application.project}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.26, ease: EASE_OUT }}
                >
                  <p className="ev-record-id">
                    Evidence record {pad(recordIndex + 1)} / {pad(records.length)}
                  </p>
                  <h3 className="ev-record-title">{record.capability}</h3>
                  <p className="ev-record-summary">{record.summary}</p>

                  {record.applications.length > 1 && (
                    <div className="ev-applied" role="group" aria-label="Applied in">
                      {record.applications.map((a, i) => (
                        <button
                          key={a.project}
                          type="button"
                          className="ev-applied-project"
                          aria-pressed={a.project === application.project}
                          data-testid={`evidence-project-${a.project}`}
                          onClick={() => setProjectIndex(i)}
                        >
                          {nameOf(a.project)}
                        </button>
                      ))}
                    </div>
                  )}

                  <ol className="ev-trail" aria-label="Evidence trail" data-testid="evidence-trail">
                    {[
                      ["Capability", record.capability],
                      ["Project", nameOf(application.project)],
                      ["Implementation", application.implementation],
                      [
                        "Evidence",
                        `${application.evidence.length} inspected file${application.evidence.length === 1 ? "" : "s"}, ${publicCount} public`,
                      ],
                    ].map(([step, value], i) => (
                      <li
                        key={step}
                        className="ev-trail-step"
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        <span className="ev-trail-label">{step}</span>
                        <span className="ev-trail-value">{value}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="ev-findings">
                    <section>
                      <h4 className="ev-heading">Engineering context</h4>
                      <p>{application.context}</p>
                    </section>
                    {application.contribution && (
                      <section>
                        <h4 className="ev-heading">
                          My contribution
                          <span
                            className="ev-status"
                            data-status={application.contribution_status}
                            data-testid="evidence-contribution-status"
                          >
                            {CONTRIBUTION[application.contribution_status]}
                          </span>
                        </h4>
                        <p>{application.contribution}</p>
                      </section>
                    )}
                    <section className="ev-insight">
                      <h4 className="ev-heading">Engineering insight</h4>
                      <p>{application.insight}</p>
                    </section>
                  </div>
                </motion.article>
              </AnimatePresence>
            </div>

            <aside className="ev-refs" aria-label="Verification and sources">
              <p className="ev-col-label">Source evidence</p>
              <ul className="ev-sources" data-testid="evidence-sources">
                {application.evidence.map((item) => (
                  <li key={`${item.path}:${item.label}`}>
                    <details className="ev-source">
                      <summary>
                        <span className="ev-kind">{KIND[item.kind]}</span>
                        <span className="ev-source-label">{item.label}</span>
                        <span className="ev-path">{item.path}</span>
                      </summary>
                      <div className="ev-source-body">
                        <Verification url={item.url} />
                        {item.url && (
                          <a
                            className="ev-source-link"
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="evidence-source-link"
                          >
                            Inspect the implementation on GitHub
                            <span className="sr-only"> (opens in a new tab)</span>
                            <span aria-hidden="true"> ↗</span>
                          </a>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <p className="ev-col-label mt-8">Project</p>
              <div className="ev-project-links">
                {project && (
                  <a className="ev-project-link" href={`#project-${project.slug}`}>
                    View {project.display_name} <span aria-hidden="true">→</span>
                  </a>
                )}
                {project && (
                  <ArchitectureTrigger
                    slug={project.slug}
                    name={project.display_name}
                    className="matrix-action"
                  />
                )}
              </div>
              <p className="ev-legend">
                Each file was read and the cited code found in it, locally and in the public
                repository&apos;s main branch.
              </p>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>

      <noscript>
        <div className="ev-noscript">
          {records.map((r) => (
            <section key={r.id}>
              <h3>{r.capability}</h3>
              {r.applications.map((a) => (
                <div key={a.project}>
                  <p>
                    <strong>{nameOf(a.project)}</strong>: {a.context}
                  </p>
                  <ul>
                    {a.evidence.map((e) => (
                      <li key={e.path + e.label}>
                        {e.url ? <a href={e.url}>{e.path}</a> : e.path}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </noscript>
    </div>
  );
}
