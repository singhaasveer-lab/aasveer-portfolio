"use client";

import { useEffect, useRef } from "react";

/**
 * Sets data-animate="on" on the element while it is in the viewport (and "off" otherwise), so
 * continuous CSS animations inside it pause when nobody can see them. With `once`, the attribute
 * stays "on" after the first sighting (used for one-shot effects).
 */
export function useActiveWhenVisible<T extends Element>(once = false) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = !!entry?.isIntersecting;
        el.setAttribute("data-animate", visible ? "on" : "off");
        if (visible && once) observer.disconnect();
      },
      { rootMargin: "80px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);
  return ref;
}
