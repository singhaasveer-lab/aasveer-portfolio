"use client";

import { motion, useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { createContext, useContext, useRef } from "react";
import { useSceneMode, useSmoothProgress, type SceneMode } from "@/hooks/useSceneMotion";
import { easeOutCubic } from "@/lib/motion";

/*
 * An entrance bound to the element's own scroll position: it plays forward as the element rises
 * from the bottom of the viewport and plays back when scrolling up. Used where items arrive one
 * by one (project cards, skill rows), so each keeps its own timing however tall the section is.
 * The server renders every item at rest; see Scene.tsx for the shared rules.
 */

export type RevealPreset = "rise" | "left" | "right" | "rise-3d" | "swing-left" | "swing-right";

interface From {
  x?: number;
  y?: number;
  scale?: number;
  rotateX?: number;
  rotateY?: number;
  opacity: number;
  origin?: string;
}

const PRESETS: Record<RevealPreset, From> = {
  rise: { y: 60, opacity: 0 },
  left: { x: -90, opacity: 0 },
  right: { x: 90, opacity: 0 },
  // Stands up from a bottom hinge while rising out of depth.
  "rise-3d": { y: 120, rotateX: 22, scale: 0.94, opacity: 0, origin: "50% 100%" },
  // Swings in from the side on an outer hinge.
  "swing-left": { x: -140, rotateY: 24, scale: 0.96, opacity: 0, origin: "0% 50%" },
  "swing-right": { x: 140, rotateY: -24, scale: 0.96, opacity: 0, origin: "100% 50%" },
};

const LITE: From = { y: 32, opacity: 0 };

type Tag = "div" | "li";

/** Lets content inside a reveal enter in its own sequence (RevealBeat). */
const RevealContext = createContext<{
  p: MotionValue<number>;
  mode: SceneMode;
  side: -1 | 0 | 1;
} | null>(null);

const SIDE: Record<RevealPreset, -1 | 0 | 1> = {
  rise: 0,
  "rise-3d": 0,
  left: -1,
  "swing-left": -1,
  right: 1,
  "swing-right": 1,
};

export function ScrollReveal({
  preset = "rise",
  as = "div",
  className,
  children,
  ...data
}: {
  preset?: RevealPreset;
  as?: Tag;
  className?: string;
  children: React.ReactNode;
} & Record<`data-${string}`, string>) {
  const ref = useRef<HTMLElement>(null);
  // Read from this render, not a motion value: see Scene.tsx.
  const mode = useSceneMode();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.62"] });
  const progress = useSmoothProgress(scrollYProgress);
  const p = useTransform(() => easeOutCubic(progress.get()));

  const from = () => (mode === "lite" ? LITE : PRESETS[preset]);
  const x = useTransform(() => (from().x ?? 0) * (1 - p.get()));
  const y = useTransform(() => (from().y ?? 0) * (1 - p.get()));
  const scale = useTransform(() => 1 - (1 - (from().scale ?? 1)) * (1 - p.get()));
  const rotateX = useTransform(() => (from().rotateX ?? 0) * (1 - p.get()));
  const rotateY = useTransform(() => (from().rotateY ?? 0) * (1 - p.get()));
  const opacity = useTransform(() => from().opacity + (1 - from().opacity) * p.get());

  const style =
    mode !== "off"
      ? {
          x,
          y,
          scale,
          rotateX,
          rotateY,
          opacity,
          transformPerspective: 1400,
          transformOrigin: PRESETS[preset].origin ?? "50% 50%",
        }
      : undefined;

  const Component = motion[as] as typeof motion.div;
  return (
    <Component ref={ref as React.Ref<HTMLDivElement>} className={className} style={style} {...data}>
      <RevealContext.Provider value={{ p: progress, mode, side: SIDE[preset] }}>
        {children}
      </RevealContext.Provider>
    </Component>
  );
}

/**
 * One beat inside a ScrollReveal: it trails the container's entrance by `order` steps and slides
 * in from the container's own side (or rises, for centred entrances). Plain block when at rest.
 */
export function RevealBeat({
  order,
  className,
  children,
}: {
  order: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reveal = useContext(RevealContext);
  const idle = useMotionValue(1);
  const progress = reveal?.p ?? idle;
  const mode = reveal?.mode ?? "off";
  const side = reveal?.side ?? 0;
  const start = 0.18 + order * 0.11;
  const local = useTransform(() =>
    easeOutCubic(Math.min(1, Math.max(0, (progress.get() - start) / 0.42))),
  );
  const x = useTransform(() => (mode === "full" ? side * 56 : 0) * (1 - local.get()));
  const y = useTransform(() => (mode === "full" && side !== 0 ? 0 : 24) * (1 - local.get()));
  const opacity = useTransform(() => 0.05 + 0.95 * local.get());
  return (
    <motion.div className={className} style={mode !== "off" ? { x, y, opacity } : undefined}>
      {children}
    </motion.div>
  );
}
