"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { createContext, useContext, useRef } from "react";
import { useFinePointer } from "@/hooks/useFinePointer";

interface HeroPointer {
  /** False on touch screens and under reduced motion: every layer then stays at rest. */
  enabled: boolean;
  /** Spring-smoothed position from -1 to 1 across the hero. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** Raw position in pixels within the hero, and whether the pointer is inside it. */
  px: MotionValue<number>;
  py: MotionValue<number>;
  inside: MotionValue<number>;
}

const HeroContext = createContext<HeroPointer | null>(null);

function useHeroPointer() {
  const pointer = useContext(HeroContext);
  if (!pointer) throw new Error("Hero layers must be used inside HeroMotion");
  return pointer;
}

export { useHeroPointer };

const SPRING = { stiffness: 56, damping: 19, mass: 0.75 };

/**
 * The hero's pointer system. One listener writes motion values, and every layer reads those
 * through its own transform, so a pointer move causes no React render. Pointer position is only
 * tracked inside the hero, and the hero's size is measured when the pointer enters, not per move.
 */
export function HeroMotion({
  id,
  labelledBy,
  children,
}: {
  id: string;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const enabled = useFinePointer();
  const rect = useRef<DOMRect | null>(null);

  const nx = useMotionValue(0);
  const ny = useMotionValue(0);
  const px = useMotionValue(-9999);
  const py = useMotionValue(-9999);
  const inside = useMotionValue(0);
  const x = useSpring(nx, SPRING);
  const y = useSpring(ny, SPRING);

  function track(event: React.PointerEvent<HTMLElement>) {
    if (!enabled || event.pointerType !== "mouse") return;
    rect.current ??= event.currentTarget.getBoundingClientRect();
    const { left, top, width, height } = rect.current;
    const cx = event.clientX - left;
    const cy = event.clientY - top;
    px.set(cx);
    py.set(cy);
    nx.set(width > 0 ? (cx / width) * 2 - 1 : 0);
    ny.set(height > 0 ? (cy / height) * 2 - 1 : 0);
    inside.set(1);
  }

  return (
    <section
      id={id}
      className="hero"
      aria-labelledby={labelledBy}
      data-testid="hero"
      onPointerEnter={(event) => {
        rect.current = event.currentTarget.getBoundingClientRect();
      }}
      onPointerMove={track}
      onPointerLeave={() => {
        nx.set(0);
        ny.set(0);
        inside.set(0);
      }}
    >
      <HeroContext.Provider value={{ enabled, x, y, px, py, inside }}>
        {children}
      </HeroContext.Provider>
    </section>
  );
}

/** A plane of the hero: it shifts with the pointer by `depth` pixels, in the direction given. */
export function HeroLayer({
  depth,
  className,
  children,
}: {
  depth: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const { enabled, x, y } = useHeroPointer();
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth * 0.7);
  return (
    <motion.div className={className} style={enabled ? { x: tx, y: ty } : undefined}>
      {children}
    </motion.div>
  );
}

/** Soft light that travels with the pointer, a little behind it, across the neural field. */
export function HeroLight() {
  const { enabled, px, py, inside } = useHeroPointer();
  const lx = useSpring(px, { stiffness: 42, damping: 20 });
  const ly = useSpring(py, { stiffness: 42, damping: 20 });
  const opacity = useSpring(inside, { stiffness: 60, damping: 20 });
  const background = useMotionTemplate`radial-gradient(460px 340px at ${lx}px ${ly}px, rgb(63 213 245 / 0.07), rgb(77 124 255 / 0.03) 48%, transparent 72%)`;
  if (!enabled) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="hero-light"
      data-testid="hero-light"
      style={{ background, opacity }}
    />
  );
}
