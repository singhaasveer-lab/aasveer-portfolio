"use client";

import { useEffect, useState, type RefObject } from "react";

/** The element's layout size in pixels, or null until measured (and on the server). */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { offsetWidth: width, offsetHeight: height } = element;
      setSize((s) => (s?.width === width && s.height === height ? s : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
