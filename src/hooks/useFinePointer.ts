"use client";

import { useEffect, useState } from "react";

/**
 * True when the visitor has a hover-capable fine pointer and has not asked for reduced motion.
 * Starts false on the server and on first render, so markup never differs during hydration.
 */
export function useFinePointer(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return enabled;
}
