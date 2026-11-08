"use client";

import { useEffect, useState } from "react";
import { Cursor } from "@/components/motion-primitives/cursor";
import { useFinePointer } from "@/hooks/useFinePointer";

/**
 * Over a project card the pointer becomes a small "Open case" label. It is one element for the whole
 * page, because a fixed element inside a card would move with the card's transforms. Elsewhere the
 * normal cursor stays. It is not mounted for touch or under reduced motion.
 */
export function CaseCursor() {
  const fine = useFinePointer();
  const [onCard, setOnCard] = useState(false);

  useEffect(() => {
    if (!fine) return;
    const root = document.documentElement;
    let x = -1;
    let y = -1;
    let frame = 0;

    const set = (inside: boolean) => {
      setOnCard(inside);
      root.classList.toggle("case-cursor", inside);
    };
    // Is the pointer over a project card right now? Uses the last known pointer position, so it
    // stays correct when the page moves under a still pointer (scrolling, section jumps).
    const check = () => {
      frame = 0;
      if (x < 0 || document.querySelector("dialog[open]")) return set(false);
      const card = document.elementFromPoint(x, y)?.closest?.("article.case");
      set(!!card);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      schedule();
    };
    const hide = () => {
      x = -1;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      set(false);
    };
    const onOut = (event: PointerEvent) => {
      // relatedTarget is null when the pointer leaves the window.
      if (!event.relatedTarget) hide();
    };
    const onVisibility = () => {
      if (document.hidden) hide();
    };
    const onNavigate = () => {
      set(false);
      schedule();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("hashchange", onNavigate);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("hashchange", onNavigate);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      root.classList.remove("case-cursor");
    };
  }, [fine]);

  if (!fine) return null;
  return (
    <Cursor
      visible={onCard}
      springConfig={{ stiffness: 500, damping: 34, mass: 0.3 }}
      transition={{ duration: 0.16 }}
      variants={{
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.8 },
      }}
    >
      <span className="case-cursor-label" data-testid="case-cursor">
        Open case
      </span>
    </Cursor>
  );
}
