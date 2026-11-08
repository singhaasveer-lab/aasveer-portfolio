"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { useSceneMode, useSmoothProgress } from "@/hooks/useSceneMotion";

/*
 * Decorative signal paths drawn by scrolling: each connection extends as the section moves
 * through the viewport and retracts when scrolling back. Without motion the diagram is shown
 * complete. aria-hidden; shown on large screens only.
 */

type Point = readonly [number, number];

/** A small feed-forward network: four inputs, five hidden units, three outputs. */
const LATTICE = (() => {
  const layers: Point[][] = [
    [0, 1, 2, 3].map((i) => [40, 60 + i * 60] as const),
    [0, 1, 2, 3, 4].map((i) => [200, 30 + i * 60] as const),
    [0, 1, 2].map((i) => [360, 90 + i * 60] as const),
  ];
  const pairs: [Point, Point][] = [
    [layers[0]![0]!, layers[1]![0]!],
    [layers[0]![0]!, layers[1]![2]!],
    [layers[0]![1]!, layers[1]![1]!],
    [layers[0]![1]!, layers[1]![3]!],
    [layers[0]![2]!, layers[1]![2]!],
    [layers[0]![2]!, layers[1]![4]!],
    [layers[0]![3]!, layers[1]![3]!],
    [layers[1]![0]!, layers[2]![0]!],
    [layers[1]![1]!, layers[2]![0]!],
    [layers[1]![2]!, layers[2]![1]!],
    [layers[1]![3]!, layers[2]![1]!],
    [layers[1]![3]!, layers[2]![2]!],
    [layers[1]![4]!, layers[2]![2]!],
  ];
  return { nodes: layers.flat(), pairs };
})();

/** Six incoming signals converging on one point. */
const CONVERGE = (() => {
  const target: Point = [340, 150];
  const sources: Point[] = [0, 1, 2, 3, 4, 5].map((i) => [0, 20 + i * 52] as const);
  return { nodes: [...sources.map(([, y]) => [12, y] as const), target], target, sources };
})();

const curve = ([x1, y1]: Point, [x2, y2]: Point) => {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

function TracePath({
  d,
  progress,
  start,
  live,
}: {
  d: string;
  progress: MotionValue<number>;
  start: number;
  live: boolean;
}) {
  const length = useTransform(() => Math.min(1, Math.max(0, (progress.get() - start) / 0.45)));
  return (
    <motion.path
      d={d}
      className="trace-line"
      style={live ? { pathLength: length, opacity: length } : undefined}
    />
  );
}

function TraceNode({
  at,
  progress,
  start,
  live,
  lead,
}: {
  at: Point;
  progress: MotionValue<number>;
  start: number;
  live: boolean;
  lead?: boolean;
}) {
  const on = useTransform(() => Math.min(1, Math.max(0, (progress.get() - start) / 0.15)));
  return (
    <motion.circle
      cx={at[0]}
      cy={at[1]}
      r={lead ? 6 : 3.5}
      className={lead ? "trace-node lead" : "trace-node"}
      style={live ? { opacity: on, scale: on } : undefined}
    />
  );
}

export function SignalTrace({
  shape,
  className,
}: {
  shape: "lattice" | "converge";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useSceneMode() === "full";
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.95", "end 0.3"] });
  const progress = useSmoothProgress(scrollYProgress);

  const paths =
    shape === "lattice"
      ? LATTICE.pairs.map(([a, b]) => curve(a, b))
      : CONVERGE.sources.map((s) => curve(s, CONVERGE.target));
  const nodes = shape === "lattice" ? LATTICE.nodes : CONVERGE.nodes;
  const lead = shape === "converge" ? CONVERGE.nodes.length - 1 : -1;

  return (
    <div ref={ref} aria-hidden="true" className={`signal-trace ${className ?? ""}`}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
        {paths.map((d, i) => (
          <TracePath key={d} d={d} progress={progress} start={i * 0.04} live={live} />
        ))}
        {nodes.map((n, i) => (
          <TraceNode
            key={`${n[0]}-${n[1]}`}
            at={n}
            progress={progress}
            start={shape === "lattice" ? (n[0] / 400) * 0.6 : i === lead ? 0.55 : 0}
            live={live}
            lead={i === lead}
          />
        ))}
      </svg>
    </div>
  );
}
