"use client";

import { motion, useScroll } from "motion/react";
import { useActiveSection } from "@/hooks/useActiveSection";
import { SCENES } from "@/lib/sections";

const SCENE_IDS = SCENES.map((s) => s.id);
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Presentation-style scene indicator on the right edge (large screens): the current scene number,
 * one tick per scene, the active scene's name, and a line that fills with page progress. It is a
 * visual aid only, so it is hidden from assistive technology and never takes focus; the header
 * navigation remains the way to move between sections.
 */
export function SceneRail() {
  const active = useActiveSection(SCENE_IDS);
  const { scrollYProgress } = useScroll();
  // Nothing is claimed until the position has been measured (see useActiveSection).
  const measured = active !== null;
  const index = Math.max(
    0,
    SCENE_IDS.findIndex((id) => id === active),
  );

  return (
    <div
      className="scene-rail"
      aria-hidden="true"
      data-testid="scene-rail"
      data-active-scene={active ?? undefined}
      data-measured={measured || undefined}
    >
      <p className="scene-rail-count">
        <span className="text-accent">{pad(index + 1)}</span>
        <span className="text-faint">/{pad(SCENES.length)}</span>
      </p>
      <div className="relative">
        <span className="scene-rail-track" />
        <motion.span className="scene-rail-fill" style={{ scaleY: scrollYProgress }} />
        <ol className="scene-rail-ticks">
          {SCENES.map((scene, i) => (
            <li key={scene.id} data-active={i === index || undefined} />
          ))}
        </ol>
      </div>
      <p className="scene-rail-name">{SCENES[index]!.label}</p>
    </div>
  );
}
