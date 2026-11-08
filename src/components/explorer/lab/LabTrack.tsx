"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { ActiveTrail } from "@/components/motion/Accents";
import { useElementSize } from "@/hooks/useElementSize";
import { horizontalCurve } from "@/lib/explorer/graph";
import type { LabStage } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

interface LabTrackProps {
  stages: LabStage[];
  /** The project whose implementation is being read. */
  project: string;
  active: number;
  /** While a trace runs, a pulse travels each connector and arrives as the next stage lights. */
  tracing?: boolean;
  /** How long the pulse takes over one connector, in seconds. */
  stepSeconds?: number;
  onSelect: (index: number) => void;
}

/**
 * Stages alternate between two rails, which gives each one room for a two-line label. The first
 * and last sit half a node in from the edges (nodes are 170% / count wide in explorer.css).
 */
const position = (index: number, count: number) => {
  const inset = 0.85 / count;
  return {
    x: inset + (index * (1 - 2 * inset)) / (count - 1),
    y: index % 2 === 0 ? 0.25 : 0.75,
  };
};

/**
 * The processing path. From tablet width up the stages zig-zag across a measured SVG track whose
 * segments light up to the active stage; on phones they stack as a vertical flow. Stages are
 * always real buttons, so the path is decoration and never the only way to read the sequence.
 */
export function LabTrack({
  stages,
  project,
  active,
  tracing = false,
  stepSeconds = 1.2,
  onSelect,
}: LabTrackProps) {
  const track = useRef<HTMLDivElement>(null);
  const size = useElementSize(track);
  const reduced = useReducedMotion();
  const count = stages.length;

  const segments =
    size &&
    stages.slice(1).map((_, i) => {
      const a = position(i, count);
      const b = position(i + 1, count);
      return horizontalCurve(
        { x: a.x * size.width, y: a.y * size.height },
        { x: b.x * size.width, y: b.y * size.height },
      );
    });

  return (
    <div ref={track} className="lab-track" data-testid="lab-track">
      {size && segments && (
        <svg aria-hidden="true" width={size.width} height={size.height} className="lab-track-svg">
          {segments.map((d, i) => (
            <g key={d}>
              <path d={d} className="lab-rail" />
              <motion.path
                d={d}
                className="lab-rail-lit"
                initial={false}
                animate={{ pathLength: i < active ? 1 : 0, opacity: i < active ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : 0.5, ease: EASE_OUT }}
              />
            </g>
          ))}
          {!reduced && tracing && segments[active] && (
            <g key={`pulse-${active}`} data-testid="lab-pulse">
              <motion.path
                d={segments[active]}
                className="lab-rail-lit"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: stepSeconds, ease: "linear" }}
              />
              <motion.circle
                r="5"
                className="lab-pulse"
                style={{ offsetPath: `path("${segments[active]}")` }}
                initial={{ offsetDistance: "0%" }}
                animate={{ offsetDistance: "100%" }}
                transition={{ duration: stepSeconds, ease: "linear" }}
              />
            </g>
          )}
          {!reduced && !tracing && active > 0 && (
            <circle
              key={active}
              r="4"
              className="lab-packet"
              style={{ offsetPath: `path("${segments[active - 1]}")` }}
            />
          )}
        </svg>
      )}
      <ol className="lab-stages">
        {stages.map((stage, i) => {
          const { x, y } = position(i, count);
          const note = stage.notes.find((n) => n.project === project)!;
          const skipped = note.status === "not_used";
          return (
            <li
              key={stage.id}
              className="lab-stage"
              style={
                {
                  "--x": `${x * 100}%`,
                  "--y": `${y * 100}%`,
                  "--count": count,
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="lab-node"
                aria-current={i === active ? "step" : undefined}
                data-reached={i < active || undefined}
                data-skipped={skipped || undefined}
                data-layer={stage.layer}
                data-testid={`lab-stage-${stage.id}`}
                onClick={() => onSelect(i)}
              >
                <span className="lab-node-index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {i === active && <ActiveTrail size={36} />}
                <span className="lab-node-label">{stage.label}</span>
                {skipped && <span className="lab-node-flag">Not in this project</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
