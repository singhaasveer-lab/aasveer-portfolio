"use client";

import { motion, useInView } from "motion/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { revealViewport, riseItem, staggerContainer } from "@/lib/motion";

/*
 * Scroll reveals that never make content depend on JavaScript.
 *
 * The server renders every block visible (initial={false}). Only after hydration, and only for
 * blocks that are below the viewport at that moment, the block is set to "hidden" instantly
 * (nobody can see it) and then animates to "visible" when scrolled into view. If JavaScript
 * fails, or the visitor prefers reduced motion, the content simply stays visible.
 * See docs/TECHNICAL_DECISIONS.md, D16.
 */

type RevealState = "visible" | "hidden";

function useRevealState<T extends Element>() {
  const ref = useRef<T>(null);
  const [armed, setArmed] = useState(false);
  const inView = useInView(ref, revealViewport);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Only blocks that start below the fold are armed; anything already seen stays put.
    if (el.getBoundingClientRect().top > window.innerHeight) setArmed(true);
  }, []);

  const state: RevealState = armed && !inView ? "hidden" : "visible";
  return { ref, state };
}

const ItemContext = createContext(false);

interface RevealProps {
  children: React.ReactNode;
  className?: string;
}

/** Entrance for one block: opacity and a short rise. */
export function Reveal({ children, className }: RevealProps) {
  const { ref, state } = useRevealState<HTMLDivElement>();
  return (
    <motion.div
      ref={ref}
      className={`reveal ${className ?? ""}`}
      variants={riseItem}
      initial={false}
      animate={state}
    >
      {children}
    </motion.div>
  );
}

/** Container whose RevealItem children enter in sequence. */
export function RevealGroup({
  children,
  className,
  stagger,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  as?: "div" | "ul" | "ol";
}) {
  const { ref, state } = useRevealState<HTMLElement>();
  const Component = motion[as] as typeof motion.div;
  return (
    <ItemContext.Provider value>
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        className={`reveal ${className ?? ""}`}
        variants={staggerContainer(stagger)}
        initial={false}
        animate={state}
      >
        {children}
      </Component>
    </ItemContext.Provider>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
} & Record<`data-${string}`, string>) {
  const inGroup = useContext(ItemContext);
  const Component = motion[as] as typeof motion.div;
  return (
    <Component className={className} variants={inGroup ? riseItem : undefined} {...rest}>
      {children}
    </Component>
  );
}
