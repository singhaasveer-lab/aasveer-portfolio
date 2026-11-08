"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useSceneMode } from "@/hooks/useSceneMotion";

/** Grid cell and mesh tile sizes; layers wrap by one tile so they can travel forever. */
const GRID = 96;
const MESH = 480;

/** One tile of the vector field: short strokes whose direction varies smoothly across it. */
const FIELD_W = 480;
const FIELD_H = 360;
const FIELD_PATH = Array.from({ length: 12 * 9 }, (_, i) => {
  const x = (i % 12) * 40 + 20;
  const y = Math.floor(i / 12) * 40 + 20;
  const angle = Math.sin((x / FIELD_W) * Math.PI * 2) + Math.cos((y / FIELD_H) * Math.PI * 2);
  const dx = Math.round(Math.cos(angle) * 70) / 10;
  const dy = Math.round(Math.sin(angle) * 70) / 10;
  return `M${x - dx} ${y - dy}L${x + dx} ${y + dy}`;
}).join("");

/**
 * Fixed, decorative depth behind every scene: a computational grid, a vector field and a sparse
 * neural mesh that travel at different fractions of the scroll speed, so foreground content and
 * the layers behind it read as separate planes. It fades in once the hero (which has its own grid) starts to leave, and only runs
 * on larger screens with motion allowed; otherwise it stays hidden.
 */
export function SceneBackdrop() {
  const mode = useSceneMode();
  const { scrollY } = useScroll();
  const gridY = useTransform(() => -((scrollY.get() * 0.12) % GRID));
  const fieldY = useTransform(() => -((scrollY.get() * 0.2) % FIELD_H));
  const meshY = useTransform(() => -((scrollY.get() * 0.3) % MESH));
  const opacity = useTransform(() => {
    const vh = typeof window === "undefined" ? 1 : window.innerHeight;
    return Math.min(1, Math.max(0, (scrollY.get() - vh * 0.25) / (vh * 0.6)));
  });
  const live = mode === "full";

  return (
    <motion.div
      aria-hidden="true"
      className="scene-backdrop"
      style={live ? { opacity } : undefined}
    >
      <motion.div className="scene-grid" style={live ? { y: gridY } : undefined} />
      <motion.div className="scene-field" style={live ? { y: fieldY } : undefined}>
        <svg>
          <defs>
            <pattern
              id="vector-field"
              width={FIELD_W}
              height={FIELD_H}
              patternUnits="userSpaceOnUse"
            >
              <path d={FIELD_PATH} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vector-field)" />
        </svg>
      </motion.div>
      <motion.div className="scene-mesh" style={live ? { y: meshY } : undefined} />
    </motion.div>
  );
}

/** A decorative layer that drifts with the page at `speed` times the scroll distance. */
export function Parallax({ speed, className }: { speed: number; className: string }) {
  const mode = useSceneMode();
  const { scrollY } = useScroll();
  const y = useTransform(() => scrollY.get() * speed);
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={mode === "full" ? { y } : undefined}
    />
  );
}
