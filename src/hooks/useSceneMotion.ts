"use client";

import { useMotionValueEvent, useSpring, type MotionValue } from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import { SCROLL_SPRING } from "@/lib/motion";

export function useMedia(query: string, serverValue: boolean) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/**
 * How scroll scenes may move:
 * - "off": server render, hydration, or reduced motion. Content renders at rest.
 * - "lite": phones. Short rises and fades only: no 3D, masks or horizontal travel.
 * - "full": everything else.
 */
export type SceneMode = "off" | "lite" | "full";

export function useSceneMode(): SceneMode {
  // The server snapshot reports reduced motion, so the server markup is always at rest.
  const reduced = useMedia("(prefers-reduced-motion: reduce)", true);
  const narrow = useMedia("(max-width: 767px)", false);
  if (reduced) return "off";
  return narrow ? "lite" : "full";
}

/**
 * Spring-smoothed scroll progress. The first measurement after mount is applied instantly, so a
 * page opened mid-scroll (or at a /#section link) shows each scene where it belongs instead of
 * replaying its entrance from zero.
 */
export function useSmoothProgress(raw: MotionValue<number>) {
  const smooth = useSpring(raw, SCROLL_SPRING);
  const measured = useRef(false);
  useMotionValueEvent(raw, "change", (v) => {
    if (measured.current) return;
    measured.current = true;
    smooth.jump(v);
  });
  return smooth;
}
