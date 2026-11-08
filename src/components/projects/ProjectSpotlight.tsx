"use client";

import { Spotlight } from "@/components/motion-primitives/spotlight";
import { useFinePointer } from "@/hooks/useFinePointer";

/**
 * A soft light that follows the pointer across a project panel (Motion Primitives Spotlight),
 * tinted with the project hue. Mounted only for fine pointers without reduced motion.
 */
export function ProjectSpotlight() {
  const fine = useFinePointer();
  if (!fine) return null;
  return (
    <Spotlight
      size={420}
      springOptions={{ stiffness: 140, damping: 22, mass: 0.4 }}
      className="z-0 from-[color-mix(in_srgb,var(--hue)_22%,transparent)] via-[color-mix(in_srgb,var(--hue)_6%,transparent)] to-transparent blur-2xl dark:from-[color-mix(in_srgb,var(--hue)_22%,transparent)] dark:via-[color-mix(in_srgb,var(--hue)_6%,transparent)] dark:to-transparent"
    />
  );
}
