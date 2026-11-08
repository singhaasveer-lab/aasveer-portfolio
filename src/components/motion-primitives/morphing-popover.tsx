'use client';

import {
  useState,
  useId,
  useRef,
  useEffect,
  createContext,
  useContext,
} from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Transition,
} from 'motion/react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/utils';

/*
 * Motion Primitives Morphing Popover, patched (docs/TECHNICAL_DECISIONS.md, D35). Upstream marks a
 * non-modal popover aria-modal, gives it no name, opens but never toggles from its trigger, and
 * loses focus on close. Here it is a named, non-modal dialog, and Escape returns to the trigger.
 */
const TRANSITION = {
  type: 'spring',
  bounce: 0.1,
  duration: 0.4,
} as const;

type MorphingPopoverContextValue = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  uniqueId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

const MorphingPopoverContext =
  createContext<MorphingPopoverContextValue | null>(null);

function usePopover() {
  const context = useContext(MorphingPopoverContext);
  if (!context) throw new Error('Must be used within MorphingPopover');
  return context;
}

export type MorphingPopoverProps = {
  children: React.ReactNode;
  transition?: Transition;
  className?: string;
};

function MorphingPopover({
  children,
  transition = TRANSITION,
  className,
}: MorphingPopoverProps) {
  const uniqueId = useId();
  const [isOpen, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <MorphingPopoverContext.Provider
      value={{ isOpen, setOpen, uniqueId, triggerRef }}
    >
      <MotionConfig transition={transition}>
        <div className={className} data-open={isOpen || undefined}>
          {children}
        </div>
      </MotionConfig>
    </MorphingPopoverContext.Provider>
  );
}

export type MorphingPopoverTriggerProps = {
  children: React.ReactNode;
  className?: string;
  label?: string;
};

function MorphingPopoverTrigger({
  children,
  className,
  label,
}: MorphingPopoverTriggerProps) {
  const { isOpen, setOpen, uniqueId, triggerRef } = usePopover();
  return (
    <button
      ref={triggerRef}
      type='button'
      className={className}
      aria-label={label}
      aria-haspopup='dialog'
      aria-expanded={isOpen}
      aria-controls={`popover-content-${uniqueId}`}
      onClick={() => setOpen(!isOpen)}
    >
      {children}
    </button>
  );
}

export type MorphingPopoverContentProps = {
  children: React.ReactNode;
  className?: string;
  label: string;
};

function MorphingPopoverContent({
  children,
  className,
  label,
}: MorphingPopoverContentProps) {
  const { isOpen, setOpen, uniqueId, triggerRef } = usePopover();
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, (event) => {
    if (isOpen && !triggerRef.current?.contains(event.target as Node)) {
      setOpen(false);
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen, triggerRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={ref}
          id={`popover-content-${uniqueId}`}
          role='dialog'
          aria-label={label}
          className={cn('absolute', className)}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -3 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { MorphingPopover, MorphingPopoverTrigger, MorphingPopoverContent };
