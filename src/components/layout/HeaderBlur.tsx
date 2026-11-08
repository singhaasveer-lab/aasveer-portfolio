"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { ProgressiveBlur } from "@/components/motion-primitives/progressive-blur";

/** Clears the top of the hero, so the blur never passes over the portrait at rest. */
const START_PX = 80;

/** Content softens as it slides under the sticky header. Mounted only once the page has scrolled. */
export function HeaderBlur() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > START_PX));
  if (!scrolled) return null;
  return (
    <ProgressiveBlur
      aria-hidden="true"
      className="header-blur absolute"
      direction="top"
      blurLayers={4}
      blurIntensity={1}
    />
  );
}
