"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { BorderTrail } from "@/components/motion-primitives/border-trail";
import { GlowEffect } from "@/components/motion-primitives/glow-effect";
import { SpinningText } from "@/components/motion-primitives/spinning-text";
import { TextRoll } from "@/components/motion-primitives/text-roll";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import { useFinePointer } from "@/hooks/useFinePointer";
import { useMedia } from "@/hooks/useSceneMotion";

/**
 * Small Motion Primitives accents. Each renders plain text or nothing on the server, during
 * hydration and under reduced motion, so markup never differs and no content depends on them.
 * The looping ones run only while on screen.
 */
export function useMotionAllowed() {
  return useMedia("(prefers-reduced-motion: no-preference)", false);
}

/** A section kicker that resolves once, the first time it comes into view. */
export function ScrambleOnce({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const allowed = useMotionAllowed();
  return (
    <span ref={ref} className={className}>
      <TextScramble as="span" trigger={seen && allowed} duration={0.7} speed={0.035}>
        {children}
      </TextScramble>
    </span>
  );
}

/** A faint sweep across a button label, hinting that it does something. */
export function ShimmerLabel({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref);
  const allowed = useMotionAllowed();
  return (
    <span ref={ref}>
      {allowed && visible ? (
        <TextShimmer
          duration={3.6}
          spread={1.4}
          className="[--base-color:var(--accent-strong)] [--base-gradient-color:#ffffff]"
        >
          {children}
        </TextShimmer>
      ) : (
        children
      )}
    </span>
  );
}

/** A light travelling around the parent's border. The parent must be positioned. */
export function ActiveTrail({ size = 44 }: { size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref);
  const allowed = useMotionAllowed();
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
    >
      {allowed && visible && (
        <BorderTrail
          size={size}
          className="bg-[linear-gradient(90deg,transparent,var(--accent-strong),transparent)]"
          transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
        />
      )}
    </span>
  );
}

const STAGGER = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } },
  item: {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  },
};

/**
 * A list whose items enter one after another, once, when it comes into view. It renders visible on
 * the server and is hidden only after hydration, while below the fold (D16), so its content never
 * depends on JavaScript.
 */
export function Stagger({
  as = "ul",
  item = "li",
  rise = 6,
  children,
  className,
  ...rest
}: {
  as?: "ul" | "ol" | "span";
  item?: "li" | "span";
  /** How far each item rises, in pixels. */
  rise?: number;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.1 });
  const allowed = useMotionAllowed();
  return (
    <AnimatedGroup
      {...rest}
      ref={ref}
      as={as}
      asChild={item}
      className={className}
      variants={{
        container: STAGGER.container,
        item: { ...STAGGER.item, hidden: { opacity: 0, y: rise } },
      }}
      show={!allowed || seen}
    >
      {children}
    </AnimatedGroup>
  );
}

/** A soft, low glow behind its parent. It breathes only while on screen. */
export function SoftGlow({ colors, className }: { colors: string[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref);
  const allowed = useMotionAllowed();
  return (
    <span ref={ref} aria-hidden="true" className={className}>
      <GlowEffect colors={colors} mode={allowed && visible ? "breathe" : "static"} />
    </span>
  );
}

/** A slow circular label. It turns only while on screen, and stays still under reduced motion. */
export function SpinningBadge({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const allowed = useMotionAllowed();
  return (
    <div ref={ref} aria-hidden="true" className={className} data-testid="hero-badge">
      <SpinningText
        duration={48}
        fontSize={0.5}
        radius={6}
        paused={!allowed || !visible}
        className="h-full w-full"
      >
        {text}
      </SpinningText>
    </div>
  );
}

/** A navigation label that rolls on hover and focus, for fine pointers. Its width never changes. */
export function NavRoll({ label }: { label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fine = useFinePointer();
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    const link = ref.current?.closest("a");
    if (!link || !fine) return;
    const start = () => setRolling(true);
    link.addEventListener("pointerenter", start);
    link.addEventListener("focus", start);
    return () => {
      link.removeEventListener("pointerenter", start);
      link.removeEventListener("focus", start);
    };
  }, [fine]);

  return (
    <span ref={ref} className="nav-roll">
      <span className={rolling ? "invisible" : undefined}>{label}</span>
      {rolling && (
        <TextRoll
          className="nav-roll-text"
          duration={0.22}
          getEnterDelay={(i) => i * 0.018}
          getExitDelay={(i) => i * 0.018 + 0.1}
          onAnimationComplete={() => setRolling(false)}
        >
          {label}
        </TextRoll>
      )}
    </span>
  );
}
