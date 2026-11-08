"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { About } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

/** A mark for each principle: a target, linked parts, and a person within a system. */
const MARKS: Record<string, string[]> = {
  practical: ["M22 4v9M22 31v9M4 22h9M31 22h9", "M34 22a12 12 0 1 1-24 0 12 12 0 0 1 24 0Z"],
  systems: [
    "M10 12 34 12 22 34Z",
    "M10 12a4 4 0 1 0 0 .01M34 12a4 4 0 1 0 0 .01M22 34a4 4 0 1 0 0 .01",
  ],
  human: ["M6 34a16 16 0 0 1 32 0", "M28 14a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"],
};

function Mark({ id, active }: { id: string; active: boolean }) {
  const reduced = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 44 44" className="principle-mark">
      {(MARKS[id] ?? []).map((d) => (
        <path key={d} d={d} className="principle-mark-base" />
      ))}
      {(MARKS[id] ?? []).map((d) => (
        <motion.path
          key={`${d}-lit`}
          d={d}
          className="principle-mark-lit"
          initial={false}
          animate={{ pathLength: active ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.6, ease: EASE_OUT }}
        />
      ))}
    </svg>
  );
}

/**
 * Three connected principles on one line, which fills as far as the chosen one. Every explanation
 * is always on the page: selecting a principle brings it forward, and hides nothing.
 */
export function EngineeringPrinciples({ principles }: { principles: About["principles"] }) {
  const [active, setActive] = useState(0);
  const progress = { "--p": (active + 1) / principles.length } as React.CSSProperties;

  return (
    <div className="principles" style={progress} data-testid="engineering-principles">
      <span className="principles-rail" aria-hidden="true">
        <span />
      </span>
      <ol>
        {principles.map((principle, i) => (
          <li
            key={principle.id}
            className="principle"
            data-active={i === active || undefined}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setActive(i);
            }}
          >
            <button
              type="button"
              className="principle-button"
              aria-pressed={i === active}
              data-testid={`principle-${principle.id}`}
              onClick={() => setActive(i)}
            >
              <Mark id={principle.id} active={i === active} />
              <span className="principle-title">{principle.label}</span>
            </button>
            <p className="principle-text">{principle.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
