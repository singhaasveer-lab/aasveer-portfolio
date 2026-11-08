"use client";

import { useEffect, useState } from "react";

/** The reading line, as a fraction of the viewport height from the top. */
const PROBE = 0.4;

/**
 * The section being read: the last of `ids` whose top edge has passed the reading line, or the
 * last section once the page is scrolled to the bottom. Measured from layout on mount, on every
 * scroll frame, on resize, on layout changes (fonts, images) and on hash changes, so it is right
 * from the first frame after hydration, including for /#section links and restored positions.
 * Returns null while no section has reached the line (or before hydration).
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * PROBE;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      const root = document.documentElement;
      const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 2;
      const last = ids.at(-1);
      if (atBottom && last && document.getElementById(last)) current = last;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      resize.disconnect();
    };
  }, [ids]);

  return active;
}
