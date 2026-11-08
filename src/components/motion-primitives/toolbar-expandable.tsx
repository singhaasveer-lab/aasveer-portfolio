'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useClickOutside } from '@/hooks/useClickOutside';

/*
 * Motion Primitives Toolbar Expandable, patched (docs/TECHNICAL_DECISIONS.md, D35). Upstream is a
 * demo with hard-coded people and balances, and needs react-use-measure and lucide-react. This
 * keeps its spring and height expansion, takes its content as props, adds no dependency, and adds
 * the disclosure semantics, Escape and focus return it lacked.
 */
const transition = {
  type: 'spring',
  bounce: 0.1,
  duration: 0.25,
} as const;

export type ToolbarExpandableProps = {
  /** The pill. */
  trigger: React.ReactNode;
  label: string;
  triggerClassName?: string;
  panelClassName?: string;
  className?: string;
  testId?: string;
  /** Choosing any link or button in here closes the panel and returns focus to the pill. */
  children: React.ReactNode;
};

export function ToolbarExpandable({
  trigger,
  label,
  triggerClassName,
  panelClassName,
  className,
  testId,
  children,
}: ToolbarExpandableProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useClickOutside(ref, () => setIsOpen(false));

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      button.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    button.current?.focus();
  };

  return (
    <MotionConfig transition={transition}>
      <div className={className} ref={ref}>
        <button
          ref={button}
          type='button'
          className={triggerClassName}
          aria-label={label}
          aria-expanded={isOpen}
          data-testid={testId}
          onClick={() => setIsOpen(!isOpen)}
        >
          {trigger}
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              className={panelClassName}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onClick={(event) => {
                if ((event.target as Element).closest('a, button')) close();
              }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
