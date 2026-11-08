'use client';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

/*
 * Motion Primitives Glow Effect, patched (docs/TECHNICAL_DECISIONS.md, D35). Upstream animates
 * `background`, which repaints every frame, and builds a blur class Tailwind cannot see. This keeps
 * its gradient and blur and moves only scale and opacity, as `breathe` always intended.
 */
export type GlowEffectProps = {
  className?: string;
  style?: React.CSSProperties;
  colors: string[];
  /** Static holds still, for reduced motion or when off screen. */
  mode?: 'breathe' | 'static';
  duration?: number;
  scale?: number;
};

export function GlowEffect({
  className,
  style,
  colors,
  mode = 'breathe',
  duration = 7,
  scale = 1,
}: GlowEffectProps) {
  return (
    <motion.div
      aria-hidden='true'
      style={{
        ...style,
        background: `linear-gradient(to right, ${colors.join(', ')})`,
        scale,
      }}
      animate={
        mode === 'breathe'
          ? { opacity: [0.7, 1, 0.7], scale: [scale, scale * 1.015, scale] }
          : { opacity: 0.8, scale }
      }
      transition={
        mode === 'breathe'
          ? { repeat: Infinity, duration, ease: 'easeInOut' }
          : { duration: 0 }
      }
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full blur-xl',
        className
      )}
    />
  );
}
