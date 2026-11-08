'use client';
import React, { useEffect } from 'react';
import {
  motion,
  SpringOptions,
  useMotionValue,
  useSpring,
  AnimatePresence,
  Transition,
  Variant,
} from 'motion/react';
import { cn } from '@/lib/utils';

/*
 * Motion Primitives Cursor, patched (docs/TECHNICAL_DECISIONS.md, D35). Upstream hides the cursor
 * across the whole page, and adds parent listeners it can never remove because they are new
 * functions on cleanup. Here the owner says when it shows, and the page cursor is left alone.
 */
export type CursorProps = {
  children: React.ReactNode;
  visible: boolean;
  className?: string;
  springConfig?: SpringOptions;
  transition?: Transition;
  variants?: {
    initial: Variant;
    animate: Variant;
    exit: Variant;
  };
};

export function Cursor({
  children,
  visible,
  className,
  springConfig,
  variants,
  transition,
}: CursorProps) {
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };
    document.addEventListener('mousemove', updatePosition);
    return () => document.removeEventListener('mousemove', updatePosition);
  }, [cursorX, cursorY]);

  const cursorXSpring = useSpring(cursorX, springConfig || { duration: 0 });
  const cursorYSpring = useSpring(cursorY, springConfig || { duration: 0 });

  return (
    <motion.div
      aria-hidden='true'
      className={cn('pointer-events-none fixed left-0 top-0 z-50', className)}
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        translateX: '-50%',
        translateY: '-50%',
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial='initial'
            animate='animate'
            exit='exit'
            variants={variants}
            transition={transition}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
