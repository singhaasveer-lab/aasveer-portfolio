"use client";

import { MotionConfig } from "motion/react";

/** Applies the visitor's reduced-motion preference to every Motion animation on the page. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
