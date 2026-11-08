"use client";

import { motion, useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { createContext, useContext, useRef } from "react";
import { useSceneMode, useSmoothProgress, type SceneMode } from "@/hooks/useSceneMotion";
import { easeOutCubic } from "@/lib/motion";

/*
 * Scroll scenes: each major section is a presentation scene whose entrance and exit are bound
 * to the scroll position, so scrolling down plays a transition forward and scrolling up plays it
 * back. Nothing is time-based, nothing advances on its own, and wheel input is never captured.
 *
 * One progress value t drives a scene: 0 while its top edge sits at the bottom of the viewport,
 * 1 once it has settled, and 2 once its bottom edge has left through the top. The transformed
 * layer sits inside an untransformed host, so layout, fragment navigation and the observers that
 * track the active section all measure the real position.
 *
 * The server renders every scene at rest. Transforms apply only after hydration, never under
 * reduced motion, and phones get a short rise and fade instead of 3D, masks and horizontal travel.
 */

export type SceneVariant =
  "hero" | "unfold" | "lattice" | "circuit" | "lab" | "turn" | "stage" | "finale";

/** Values at t = 0 (entering from below), t = 1 (at rest) and t = 2 (leaving through the top). */
type Track = readonly [number, number, number];

interface Choreography {
  x?: Track;
  y?: Track;
  scale?: Track;
  rotateX?: Track;
  rotateY?: Track;
  opacity?: Track;
  /**
   * curtain: left and right insets in percent, opening from the centre.
   * window: side insets in percent plus a top inset, opening like a widescreen frame.
   * iris: circle radius in percent, from the bottom edge.
   */
  clip?: { kind: "curtain" | "window" | "iris"; track: Track };
  origin?: string;
  /** The entrance completes when the scene's top edge reaches this fraction of the viewport. */
  settle?: number;
  /** The exit begins when the scene's bottom edge reaches this fraction of the viewport. */
  leave?: number;
}

const FULL: Record<SceneVariant, Choreography> = {
  // Opens the page, so it has no entrance; it tilts back and recedes as the next scene arrives.
  hero: {
    y: [0, 0, -90],
    scale: [1, 1, 0.86],
    rotateX: [0, 0, 11],
    opacity: [1, 1, 0.15],
    origin: "50% 0%",
    leave: 1,
  },
  // A page lying back into the screen swings up on a top hinge.
  unfold: {
    y: [70, 0, -40],
    rotateX: [-26, 0, 0],
    scale: [1, 1, 0.97],
    opacity: [0.15, 1, 0.5],
    origin: "50% 0%",
  },
  // A curtain parts from the centre.
  lattice: {
    y: [40, 0, -40],
    scale: [1, 1, 0.97],
    opacity: [0.4, 1, 0.55],
    clip: { kind: "curtain", track: [50, 0, 0] },
  },
  // The network comes forward out of depth, like a board lifted towards the viewer.
  circuit: {
    y: [60, 0, -40],
    scale: [0.9, 1, 0.97],
    opacity: [0.1, 1, 0.55],
  },
  // The laboratory opens like a hatch: it swings up from a bottom hinge inside a narrowing frame.
  lab: {
    y: [120, 0, -40],
    rotateX: [16, 0, 0],
    scale: [0.92, 1, 0.97],
    opacity: [0.15, 1, 0.55],
    origin: "50% 100%",
    clip: { kind: "window", track: [8, 0, 0] },
  },
  // A page turns in on a left-hand hinge.
  turn: {
    x: [-60, 0, 0],
    y: [0, 0, -40],
    rotateY: [22, 0, 0],
    scale: [1, 1, 0.97],
    opacity: [0.2, 1, 0.55],
    origin: "0% 50%",
  },
  // The showcase opens like a widescreen frame while it rises and tilts up out of depth; the
  // cards then enter individually.
  stage: {
    y: [200, 0, -40],
    scale: [0.84, 1, 0.97],
    rotateX: [14, 0, 0],
    opacity: [0.15, 1, 0.6],
    origin: "50% 0%",
    clip: { kind: "window", track: [14, 0, 0] },
  },
  // The closing scene opens as an iris from the bottom edge.
  finale: {
    y: [60, 0, 0],
    opacity: [0.4, 1, 1],
    clip: { kind: "iris", track: [14, 150, 150] },
    settle: 0.6,
  },
};

const LITE: Record<SceneVariant, Choreography> = {
  hero: { opacity: [1, 1, 0.45], leave: 1 },
  unfold: { y: [40, 0, 0], opacity: [0.3, 1, 1] },
  lattice: { y: [40, 0, 0], opacity: [0.3, 1, 1] },
  circuit: { y: [40, 0, 0], opacity: [0.3, 1, 1] },
  lab: { y: [40, 0, 0], opacity: [0.3, 1, 1] },
  turn: { y: [40, 0, 0], opacity: [0.3, 1, 1] },
  stage: { y: [40, 0, 0], opacity: [0.3, 1, 1] },
  finale: { y: [40, 0, 0], opacity: [0.4, 1, 1], settle: 0.6 },
};

const CLIP_AT_REST = { curtain: 0, window: 0, iris: 150 } as const;

function at(track: Track | undefined, rest: number, t: number): number {
  if (!track) return rest;
  const [from, mid, to] = track;
  if (t <= 1) return from + (mid - from) * easeOutCubic(t);
  return mid + (to - mid) * Math.min(1, t - 1);
}

function clipPath(variant: SceneVariant, mode: SceneMode, t: number): string {
  const clip = FULL[variant].clip;
  if (!clip) return "none";
  const v = mode === "full" ? at(clip.track, 0, t) : CLIP_AT_REST[clip.kind];
  if (clip.kind === "curtain") return `inset(0% ${v}% 0% ${v}% round ${Math.min(v * 1.2, 28)}px)`;
  // Top inset in pixels: a percentage of a very tall section would hide what is on screen.
  if (clip.kind === "window")
    return `inset(${v * 6}px ${v}% 0% ${v}% round ${Math.min(v * 3, 36)}px)`;
  return `circle(${v}% at 50% 100%)`;
}

interface SceneContextValue {
  t: MotionValue<number>;
  mode: SceneMode;
}

const SceneContext = createContext<SceneContextValue | null>(null);

export function Scene({
  variant,
  className,
  children,
}: {
  variant: SceneVariant;
  className?: string;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  // Transform functions read the mode from this render: Motion re-evaluates them on every
  // render before paint, so a mode change (hydration, crossing the phone breakpoint) never shows
  // a frame of the other choreography.
  const mode = useSceneMode();
  const { settle = 0.35, leave = 0.6 } = FULL[variant];

  const enter = useScroll({ target: host, offset: ["start end", `start ${settle}`] });
  const exit = useScroll({ target: host, offset: [`end ${leave}`, "end start"] });
  const raw = useTransform(() => enter.scrollYProgress.get() + exit.scrollYProgress.get());
  const t = useSmoothProgress(raw);

  const pick = () => (mode === "lite" ? LITE : FULL)[variant];
  const x = useTransform(() => at(pick().x, 0, t.get()));
  const y = useTransform(() => at(pick().y, 0, t.get()));
  const scale = useTransform(() => at(pick().scale, 1, t.get()));
  const rotateX = useTransform(() => at(pick().rotateX, 0, t.get()));
  const rotateY = useTransform(() => at(pick().rotateY, 0, t.get()));
  const opacity = useTransform(() => at(pick().opacity, 1, t.get()));
  const clip = useTransform(() => clipPath(variant, mode, t.get()));

  const style =
    mode !== "off"
      ? {
          x,
          y,
          scale,
          rotateX,
          rotateY,
          opacity,
          transformPerspective: 1600,
          transformOrigin: FULL[variant].origin ?? "50% 50%",
          ...(FULL[variant].clip ? { clipPath: clip } : {}),
        }
      : undefined;

  return (
    <div ref={host} className="scene" data-scene={variant}>
      <motion.div className={className} style={style}>
        <SceneContext.Provider value={{ t, mode }}>{children}</SceneContext.Provider>
      </motion.div>
    </div>
  );
}

type ItemEntry = "below" | "left" | "right" | "mask";

/**
 * One beat in a scene's sequence. Items enter in `order` during the scene's entrance, from the
 * given direction ("mask" rises out of a clipping window), and reverse when scrolling back up.
 * Outside a Scene, or when the scene is at rest, the item renders as a plain block.
 */
export function SceneItem({
  order = 0,
  from = "below",
  className,
  children,
}: {
  order?: number;
  from?: ItemEntry;
  className?: string;
  children: React.ReactNode;
}) {
  const scene = useContext(SceneContext);
  const idle = useMotionValue(1);
  const t = scene?.t ?? idle;
  const mode = scene?.mode ?? "off";

  const start = 0.06 + order * 0.15;
  const end = Math.min(0.92, start + 0.45);
  const p = useTransform(() =>
    easeOutCubic(Math.min(1, Math.max(0, (t.get() - start) / (end - start)))),
  );
  const lite = () => mode === "lite";
  const travel = () =>
    lite() || from === "below" || from === "mask" ? 0 : from === "left" ? -80 : 80;
  const x = useTransform(() => travel() * (1 - p.get()));
  const y = useTransform(
    () => (lite() ? 24 : from === "mask" ? 36 : from === "below" ? 48 : 0) * (1 - p.get()),
  );
  const opacity = useTransform(() => (from === "mask" && !lite() ? 1 : p.get()));
  const clip = useTransform(() =>
    lite() ? "inset(0% 0% 0% 0%)" : `inset(0% 0% ${(1 - p.get()) * 100}% 0%)`,
  );

  const style =
    mode !== "off" ? { x, y, opacity, ...(from === "mask" ? { clipPath: clip } : {}) } : undefined;

  return (
    <motion.div className={className} style={style}>
      {children}
    </motion.div>
  );
}
