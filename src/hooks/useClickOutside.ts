"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Calls the handler on a press outside the element. */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const onPress = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      latest.current(event);
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("touchstart", onPress);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("touchstart", onPress);
    };
  }, [ref]);
}
