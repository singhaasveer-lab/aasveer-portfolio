"use client";

import { useEffect, useRef, useState } from "react";
import { TextEffect } from "@/components/motion-primitives/text-effect";

type Phase = "static" | "armed" | "play" | "done";

interface RevealTextProps {
  children: string;
  className?: string;
  per?: "word" | "char";
  /** Multiplies the stagger speed (Text Effect `speedReveal`). */
  speed?: number;
}

/**
 * Word reveal built on Motion Primitives' TextEffect, with safe states around it:
 * - static: server render, no JavaScript, reduced motion, or already on screen at hydration.
 *   The plain text is shown, so nothing waits on animation.
 * - armed: hydrated, below the fold; the text is hidden until it scrolls into view.
 * - play: TextEffect reveals the words.
 * - done: back to plain text, so the final DOM equals the server render.
 */
export function RevealText({ children, className, per = "word", speed = 1.4 }: RevealTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<Phase>("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return; // already visible: stay static
    // Hydration has finished when this effect runs, so arming hides only off-screen text.
    setPhase("armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPhase("play");
          observer.disconnect();
        }
      },
      // The tall top margin counts text already scrolled past as seen, so a fast scroll can never
      // leave it hidden above the viewport.
      { rootMargin: "100000px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={`reveal ${className ?? ""}`}>
      {phase === "play" ? (
        <TextEffect
          as="span"
          per={per}
          preset="fade-in-blur"
          speedReveal={speed}
          onAnimationComplete={() => setPhase("done")}
        >
          {children}
        </TextEffect>
      ) : (
        <span style={phase === "armed" ? { opacity: 0 } : undefined}>{children}</span>
      )}
    </span>
  );
}
