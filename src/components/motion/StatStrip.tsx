"use client";

import { useInView } from "motion/react";
import { useRef } from "react";
import { useMotionAllowed } from "@/components/motion/Accents";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";

const SPRING = { bounce: 0, duration: 1400 };

function Stat({ value, label, run }: { value: number; label: string; run: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className="sr-only">{value}+</span>
        <span aria-hidden="true">
          <AnimatedNumber value={run ? 0 : value} springOptions={SPRING} />+
        </span>
      </dd>
    </div>
  );
}

/**
 * The portfolio at a glance, counted from the data. The server renders the real numbers. With
 * motion allowed they wait at zero below the fold and count up when the strip comes into view.
 */
export function StatStrip({ stats }: { stats: { label: string; value: number }[] }) {
  const ref = useRef<HTMLDListElement>(null);
  const seen = useInView(ref, { once: true });
  const allowed = useMotionAllowed();
  return (
    <div className="stat-strip">
      <dl ref={ref} className="container-page" data-testid="stat-strip">
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} run={allowed && !seen} />
        ))}
      </dl>
    </div>
  );
}
