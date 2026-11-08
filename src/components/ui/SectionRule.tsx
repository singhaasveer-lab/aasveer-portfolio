"use client";

import { useActiveWhenVisible } from "@/hooks/useActiveWhenVisible";

/** A hairline divider that sends one signal across itself the first time it scrolls into view. */
export function SectionRule({ className }: { className?: string }) {
  const ref = useActiveWhenVisible<HTMLDivElement>(true);
  return (
    <div
      ref={ref}
      data-animate="off"
      aria-hidden="true"
      className={`section-rule ${className ?? ""}`}
    />
  );
}
