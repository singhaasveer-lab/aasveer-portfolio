"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMedia } from "@/hooks/useSceneMotion";
import { EASE_OUT } from "@/lib/motion";
import type { PublicCertification } from "@/lib/validation/schemas";
import type { Frame, SpaceEngine } from "./engine";
import {
  COMPACT,
  FRONT,
  TAU,
  WIDE,
  coreZone,
  credentialPlacement,
  fittedEye,
  layoutTags,
  nearness,
  orbitPoint,
  project,
  tagSize,
  type SpaceLayout,
  type View,
} from "./model";

const ALL = "all";
const pad = (n: number) => String(n).padStart(2, "0");
/** Pixels the docked inspector covers on wide stages: its width and its margin (see space.css). */
const INSPECTOR_INSET = 418;
/** The stage size assumed for the server render, before it can be measured. */
const ASSUMED = { width: 1000, height: 640 };

const initials = (issuer: string) =>
  issuer
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

/** Titles longer than this may wrap past two lines; the full title then shows on hover. */
const LONG_TITLE = 40;

const isImage = (url: string) => /\.(png|jpe?g|webp|avif|gif)$/i.test(url);

type Renderer = "static" | "webgl" | "fallback";
type Rect = { x: number; y: number; width: number; height: number };
const noop = () => () => {};

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The model's own frame: the server render, the no-WebGL fallback, and the first frame. */
function staticFrame(layout: SpaceLayout, count: number, width: number, height: number): Frame {
  const view: View = {
    eye: fittedEye(layout, width, height),
    target: layout.camera.target,
    fov: layout.camera.fov,
    aspect: width / height,
  };
  const marks = Array.from({ length: count }, (_, i) =>
    project(credentialPlacement(layout, i, count, FRONT).marker, view),
  );
  const depths = marks.map((m) => m.depth);
  const nearest = Math.min(...depths);
  const farthest = Math.max(...depths);
  const zone = coreZone(layout, (point) => project(point, view), width, height);
  const core = zone.centre;
  const tags = layoutTags(layout, marks, zone.orbit, zone.safe, width, height);
  return {
    items: tags.map((t, i) => ({
      x: t.x / width,
      y: t.y / height,
      mx: marks[i]!.x,
      my: marks[i]!.y,
      near: nearness(depths[i]!, nearest, farthest),
      visible: marks[i]!.visible,
    })),
    core,
  };
}

/** An orbit drawn as a projected path, for the fallback and the moment before WebGL loads. */
function orbitPath(
  layout: SpaceLayout,
  orbit: SpaceLayout["primary"],
  width: number,
  height: number,
) {
  const view: View = {
    eye: fittedEye(layout, width, height),
    target: layout.camera.target,
    fov: layout.camera.fov,
    aspect: width / height,
  };
  let d = "";
  for (let k = 0; k <= 120; k++) {
    const p = project(orbitPoint(orbit, (k / 120) * TAU), view);
    d += `${k ? "L" : "M"}${(p.x * 100).toFixed(2)} ${(p.y * 100).toFixed(2)}`;
  }
  return d;
}

const tagStyle = (item: Frame["items"][number]) =>
  ({
    "--x": (item.x * 100).toFixed(3),
    "--y": (item.y * 100).toFixed(3),
    "--near": item.near.toFixed(3),
    zIndex: Math.round(10 + item.near * 80),
  }) as React.CSSProperties;

/** The Credential Inspector. It expands from the certificate's tag, then shows verified data. */
function Inspector({
  cert,
  position,
  total,
  origin,
  reduced,
  docked,
  onClose,
}: {
  cert: PublicCertification;
  position: number;
  total: number;
  origin: Rect | null;
  reduced: boolean;
  docked: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const file = cert.certificate_url;

  // Shared-element transition: start at the tag's box, settle into the inspector with a spring.
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    heading.current?.focus({ preventScroll: !docked });
    if (reduced || !origin || !docked) return;
    const box = element.getBoundingClientRect();
    const stage = element.offsetParent?.getBoundingClientRect();
    if (!stage || box.width === 0) return;
    element.style.transformOrigin = "0 0";
    const controls = animate(
      element,
      {
        x: [origin.x - (box.left - stage.left), 0],
        y: [origin.y - (box.top - stage.top), 0],
        scaleX: [origin.width / box.width, 1],
        scaleY: [origin.height / box.height, 1],
        opacity: [0.4, 1],
      },
      { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
    );
    element
      .querySelectorAll<HTMLElement>("[data-reveal]")
      .forEach((el, i) =>
        animate(
          el,
          { opacity: [0, 1], y: [8, 0] },
          { delay: 0.12 + i * 0.04, duration: 0.3, ease: EASE_OUT },
        ),
      );
    return () => controls.stop();
  }, [origin, reduced, docked]);

  return (
    <motion.section
      ref={panel}
      className="co-panel cs-panel"
      data-docked={docked || undefined}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-testid="orbit-panel"
      initial={docked || reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, x: docked ? 24 : 0, transition: { duration: 0.22 } }
      }
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="co-panel-bar" data-reveal>
        <span>Credential inspector</span>
        <span>
          {pad(position)} / {pad(total)}
        </span>
      </div>
      <h4 id={titleId} ref={heading} tabIndex={-1} className="co-panel-title" data-reveal>
        {cert.course_name}
      </h4>
      <dl className="co-panel-facts" data-reveal>
        <div>
          <dt>Issuing academy</dt>
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
          data-reveal
        />
      )}
      {(file || cert.credential_url) && (
        <div className="co-panel-actions" data-reveal>
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
      )}
      {!file && !cert.credential_url && (
        <p className="co-panel-note" data-testid="orbit-no-document" data-reveal>
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
 * Credential Orbit 3.0, a spatial credential environment. A WebGL scene (engine.ts, loaded only
 * as the section approaches) draws the orbital system with a compact marker for each certificate.
 * This component owns everything a visitor reads or presses: the academy selector, a small tag
 * for each marker (its title appears on hover or focus), the Credential Inspector beside the
 * scene, and a plain list. Without WebGL the same layout is drawn from the shared model.
 */
export function CredentialSpace({ certifications }: { certifications: PublicCertification[] }) {
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
  const [highlight, setHighlight] = useState<number | null>(null);
  const [origin, setOrigin] = useState<Rect | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [renderer, setRenderer] = useState<Renderer>("static");
  const [entered, setEntered] = useState(false);
  const [size, setSize] = useState(ASSUMED);
  const reduced = useMedia("(prefers-reduced-motion: reduce)", false);
  const compact = useMedia("(max-width: 767px)", false);
  /** True once hydrated: only then may the entrance hide anything, so no-JS readers see it all. */
  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const layout = compact ? COMPACT : WIDE;

  const stage = useRef<HTMLDivElement>(null);
  const tags = useRef<(HTMLButtonElement | null)[]>([]);
  const engine = useRef<SpaceEngine | null>(null);
  const links = useRef<(SVGLineElement | null)[]>([]);
  const geometry = useRef({
    layout: WIDE as SpaceLayout,
    width: ASSUMED.width,
    height: ASSUMED.height,
  });
  const [hovered, setHovered] = useState<number | null>(null);
  const holding = useRef({ hover: false, focus: false });

  const inAcademy = (cert: PublicCertification) => academy === ALL || cert.issuer === academy;
  const selected = certs.filter(inAcademy);
  const hot = academy === ALL ? null : certs.map((c) => c.issuer === academy);
  const initial = useMemo(
    () => staticFrame(layout, count, size.width, size.height),
    [layout, count, size],
  );

  /** Writes a frame's positions straight to the tags: no React render per frame. */
  const applyFrame = useCallback((frame: Frame) => {
    frame.items.forEach((item, i) => {
      const tag = tags.current[i];
      if (!tag) return;
      tag.style.setProperty("--x", (item.x * 100).toFixed(3));
      tag.style.setProperty("--y", (item.y * 100).toFixed(3));
      tag.style.setProperty("--near", item.near.toFixed(3));
      tag.style.zIndex = String(Math.round(10 + item.near * 80));
      tag.toggleAttribute("data-offscreen", !item.visible);
      // The title preview opens away from the nearest edge.
      tag.dataset.flip = item.y < 0.24 ? "below" : "above";
      tag.dataset.align = item.x < 0.22 ? "start" : item.x > 0.78 ? "end" : "center";
      // The connector: from the marker to the nearest point of its label.
      const link = links.current[i];
      if (link) {
        const { layout, width, height } = geometry.current;
        const size = tagSize(layout, width);
        const hw = size.width / 2 / width;
        const hh = size.height / 2 / height;
        const ex = Math.min(Math.max(item.mx, item.x - hw), item.x + hw);
        const ey = Math.min(Math.max(item.my, item.y - hh), item.y + hh);
        link.setAttribute("x1", (item.mx * 100).toFixed(3));
        link.setAttribute("y1", (item.my * 100).toFixed(3));
        link.setAttribute("x2", (ex * 100).toFixed(3));
        link.setAttribute("y2", (ey * 100).toFixed(3));
        link.toggleAttribute("data-offscreen", !item.visible);
      }
    });
  }, []);

  // The label geometry the per-frame callback reads.
  useLayoutEffect(() => {
    geometry.current = { layout, width: size.width, height: size.height };
  }, [layout, size]);

  const setHolding = useCallback(() => {
    const { hover, focus } = holding.current;
    engine.current?.update({ holding: hover || focus });
  }, []);

  // Measure the stage, so framing and the fallback match its real size.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setSize({
        width: Math.max(1, element.clientWidth),
        height: Math.max(1, element.clientHeight),
      });
      engine.current?.resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Load the WebGL scene only as the section approaches the viewport, and only where it can run.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let cancelled = false;
    let created: SpaceEngine | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (!supportsWebGL()) {
          setRenderer("fallback");
          return;
        }
        void import("./engine").then(({ createSpace }) => {
          if (cancelled) return;
          created = createSpace({
            host: element,
            layout,
            count,
            reduced,
            compact,
            onFrame: applyFrame,
            onLost: () => {
              created?.dispose();
              engine.current = null;
              setRenderer("fallback");
            },
          });
          if (!created) {
            setRenderer("fallback");
            return;
          }
          engine.current = created;
          (element as HTMLElement & { spaceDebug?: () => unknown }).spaceDebug = () =>
            created?.debug();
          setRenderer("webgl");
        });
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      created?.dispose();
      engine.current = null;
      setRenderer("static");
    };
  }, [layout, count, reduced, compact, applyFrame]);

  // The cinematic entrance begins once the stage is properly in view; frames stop off screen.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const enter = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setEntered(true);
          engine.current?.enter();
        }
      },
      { threshold: 0.3 },
    );
    const view = new IntersectionObserver(([entry]) =>
      engine.current?.setVisible(!!entry?.isIntersecting && document.visibilityState === "visible"),
    );
    enter.observe(element);
    view.observe(element);
    const onVisibility = () => engine.current?.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      enter.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [renderer]);

  // Send the visitor's choices to the scene.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (entered) e.enter();
    e.update({
      hot,
      selected: open,
      highlight,
      paused: userPaused,
      inset: compact ? 0 : INSPECTOR_INSET,
    });
    // `hot` is derived from `academy`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academy, open, highlight, userPaused, renderer, entered, compact]);

  // Without the engine, tags sit where the model places them.
  useEffect(() => {
    if (renderer !== "webgl") applyFrame(initial);
  }, [renderer, initial, applyFrame]);

  function inspect(i: number) {
    const tag = tags.current[i];
    const box = stage.current?.getBoundingClientRect();
    const rect = tag?.getBoundingClientRect();
    setOrigin(
      box && rect
        ? { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height }
        : null,
    );
    setOpen(i);
    setHighlight(i);
  }

  function close() {
    const i = open;
    setOpen(null);
    if (i !== null) requestAnimationFrame(() => tags.current[i]?.focus());
  }

  const inspector = open !== null && (
    <Inspector
      key={open}
      cert={certs[open]!}
      position={open + 1}
      total={count}
      origin={origin}
      reduced={reduced}
      docked={!compact}
      onClose={close}
    />
  );

  return (
    <div
      className="co cs"
      data-testid="credential-orbit"
      data-ready={(ready && !reduced) || undefined}
      data-entered={entered || undefined}
    >
      <p className="vault-eyebrow cs-intro">
        <span className="text-accent">Credential orbit</span> {"//"} Spatial credential environment
      </p>
      <h3 className="display mt-3 text-[clamp(2rem,4vw,3.4rem)] cs-intro">Certifications</h3>

      <div className="co-layout cs-layout">
        <div
          className="co-academies cs-academies"
          role="group"
          aria-label="Show credentials by academy"
        >
          <p className="co-label" aria-hidden="true">
            Academies
          </p>
          {[{ issuer: ALL, count }, ...academies].map((a, k) => (
            <button
              key={a.issuer}
              type="button"
              className="co-academy"
              style={{ "--k": k } as React.CSSProperties}
              aria-pressed={academy === a.issuer}
              data-testid={a.issuer === ALL ? "orbit-academy-all" : "orbit-academy"}
              onClick={() => setAcademy(a.issuer)}
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
          <div className="co-toolbar cs-toolbar">
            <p className="co-status" role="status" data-testid="orbit-status">
              Showing {selected.length} of {count} credentials ·{" "}
              {academy === ALL ? "All academies" : academy}
            </p>
            {!reduced && (
              <button
                type="button"
                className="co-pause"
                aria-pressed={userPaused}
                data-testid="orbit-pause"
                onClick={() => setUserPaused((p) => !p)}
              >
                {userPaused ? "Resume motion" : "Pause motion"}
              </button>
            )}
          </div>

          <div
            ref={stage}
            className="cs-stage"
            data-compact={compact || undefined}
            data-renderer={renderer}
            data-inspecting={open !== null || undefined}
            data-testid="orbit-stage"
            onPointerMove={(event) => {
              if (event.pointerType !== "mouse") return;
              const box = event.currentTarget.getBoundingClientRect();
              engine.current?.setPointer(
                ((event.clientX - box.left) / box.width) * 2 - 1,
                ((event.clientY - box.top) / box.height) * 2 - 1,
                true,
              );
            }}
            onPointerLeave={() => engine.current?.setPointer(0, 0, false)}
            onFocus={() => {
              holding.current.focus = true;
              setHolding();
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                holding.current.focus = false;
                setHolding();
              }
            }}
          >
            {/* The model's view of the system: before WebGL loads, and wherever it cannot. */}
            <svg
              className="cs-fallback"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {layout.secondary.map((orbit, k) => (
                <path
                  key={k}
                  className="cs-fallback-track"
                  d={orbitPath(layout, orbit, size.width, size.height)}
                />
              ))}
              <path
                className="cs-fallback-primary"
                d={orbitPath(layout, layout.primary, size.width, size.height)}
              />
            </svg>

            {!compact && (
              <svg
                className="cs-links"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {certs.map((cert, i) => (
                  <line
                    key={cert.course_name}
                    ref={(el) => {
                      links.current[i] = el;
                    }}
                    x1={(initial.items[i]!.mx * 100).toFixed(3)}
                    y1={(initial.items[i]!.my * 100).toFixed(3)}
                    x2={(initial.items[i]!.x * 100).toFixed(3)}
                    y2={(initial.items[i]!.y * 100).toFixed(3)}
                    data-dim={(academy !== ALL && !inAcademy(cert)) || undefined}
                    data-hot={(academy !== ALL && inAcademy(cert)) || highlight === i || undefined}
                    data-hover={hovered === i || undefined}
                  />
                ))}
              </svg>
            )}

            {certs.map((cert, i) => (
              <button
                key={cert.course_name}
                ref={(el) => {
                  tags.current[i] = el;
                }}
                type="button"
                className="cs-tag"
                style={{ ...tagStyle(initial.items[i]!), "--k": i } as React.CSSProperties}
                // The name holds the visible text in reading order (number, title, academy), then the action.
                aria-label={`${initials(cert.issuer)} ${pad(i + 1)} ${cert.course_name} ${cert.issuer}, open the credential inspector`}
                data-dim={(academy !== ALL && !inAcademy(cert)) || undefined}
                data-hot={(academy !== ALL && inAcademy(cert)) || undefined}
                data-selected={highlight === i || undefined}
                data-labelled={!compact || undefined}
                data-long={cert.course_name.length > LONG_TITLE || undefined}
                data-testid="orbit-card"
                onPointerEnter={(event) => {
                  if (event.pointerType !== "mouse") return;
                  holding.current.hover = true;
                  engine.current?.update({ hovered: i });
                  setHovered(i);
                  setHolding();
                }}
                onPointerLeave={() => {
                  holding.current.hover = false;
                  engine.current?.update({ hovered: null });
                  setHovered(null);
                  setHolding();
                }}
                onFocus={() => {
                  engine.current?.update({ hovered: i });
                  setHovered(i);
                }}
                onBlur={() => {
                  engine.current?.update({ hovered: null });
                  setHovered(null);
                }}
                onClick={() => inspect(i)}
              >
                <span className="cs-tag-code">
                  <span className="cs-tag-mark" aria-hidden="true">
                    {initials(cert.issuer)}
                  </span>{" "}
                  <span className="cs-tag-id" aria-hidden="true">
                    {pad(i + 1)}
                  </span>
                </span>{" "}
                {!compact && (
                  <span className="cs-tag-title" data-testid="orbit-name">
                    {cert.course_name}
                  </span>
                )}{" "}
                <span className="cs-preview" aria-hidden="true" data-testid="orbit-preview">
                  <span className="cs-preview-title">{cert.course_name}</span>{" "}
                  <span className="cs-preview-issuer">{cert.issuer}</span>
                </span>
              </button>
            ))}

            <AnimatePresence>{!compact && inspector}</AnimatePresence>
          </div>

          {compact && (
            <ol className="cs-names" aria-label="Certificates" data-testid="orbit-names">
              {certs.map((cert, i) => (
                <li key={cert.course_name}>
                  <button
                    type="button"
                    className="cs-name"
                    data-dim={(academy !== ALL && !inAcademy(cert)) || undefined}
                    data-hot={(academy !== ALL && inAcademy(cert)) || undefined}
                    data-selected={highlight === i || undefined}
                    onClick={() => inspect(i)}
                  >
                    <span className="cs-name-code">
                      {initials(cert.issuer)} {pad(i + 1)}
                    </span>{" "}
                    <span className="cs-name-title">{cert.course_name}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}

          {/* Phones: the inspector stacks under the scene. */}
          <AnimatePresence>{compact && inspector}</AnimatePresence>

          <details
            className="disclosure co-list"
            data-testid="orbit-list"
            hidden={compact || undefined}
          >
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
