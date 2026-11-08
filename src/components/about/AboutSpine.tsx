"use client";

import { motion, useScroll } from "motion/react";
import { useRef } from "react";
import { useSceneMode, useSmoothProgress } from "@/hooks/useSceneMotion";

/**
 * A signal running down the section's edge. It is drawn by scroll position, so it extends going
 * down and retracts going up. Decorative, and absent on phones and under reduced motion.
 */
export function AboutSpine() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start 70%", "end 70%"] });
  const scaleY = useSmoothProgress(scrollYProgress);
  const live = useSceneMode() === "full";

  return (
    <div ref={track} className="about-spine" aria-hidden="true">
      <motion.span
        className="about-spine-fill"
        data-testid="about-spine"
        style={live ? { scaleY } : undefined}
      />
    </div>
  );
}
