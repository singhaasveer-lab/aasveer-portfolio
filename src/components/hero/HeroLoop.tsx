"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMotionAllowed } from "@/components/motion/Accents";
import { TextLoop } from "@/components/motion-primitives/text-loop";

/**
 * What the hero's role covers, one phrase at a time. CSS shows a static comma-separated line under
 * reduced motion and without JavaScript, and that line is what screen readers get, so the loop
 * itself is decorative. Both lines are in the server HTML, so nothing shifts on hydration. It stops
 * on hover, while focus is in the hero's text, and when off screen or in a hidden tab.
 */
export function HeroLoop({ phrases }: { phrases: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const allowed = useMotionAllowed();
  const visible = useInView(ref);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const body = ref.current?.closest(".hero-body");
    const onFocusIn = () => setFocused(true);
    const onFocusOut = () => setFocused(false);
    body?.addEventListener("focusin", onFocusIn);
    body?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      body?.removeEventListener("focusin", onFocusIn);
      body?.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const running = allowed && visible && !hovered && !focused && !hidden;

  return (
    <div
      ref={ref}
      className="hero-loop"
      data-testid="hero-loop"
      data-running={running || undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <span className="hero-loop-static">{phrases.join(", ")}</span>
      <span className="hero-loop-live" aria-hidden="true">
        <TextLoop trigger={running} interval={2.6}>
          {phrases.map((phrase) => (
            <span key={phrase}>{phrase}</span>
          ))}
        </TextLoop>
      </span>
    </div>
  );
}
