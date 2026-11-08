"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useState } from "react";
import { Stagger } from "@/components/motion/Accents";
import { useMedia } from "@/hooks/useSceneMotion";
import { EASE_OUT } from "@/lib/motion";
import type { PublicCertification } from "@/lib/validation/schemas";

const ALL = "all";
const MARKS = [
  "var(--accent)",
  "var(--blue)",
  "var(--teal)",
  "var(--violet)",
  "#8ec5ff",
  "#6fd6ff",
];

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (cert: PublicCertification) => `${cert.issuer}|${cert.course_name}`;
const mark = (color: string) => ({ "--mark": color }) as React.CSSProperties;

/** Each issuer once, in order of first appearance, with its credentials. */
function groupByIssuer(certs: PublicCertification[]) {
  const groups: { issuer: string; certs: PublicCertification[] }[] = [];
  for (const cert of [...certs].sort((a, b) => a.display_order - b.display_order)) {
    const group = groups.find((g) => g.issuer === cert.issuer);
    if (group) group.certs.push(cert);
    else groups.push({ issuer: cert.issuer, certs: [cert] });
  }
  return groups;
}

/** A plain two-letter issuer marker: a filing label, not a logo or a seal. */
const initials = (issuer: string) =>
  issuer
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

function ExternalAction({ href, label, course }: { href: string; label: string; course: string }) {
  return (
    <a className="vault-action" href={href} target="_blank" rel="noopener noreferrer">
      {label} <span className="sr-only">for {course} </span>
      <span className="text-[0.72rem] text-muted">(opens in a new tab)</span>
    </a>
  );
}

/** One credential in full. A date or action appears only when the content file holds a real one. */
function CredentialDetail({
  cert,
  position,
  total,
}: {
  cert: PublicCertification;
  position: number;
  total: number;
}) {
  return (
    <div className="vault-detail" data-testid="credential-detail">
      <span className="vault-scan" aria-hidden="true" />
      <p className="vault-detail-bar">
        <span>Credential record</span>
        <span>
          {pad(position)} / {pad(total)}
        </span>
      </p>
      <h5 className="vault-detail-title">{cert.course_name}</h5>
      <dl>
        <div>
          <dt>Issuing organisation</dt>
          <dd>{cert.issuer}</dd>
        </div>
        {cert.completed_on && (
          <div>
            <dt>Completed</dt>
            <dd>{cert.completed_on}</dd>
          </div>
        )}
      </dl>
      {cert.credential_url && (
        <ExternalAction
          href={cert.credential_url}
          label="Verify credential"
          course={cert.course_name}
        />
      )}
      {cert.certificate_url && (
        <ExternalAction
          href={cert.certificate_url}
          label="Open certificate"
          course={cert.course_name}
        />
      )}
    </div>
  );
}

/**
 * The credential archive: an issuer selector, an index of every credential, and the full record
 * of the selected one. All twelve are in the page and listed by default, so nothing depends on
 * an interaction. On narrower screens the record opens inside the list, under its row.
 */
export function CertificationsSection({
  certifications,
}: {
  certifications: PublicCertification[];
}) {
  const groups = groupByIssuer(certifications);
  const ordered = groups.flatMap((g) => g.certs);
  const [filter, setFilter] = useState(ALL);
  const [selected, setSelected] = useState<string | null>(keyOf(ordered[0]!));
  const [closed, setClosed] = useState<string[]>([]);
  const inline = useMedia("(max-width: 1179px)", false);
  const reduced = useReducedMotion();

  const shown = filter === ALL ? groups : groups.filter((g) => g.issuer === filter);
  const count = shown.reduce((sum, g) => sum + g.certs.length, 0);
  const current = ordered.find((c) => keyOf(c) === selected);
  const transition = { duration: reduced ? 0 : 0.32, ease: EASE_OUT };

  function choose(issuer: string) {
    setFilter(issuer);
    const first = issuer === ALL ? ordered[0] : groups.find((g) => g.issuer === issuer)?.certs[0];
    if (first) setSelected(keyOf(first));
    setClosed([]);
  }

  const detail = (cert: PublicCertification) => (
    <CredentialDetail cert={cert} position={ordered.indexOf(cert) + 1} total={ordered.length} />
  );

  return (
    <div data-testid="credential-archive">
      <p className="vault-eyebrow">
        <span className="text-accent">Credential archive</span> {"//"} Certifications
      </p>
      <h3 className="display mt-3 text-[clamp(2rem,4vw,3.4rem)]">Certifications</h3>

      <div className="vault">
        <div className="vault-rail" role="group" aria-label="Filter credentials by issuer">
          <button
            type="button"
            className="vault-filter"
            aria-pressed={filter === ALL}
            data-testid="vault-filter-all"
            onClick={() => choose(ALL)}
          >
            <span className="vault-mark" aria-hidden="true">
              All
            </span>
            <span className="min-w-0">All issuers</span>
            <span className="vault-count">{certifications.length}</span>
          </button>
          {groups.map((group, i) => (
            <button
              key={group.issuer}
              type="button"
              className="vault-filter"
              style={mark(MARKS[i % MARKS.length]!)}
              aria-pressed={filter === group.issuer}
              data-testid="vault-filter"
              onClick={() => choose(group.issuer)}
            >
              <span className="vault-mark" aria-hidden="true">
                {initials(group.issuer)}
              </span>
              <span className="min-w-0">{group.issuer}</span>
              <span className="vault-count">{group.certs.length}</span>
            </button>
          ))}
        </div>

        <div className="vault-index-panel">
          <p className="vault-status" role="status" data-testid="vault-status">
            Showing {count} of {certifications.length} credentials
          </p>
          {shown.map((group) => {
            const open = !closed.includes(group.issuer);
            const listId = `vault-${initials(group.issuer)}`;
            return (
              <section
                key={group.issuer}
                className="vault-group"
                style={mark(MARKS[groups.indexOf(group) % MARKS.length]!)}
                data-testid="vault-group"
              >
                <h4>
                  <button
                    type="button"
                    className="vault-group-toggle"
                    aria-expanded={open}
                    aria-controls={listId}
                    data-testid="vault-group-toggle"
                    onClick={() =>
                      setClosed(
                        open
                          ? [...closed, group.issuer]
                          : closed.filter((issuer) => issuer !== group.issuer),
                      )
                    }
                  >
                    <span className="vault-group-name">{group.issuer}</span>
                    <span className="vault-group-count">
                      {group.certs.length} {group.certs.length === 1 ? "record" : "records"}
                    </span>
                    <span className="disclosure-marker" data-open={open} aria-hidden="true" />
                  </button>
                </h4>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={listId}
                      className="vault-list-wrap"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={transition}
                    >
                      <Stagger as="ol" className="vault-list">
                        {group.certs.map((cert) => {
                          const active = selected === keyOf(cert);
                          return (
                            <Fragment key={cert.course_name}>
                              <button
                                type="button"
                                className="vault-record"
                                aria-pressed={active}
                                data-testid="vault-record"
                                onClick={() => setSelected(active && inline ? null : keyOf(cert))}
                              >
                                <span className="vault-index" aria-hidden="true">
                                  {pad(ordered.indexOf(cert) + 1)}
                                </span>
                                <span className="min-w-0">
                                  <span className="cert-course">{cert.course_name}</span>
                                  <span className="cert-issuer">
                                    {cert.issuer}
                                    {cert.completed_on && ` · ${cert.completed_on}`}
                                  </span>
                                  {cert.featured && (
                                    <span className="vault-featured" data-testid="vault-featured">
                                      Featured
                                    </span>
                                  )}
                                </span>
                              </button>
                              <AnimatePresence initial={false}>
                                {inline && active && (
                                  <motion.div
                                    className="vault-inline"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={transition}
                                  >
                                    {detail(cert)}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </Fragment>
                          );
                        })}
                      </Stagger>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>

        {!inline && current && (
          <aside className="vault-aside" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={keyOf(current)}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.2, ease: EASE_OUT }}
              >
                {detail(current)}
              </motion.div>
            </AnimatePresence>
          </aside>
        )}
      </div>
    </div>
  );
}
