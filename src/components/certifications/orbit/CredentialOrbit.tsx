"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMedia } from "@/hooks/useSceneMotion";
import { EASE_OUT } from "@/lib/motion";
import type { PublicCertification } from "@/lib/validation/schemas";
import {
  COMPACT,
  FRONT,
  SPEED,
  WIDE,
  approach,
  baseAngle,
  nearest,
  phaseToFront,
  place,
  type Orbit,
} from "./geometry";

const ALL = "all";
const pad = (n: number) => String(n).padStart(2, "0");

/** A plain issuer marker built from its name: a filing label, not a logo. */
const initials = (issuer: string) =>
  issuer
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

/** Certificate files the page can show as an image preview. */
const isImage = (url: string) => /\.(png|jpe?g|webp|avif|gif)$/i.test(url);

/** Fixed, evenly scattered points for the faint star field, so server and client agree. */
const STARS = Array.from({ length: 26 }, (_, i) => ({
  x: ((i * 37) % 97) + 1.5,
  y: ((i * 53) % 89) + 4,
  d: (i % 5) * 1.3,
  big: i % 7 === 0,
}));

/** The phase that puts the first credential at the front of the orbit. */
const START = FRONT;

function cssVars(p: ReturnType<typeof place>) {
  return {
    "--x": (p.x * 100).toFixed(3),
    "--y": (p.y * 100).toFixed(3),
    "--s": p.scale.toFixed(3),
    "--o": p.opacity.toFixed(3),
    zIndex: p.z,
  } as React.CSSProperties;
}

/** Verified metadata only. A preview or action appears only when the data holds a real one. */
function CredentialPanel({
  cert,
  position,
  total,
  onClose,
}: {
  cert: PublicCertification;
  position: number;
  total: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const file = cert.certificate_url;
  return (
    <motion.section
      className="co-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-testid="orbit-panel"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="co-panel-bar">
        <span>Credential record</span>
        <span>
          {pad(position)} / {pad(total)}
        </span>
      </div>
      <h4 id={titleId} ref={heading} tabIndex={-1} className="co-panel-title">
        {cert.course_name}
      </h4>
      <dl className="co-panel-facts">
        <div>
          <dt>Issuing organisation</dt>
          <dd>{cert.issuer}</dd>
        </div>
        <div>
          <dt>Issue date</dt>
          <dd>{cert.completed_on ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>Listed on Aasveer&apos;s resume</dd>
        </div>
      </dl>
      {file && isImage(file) && (
        // A real certificate image from the content file; its size is unknown in advance.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="co-panel-preview"
          src={file}
          alt={`Certificate: ${cert.course_name}, ${cert.issuer}`}
          loading="lazy"
        />
      )}
      <div className="co-panel-actions">
        {file && (
          <a
            className="btn btn-primary btn-caps"
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="orbit-view-certificate"
          >
            View certificate<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        {cert.credential_url && (
          <a
            className="btn btn-outline btn-caps"
            href={cert.credential_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Verify credential<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      {!file && !cert.credential_url && (
        <p className="co-panel-note" data-testid="orbit-no-document">
          No certificate document or verification link has been published for this credential.
        </p>
      )}
      <button type="button" className="co-panel-close" onClick={onClose} data-testid="orbit-close">
        Back to the orbit <span aria-hidden="true">✕</span>
      </button>
    </motion.section>
  );
}

/**
 * Credential Orbit: every certificate on a slow orbital path, with an academy selector beside it.
 * Choosing an academy brightens its certificates, dims the rest and turns them to the front.
 * The orbit pauses while it is hovered, focused or inspected, can be paused outright, and stands
 * still under reduced motion. Positions are written to CSS variables on each frame and drawn with
 * transforms, so nothing re-renders and nothing shifts the layout. Every certificate is also in a
 * plain list below.
 */
export function CredentialOrbit({ certifications }: { certifications: PublicCertification[] }) {
  const certs = useMemo(
    () => [...certifications].sort((a, b) => a.display_order - b.display_order),
    [certifications],
  );
  const count = certs.length;
  const academies = useMemo(() => {
    const list: { issuer: string; count: number }[] = [];
    for (const cert of certs) {
      const found = list.find((a) => a.issuer === cert.issuer);
      if (found) found.count += 1;
      else list.push({ issuer: cert.issuer, count: 1 });
    }
    return list;
  }, [certs]);

  const [academy, setAcademy] = useState(ALL);
  const [open, setOpen] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [current, setCurrent] = useState(0);
  // Hydrates with the server's value, then follows the visitor's setting: no markup mismatch.
  const reduced = useMedia("(prefers-reduced-motion: reduce)", false);
  const compact = useMedia("(max-width: 767px)", false);
  const orbit: Orbit = compact ? COMPACT : WIDE;

  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);
  const links = useRef<(SVGLineElement | null)[]>([]);
  const motionState = useRef({
    phase: START,
    target: null as number | null,
    hover: false,
    focus: false,
    visible: true,
    raf: 0,
    last: 0,
  });

  const inAcademy = (cert: PublicCertification) => academy === ALL || cert.issuer === academy;
  const selected = certs.filter(inAcademy);
  const paused = userPaused || open !== null || reduced;

  /** Writes every position for the current phase straight to the DOM. */
  const draw = useCallback(() => {
    const { phase } = motionState.current;
    certs.forEach((_, i) => {
      const p = place(phase + baseAngle(i, count), orbit);
      const card = cards.current[i];
      const node = nodes.current[i];
      const link = links.current[i];
      if (node) {
        node.style.setProperty("--x", (p.nx * 100).toFixed(3));
        node.style.setProperty("--y", (p.ny * 100).toFixed(3));
        node.style.zIndex = String(p.z);
      }
      if (card) {
        card.style.setProperty("--x", (p.x * 100).toFixed(3));
        card.style.setProperty("--y", (p.y * 100).toFixed(3));
        card.style.setProperty("--s", p.scale.toFixed(3));
        card.style.setProperty("--o", p.opacity.toFixed(3));
        card.style.zIndex = String(p.z);
      }
      if (link) {
        link.setAttribute("x1", (p.nx * 100).toFixed(3));
        link.setAttribute("y1", (p.ny * 100).toFixed(3));
        link.setAttribute("x2", (p.x * 100).toFixed(3));
        link.setAttribute("y2", (p.y * 100).toFixed(3));
      }
    });
  }, [certs, count, orbit]);

  /** Runs frames only while something is moving: drifting, or turning to a new target. */
  const kick = useCallback(() => {
    const s = motionState.current;
    if (s.raf) return;
    s.last = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(64, Math.max(0, now - s.last));
      s.last = now;
      const drifting = !paused && !compact && !s.hover && !s.focus && s.visible;
      if (s.target !== null) {
        s.phase = approach(s.phase, s.target, elapsed);
        if (s.phase === s.target) s.target = null;
      } else if (drifting) {
        s.phase += elapsed * SPEED;
      }
      draw();
      if (s.target !== null || drifting) s.raf = requestAnimationFrame(tick);
      else s.raf = 0;
    };
    s.raf = requestAnimationFrame(tick);
  }, [paused, compact, draw]);

  const stop = () => {
    const s = motionState.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  };

  /** Turns the orbit to `phase`, at once under reduced motion. */
  const turnTo = useCallback(
    (phase: number) => {
      const s = motionState.current;
      if (reduced) {
        s.phase = phase;
        s.target = null;
        draw();
        return;
      }
      s.target = phase;
      kick();
    },
    [reduced, draw, kick],
  );

  // Redraw for the current layout, and restart the drift whenever the pause state changes.
  useEffect(() => {
    stop();
    draw();
    if (!reduced) kick();
    return stop;
  }, [draw, kick, reduced]);

  // No frames while the orbit is off screen or the tab is hidden.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const s = motionState.current;
    const observer = new IntersectionObserver(([entry]) => {
      s.visible = !!entry?.isIntersecting;
      if (s.visible) kick();
    });
    observer.observe(element);
    const onVisibility = () => {
      s.visible = document.visibilityState === "visible";
      if (s.visible) kick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [kick]);

  function chooseAcademy(next: string) {
    setAcademy(next);
    const indices = certs
      .map((c, i) => (next === ALL || c.issuer === next ? i : -1))
      .filter((i) => i >= 0);
    if (compact) {
      showCurrent(indices[0] ?? 0);
      return;
    }
    if (next !== ALL) turnTo(phaseToFront(indices, count, motionState.current.phase));
  }

  /** Phones: bring one credential to the front. */
  function showCurrent(i: number) {
    setCurrent(i);
    turnTo(nearest(FRONT - baseAngle(i, count), motionState.current.phase));
  }

  function step(direction: 1 | -1) {
    const pool = certs.map((c, i) => (inAcademy(c) ? i : -1)).filter((i) => i >= 0);
    const at = Math.max(0, pool.indexOf(current));
    showCurrent(pool[(at + direction + pool.length) % pool.length]!);
  }

  function close() {
    const i = open;
    setOpen(null);
    if (i !== null) requestAnimationFrame(() => cards.current[i]?.focus());
  }

  // On phones the front credential is the one shown; keep it valid when the layout changes.
  useEffect(() => {
    if (compact) turnTo(nearest(FRONT - baseAngle(current, count), motionState.current.phase));
    // Only when the layout itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const initial = (i: number) => place(START + baseAngle(i, count), orbit);
  const activeName = academy === ALL ? "All academies" : academy;

  return (
    <div className="co" data-testid="credential-orbit">
      <p className="vault-eyebrow">
        <span className="text-accent">Credential orbit</span> {"//"} Certifications
      </p>
      <h3 className="display mt-3 text-[clamp(2rem,4vw,3.4rem)]">Certifications</h3>

      <div className="co-layout">
        <div className="co-academies" role="group" aria-label="Show credentials by academy">
          <p className="co-label" aria-hidden="true">
            Academies
          </p>
          {[{ issuer: ALL, count }, ...academies].map((a) => (
            <button
              key={a.issuer}
              type="button"
              className="co-academy"
              aria-pressed={academy === a.issuer}
              data-testid={a.issuer === ALL ? "orbit-academy-all" : "orbit-academy"}
              onClick={() => chooseAcademy(a.issuer)}
            >
              <span className="co-academy-mark" aria-hidden="true">
                {a.issuer === ALL ? "✦" : initials(a.issuer)}
              </span>
              <span className="co-academy-name">
                {a.issuer === ALL ? "All academies" : a.issuer}
              </span>
              <span className="co-academy-count">
                {a.count}
                <span className="sr-only">{a.count === 1 ? " certificate" : " certificates"}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="co-main">
          <div className="co-toolbar">
            <p className="co-status" role="status" data-testid="orbit-status">
              Showing {selected.length} of {count} credentials · {activeName}
            </p>
            {!reduced && !compact && (
              <button
                type="button"
                className="co-pause"
                aria-pressed={userPaused}
                data-testid="orbit-pause"
                onClick={() => setUserPaused((p) => !p)}
              >
                {userPaused ? "Resume orbit" : "Pause orbit"}
              </button>
            )}
          </div>

          <div
            ref={stage}
            className="co-stage"
            data-compact={compact || undefined}
            data-paused={paused || undefined}
            data-testid="orbit-stage"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") motionState.current.hover = true;
            }}
            onPointerLeave={() => {
              motionState.current.hover = false;
              kick();
            }}
            onFocus={() => {
              motionState.current.focus = true;
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                motionState.current.focus = false;
                kick();
              }
            }}
          >
            <div className="co-stars" aria-hidden="true">
              {STARS.map((star, i) => (
                <span
                  key={i}
                  data-big={star.big || undefined}
                  style={
                    {
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      animationDelay: `${star.d}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            <svg
              className="co-paths"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="co-streak" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
                  <stop offset="0.5" stopColor="var(--accent-strong)" />
                  <stop offset="1" stopColor="var(--blue)" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <ellipse
                className="co-ring co-ring-outer"
                cx={orbit.cx * 100}
                cy={orbit.cy * 100}
                rx={(orbit.rx + 0.05) * 100}
                ry={(orbit.ry + 0.05) * 100}
              />
              <ellipse
                className="co-ring"
                cx={orbit.cx * 100}
                cy={orbit.cy * 100}
                rx={orbit.rx * 100}
                ry={orbit.ry * 100}
              />
              <ellipse
                className="co-streak"
                cx={orbit.cx * 100}
                cy={orbit.cy * 100}
                rx={orbit.rx * 100}
                ry={orbit.ry * 100}
                pathLength={100}
              />
              {compact && (
                <line
                  className="co-link co-link-front"
                  x1={50}
                  y1={(orbit.cy + orbit.ry) * 100}
                  x2={50}
                  y2={64}
                />
              )}
              {!compact &&
                certs.map((cert, i) => {
                  const p = initial(i);
                  return (
                    <line
                      key={cert.course_name}
                      ref={(el) => {
                        links.current[i] = el;
                      }}
                      className="co-link"
                      data-dim={!inAcademy(cert) || undefined}
                      x1={p.nx * 100}
                      y1={p.ny * 100}
                      x2={p.x * 100}
                      y2={p.y * 100}
                    />
                  );
                })}
            </svg>

            <div className="co-core" aria-hidden="true">
              <p className="co-core-name">Nexus</p>
              <p className="co-core-sub">Credential system</p>
              <p className="co-core-count" data-testid="orbit-core-count">
                {academy === ALL ? count : `${selected.length}/${count}`}
              </p>
              <p className="co-core-sub">{academy === ALL ? "credentials" : academy}</p>
            </div>

            {certs.map((cert, i) => {
              const p = initial(i);
              return (
                <span
                  key={cert.course_name}
                  ref={(el) => {
                    nodes.current[i] = el;
                  }}
                  className="co-node"
                  data-dim={!inAcademy(cert) || undefined}
                  data-current={(compact && i === current) || undefined}
                  aria-hidden="true"
                  style={
                    {
                      "--x": (p.nx * 100).toFixed(3),
                      "--y": (p.ny * 100).toFixed(3),
                      zIndex: p.z,
                    } as React.CSSProperties
                  }
                />
              );
            })}

            {certs.map((cert, i) => {
              const hidden = compact && i !== current;
              return (
                <button
                  key={cert.course_name}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  type="button"
                  className="co-card"
                  style={cssVars(initial(i))}
                  data-dim={!inAcademy(cert) || undefined}
                  data-hot={(academy !== ALL && inAcademy(cert)) || undefined}
                  data-hidden={hidden || undefined}
                  tabIndex={hidden ? -1 : undefined}
                  aria-hidden={hidden || undefined}
                  data-testid="orbit-card"
                  onClick={() => setOpen(i)}
                >
                  <span className="co-card-id" aria-hidden="true">
                    <span className="co-card-mark">{initials(cert.issuer)}</span>
                    {pad(i + 1)}
                  </span>
                  <span className="co-card-title">{cert.course_name}</span>
                  <span className="co-card-issuer">
                    {cert.issuer}
                    {cert.completed_on && ` · ${cert.completed_on}`}
                  </span>
                  <span className="co-card-open" aria-hidden="true">
                    +
                  </span>
                  <span className="sr-only">: open credential record</span>
                </button>
              );
            })}

            <AnimatePresence>
              {open !== null && (
                <CredentialPanel
                  key={open}
                  cert={certs[open]!}
                  position={open + 1}
                  total={count}
                  onClose={close}
                />
              )}
            </AnimatePresence>
          </div>

          {compact && (
            <div className="co-stepper" role="group" aria-label="Browse credentials">
              <button
                type="button"
                className="co-step"
                data-testid="orbit-prev"
                onClick={() => step(-1)}
              >
                <span aria-hidden="true">←</span> Previous
              </button>
              <p className="co-step-count" aria-live="polite">
                {pad(current + 1)} / {pad(count)}
              </p>
              <button
                type="button"
                className="co-step"
                data-testid="orbit-next"
                onClick={() => step(1)}
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          <details className="disclosure co-list" data-testid="orbit-list">
            <summary>
              <span>View every credential as a list</span>
              <span className="disclosure-marker" aria-hidden="true" />
            </summary>
            <ol>
              {certs.map((cert, i) => (
                <li key={cert.course_name} data-dim={!inAcademy(cert) || undefined}>
                  <span className="co-list-index" aria-hidden="true">
                    {pad(i + 1)}
                  </span>
                  <span>
                    <span className="co-list-title">{cert.course_name}</span>
                    <span className="co-list-meta">
                      {cert.issuer}
                      {cert.completed_on && ` · ${cert.completed_on}`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}
