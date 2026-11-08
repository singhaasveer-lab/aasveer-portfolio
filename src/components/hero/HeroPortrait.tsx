"use client";

import { motion, useMotionTemplate, useTransform } from "motion/react";
import Image from "next/image";
import { useHeroPointer } from "@/components/hero/HeroMotion";
import { SpinningBadge } from "@/components/motion/Accents";
import type { About } from "@/lib/explorer/schema";

/** Maximum tilt of the frame, in degrees. The photograph itself is never tilted. */
const TILT_Y = 5;
const TILT_X = 3.5;

/**
 * The portrait's composition. Behind the photograph, a frame of layered planes (grid plate,
 * orbital lines, brackets, annotations) tilts in perspective and catches a light that follows
 * the pointer. The photograph sits in front of all of it, on its own plane: it only drifts a few
 * pixels and is never rotated or filtered, so no effect can distort the face or pass over it.
 */
export function HeroPortrait({
  portrait,
  role,
  location,
}: {
  portrait: About["portrait"];
  role: string;
  location: string;
}) {
  const { enabled, x, y } = useHeroPointer();
  const rotateY = useTransform(x, (v) => v * TILT_Y);
  const rotateX = useTransform(y, (v) => v * -TILT_X);
  const plateX = useTransform(x, (v) => v * -7);
  const plateY = useTransform(y, (v) => v * -5);
  const ringX = useTransform(x, (v) => v * -13);
  const ringY = useTransform(y, (v) => v * -9);
  const personX = useTransform(x, (v) => v * 5);
  const personY = useTransform(y, (v) => v * 3);
  const noteX = useTransform(x, (v) => v * 10);
  const noteY = useTransform(y, (v) => v * 7);
  const lightX = useTransform(x, (v) => 50 + v * 44);
  const lightY = useTransform(y, (v) => 36 + v * 34);
  const sheen = useMotionTemplate`radial-gradient(58% 44% at ${lightX}% ${lightY}%, rgb(120 226 255 / 0.26), transparent 72%)`;

  const live = <T,>(style: T) => (enabled ? style : undefined);

  return (
    <div className="hp-stage">
      <motion.div
        className="hp-frame"
        data-testid="hero-portrait"
        style={live({ rotateX, rotateY, transformPerspective: 1400 })}
      >
        <motion.div className="hp-plate" style={live({ x: plateX, y: plateY })}>
          <span className="hp-glow" />
          <motion.span className="hp-sheen" style={live({ background: sheen })} />
        </motion.div>
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 600 650"
          className="hp-rings"
          style={live({ x: ringX, y: ringY })}
        >
          <ellipse cx="300" cy="226" rx="262" ry="74" transform="rotate(-16 300 226)" />
          <ellipse cx="300" cy="226" rx="226" ry="58" transform="rotate(22 300 226)" />
          <circle cx="58" cy="298" r="3.5" className="hp-orbit-node" />
          <circle cx="508" cy="312" r="2.5" className="hp-orbit-node" />
        </motion.svg>
        <motion.div aria-hidden="true" className="hp-notes" style={live({ x: noteX, y: noteY })}>
          <span className="hp-bracket" />
          <span className="hp-bracket hp-bracket-end" />
          <span className="hp-note hp-note-fig">Fig. 01</span>
          <span className="hp-note hp-note-role">{role}</span>
          <span className="hp-note hp-note-base">{location.split(",")[0]}</span>
          <SpinningBadge
            className="hp-badge"
            text={`${role} · ${location.split(",")[0]} · `.toUpperCase()}
          />
        </motion.div>
      </motion.div>
      {portrait.src && (
        <motion.div className="hp-person" style={live({ x: personX, y: personY })}>
          <Image
            src={portrait.src}
            alt={portrait.alt}
            fill
            priority
            sizes="(min-width: 1024px) 46vw, 56vw"
            className="object-contain object-bottom"
          />
        </motion.div>
      )}
    </div>
  );
}
