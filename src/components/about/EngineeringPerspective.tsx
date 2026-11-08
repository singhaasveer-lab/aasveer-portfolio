"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";
import { TransitionPanel } from "@/components/motion-primitives/transition-panel";
import { useFinePointer } from "@/hooks/useFinePointer";
import { useSceneMode } from "@/hooks/useSceneMotion";
import type { About } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

const W = 360;
const H = 520;
/** Each stage's place on the drawing: the chain steps from side to side as it descends. */
const SPOTS = [
  { x: 112, y: 62 },
  { x: 244, y: 194 },
  { x: 120, y: 326 },
  { x: 240, y: 458 },
];
const SPRING = { stiffness: 70, damping: 20, mass: 0.7 };

const link = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const mid = (a.y + b.y) / 2;
  return `M${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
};

/** A different shape for each idea: open, faceted, built, and a whole. */
function Glyph({ index }: { index: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="persp-glyph">
      {index === 0 && (
        <>
          <circle cx="20" cy="20" r="15" strokeDasharray="3 4" />
          <circle cx="20" cy="20" r="3" className="persp-glyph-core" />
        </>
      )}
      {index === 1 && (
        <>
          <path d="M20 4 34 12v16l-14 8-14-8V12Z" />
          <path d="M20 4v16m14 8-14-8M6 28l14-8" />
        </>
      )}
      {index === 2 && (
        <>
          <rect x="6" y="6" width="28" height="28" />
          <path d="M6 15.5h28M6 24.5h28M15.5 6v28M24.5 6v28" />
        </>
      )}
      {index === 3 && (
        <>
          <circle cx="20" cy="20" r="15" />
          <circle cx="20" cy="20" r="8" className="persp-glyph-core" />
        </>
      )}
    </svg>
  );
}

/**
 * Engineering perspective: how a problem becomes something a person can use, as a chain of four
 * ideas. It is a way of thinking, drawn as one, and not the architecture of any project. The stages
 * are real buttons over a decorative drawing, so the drawing is never the only way to read it.
 */
export function EngineeringPerspective({ perspective }: { perspective: About["perspective"] }) {
  const { stages, note } = perspective;
  const [index, setIndex] = useState(0);
  const field = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const full = useSceneMode() === "full";
  const reduced = useReducedMotion();

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, SPRING);
  const y = useSpring(pointerY, SPRING);
  const gridX = useTransform(x, (v) => v * -9);
  const gridY = useTransform(y, (v) => v * -7);
  const shapeX = useTransform(x, (v) => v * 6);
  const shapeY = useTransform(y, (v) => v * 5);
  // The layered shapes turn with the scroll position, forward and back.
  const { scrollYProgress } = useScroll({ target: field, offset: ["start end", "end start"] });
  const turn = useTransform(scrollYProgress, [0, 1], [-16, 16]);

  const segments = SPOTS.slice(1).map((spot, i) => link(SPOTS[i]!, spot));

  return (
    <div className="persp" data-testid="engineering-perspective">
      <p className="sr-only">
        A sequence of {stages.length} ideas: {stages.map((s) => s.label).join(", then ")}. Select
        one to read about it.
      </p>
      <div
        ref={field}
        className="persp-field"
        onPointerMove={(event) => {
          if (!fine) return;
          const rect = event.currentTarget.getBoundingClientRect();
          pointerX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
          pointerY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
        }}
        onPointerLeave={() => {
          pointerX.set(0);
          pointerY.set(0);
        }}
      >
        <motion.div
          aria-hidden="true"
          className="persp-grid"
          style={fine ? { x: gridX, y: gridY } : undefined}
        />
        <motion.svg
          aria-hidden="true"
          viewBox={`0 0 ${W} ${H}`}
          className="persp-layer"
          style={fine ? { x: shapeX, y: shapeY } : undefined}
        >
          <motion.g style={full ? { rotate: turn, transformOrigin: "50% 50%" } : undefined}>
            <polygon points="180,60 310,150 310,370 180,460 50,370 50,150" className="persp-hex" />
            <polygon
              points="180,120 258,175 258,345 180,400 102,345 102,175"
              className="persp-hex"
            />
          </motion.g>
        </motion.svg>
        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} className="persp-layer">
          {segments.map((d, i) => (
            <g key={d}>
              <path d={d} className="persp-link" />
              <motion.path
                d={d}
                className="persp-link-lit"
                initial={false}
                animate={{ pathLength: i < index ? 1 : 0, opacity: i < index ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : 0.5, ease: EASE_OUT }}
              />
            </g>
          ))}
          {!reduced && index > 0 && (
            <circle
              key={index}
              r="3.5"
              className="persp-pulse"
              data-testid="perspective-pulse"
              style={{ offsetPath: `path("${segments[index - 1]}")` }}
            />
          )}
        </svg>

        <ol className="persp-stages">
          {stages.map((stage, i) => (
            <li
              key={stage.id}
              style={
                {
                  "--x": `${(SPOTS[i]!.x / W) * 100}%`,
                  "--y": `${(SPOTS[i]!.y / H) * 100}%`,
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="persp-node"
                aria-current={i === index ? "step" : undefined}
                data-reached={i <= index || undefined}
                data-testid={`perspective-${stage.id}`}
                onClick={() => setIndex(i)}
              >
                <Glyph index={i} />
                <span className="persp-label">{stage.label}</span>
                <span className="persp-note" aria-hidden="true">
                  {stage.annotation}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="persp-reading">
        <div aria-live="polite">
          <TransitionPanel
            activeIndex={index}
            mode="wait"
            transition={{ duration: 0.24, ease: EASE_OUT }}
            variants={{
              enter: { opacity: 0, y: 14 },
              center: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -8 },
            }}
          >
            {stages.map((stage, i) => (
              <div key={stage.id} data-testid="perspective-panel" data-stage={stage.id}>
                <p className="ab-step" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}
                </p>
                <h4 className="ab-reading-title">{stage.label}</h4>
                <p className="ab-reading-text">{stage.explanation}</p>
                <p className="label mt-6">Grounded in</p>
                <ul className="ab-slashes">
                  {stage.grounded_in.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </TransitionPanel>
        </div>
        <p className="ab-footnote">{note}</p>
        <noscript>
          <dl className="ab-noscript">
            {stages.map((stage) => (
              <div key={stage.id}>
                <dt>{stage.label}</dt>
                <dd>{stage.explanation}</dd>
              </div>
            ))}
          </dl>
        </noscript>
      </div>
    </div>
  );
}
