"use client";

import { useEffect, useRef } from "react";
import { useMedia } from "@/hooks/useSceneMotion";
import type { ProjectWalkthrough as Walkthrough } from "@/lib/validation/schemas";

/**
 * A short muted walkthrough, shown only when a file is set. A video downloads nothing until it
 * comes into view, plays only while on screen, and never plays by itself under reduced motion:
 * its controls remain. A GIF cannot be paused, so reduced motion shows its poster instead.
 */
export function ProjectWalkthrough({ walkthrough }: { walkthrough: Walkthrough | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const autoplay = useMedia("(prefers-reduced-motion: no-preference)", false);

  useEffect(() => {
    const element = video.current;
    if (!element || !autoplay) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void element.play().catch(() => undefined);
        else element.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [autoplay]);

  if (!walkthrough) return null;
  const { src, poster, description } = walkthrough;

  return (
    <figure className="case-walkthrough" data-testid="project-walkthrough">
      {src.endsWith(".gif") ? (
        <picture>
          <source media="(prefers-reduced-motion: no-preference)" srcSet={src} />
          <img src={poster} alt={description} loading="lazy" decoding="async" />
        </picture>
      ) : (
        <video
          ref={video}
          src={src}
          poster={poster}
          aria-label={description}
          muted
          loop
          playsInline
          controls
          preload="none"
        />
      )}
      <figcaption>Walkthrough</figcaption>
    </figure>
  );
}
