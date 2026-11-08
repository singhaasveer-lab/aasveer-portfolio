import type { Transition, Variant, Variants } from "motion/react";

/**
 * Shared motion tokens. CSS mirrors these in globals.css (--ease-out, --dur-*), so CSS and
 * Motion animations share one timing language.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const DURATION = { fast: 0.16, base: 0.42, slow: 0.9 } as const;

/** Vertical travel for entrances, in pixels. */
export const DISTANCE = 20;

export const STAGGER = { tight: 0.04, base: 0.08, loose: 0.14 } as const;

export const revealTransition: Transition = { duration: DURATION.slow, ease: EASE_OUT };

/** Container that staggers its children once it becomes visible. */
export const staggerContainer = (stagger: number = STAGGER.base, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/** Opacity plus a short rise: the default entrance for blocks and list items. */
export const riseItem: { hidden: Variant; visible: Variant } = {
  // Hiding is instant: it only ever happens to off-screen content (see Reveal.tsx).
  hidden: { opacity: 0, y: DISTANCE, transition: { duration: 0 } },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

/** Viewport options for scroll reveals: trigger a little before the element is fully in view. */
export const revealViewport = { once: true, margin: "0px 0px -12% 0px" } as const;

/** Deceleration curve for scroll-linked entrances: most of the travel happens early. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Spring that smooths scroll progress without letting it lag noticeably behind the scrollbar. */
export const SCROLL_SPRING = { stiffness: 170, damping: 32, mass: 0.4, restDelta: 0.0005 } as const;
