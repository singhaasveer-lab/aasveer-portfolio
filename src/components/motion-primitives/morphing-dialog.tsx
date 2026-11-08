'use client';

import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  motion,
  AnimatePresence,
  MotionConfig,
  type HTMLMotionProps,
  type Transition,
} from 'motion/react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/*
 * Motion Primitives Morphing Dialog, patched (docs/TECHNICAL_DECISIONS.md, D32). The upstream
 * dialog is a <div> whose aria-labelledby and aria-describedby point at ids nothing has, with a
 * trap that only watches its first and last elements and document-level Escape and click-outside
 * listeners that would also fire under a nested dialog. It is rebuilt on the native <dialog>, as
 * Overlay is: showModal() supplies the focus trap, the inert page and top-layer stacking. The
 * trigger is split in two, so a card keeps its heading: the card morphs, and a real button opens.
 */

/** A safety net: the page must never stay inert if an exit animation is interrupted. */
const CLOSE_TIMEOUT_MS = 900;

export type MorphingDialogContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  finishClosing: () => void;
  uniqueId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
};

const MorphingDialogContext =
  React.createContext<MorphingDialogContextType | null>(null);

function useMorphingDialog() {
  const context = useContext(MorphingDialogContext);
  if (!context) {
    throw new Error('useMorphingDialog must be used within a MorphingDialog');
  }
  return context;
}

export type MorphingDialogProps = {
  children: React.ReactNode;
  transition?: Transition;
};

function MorphingDialog({ children, transition }: MorphingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const uniqueId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    // The dialog is shown before its content renders, so the morph measures a visible target.
    if (dialog && !dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('overlay-open');
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const finishClosing = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    dialog.close();
    if (!document.querySelector('dialog[open]')) {
      document.documentElement.classList.remove('overlay-open');
    }
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(finishClosing, CLOSE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isOpen, finishClosing]);

  const contextValue = useMemo(
    () => ({
      isOpen,
      open,
      close,
      finishClosing,
      uniqueId,
      triggerRef,
      dialogRef,
    }),
    [isOpen, open, close, finishClosing, uniqueId]
  );

  return (
    <MorphingDialogContext.Provider value={contextValue}>
      <MotionConfig transition={transition}>{children}</MotionConfig>
    </MorphingDialogContext.Provider>
  );
}

export type MorphingDialogCardProps = HTMLMotionProps<'article'>;

/** The surface that morphs. Clicking anywhere on it opens the dialog, as a pointer convenience. */
function MorphingDialogCard({ children, ...props }: MorphingDialogCardProps) {
  const { open, uniqueId } = useMorphingDialog();
  return (
    <motion.article
      {...props}
      layoutId={`dialog-${uniqueId}`}
      onClick={(event) => {
        const target = event.target as Element;
        if (target.closest('a, button')) return;
        if (window.getSelection()?.toString()) return;
        open();
      }}
    >
      {children}
    </motion.article>
  );
}

export type MorphingDialogTriggerProps = {
  children: React.ReactNode;
  className?: string;
  label: string;
};

/** The real control: reachable by keyboard and named for what it opens. */
function MorphingDialogTrigger({
  children,
  className,
  label,
}: MorphingDialogTriggerProps) {
  const { open, isOpen, uniqueId, triggerRef } = useMorphingDialog();
  return (
    <button
      ref={triggerRef}
      type='button'
      className={className}
      onClick={open}
      aria-haspopup='dialog'
      aria-expanded={isOpen}
      aria-controls={`morphing-dialog-${uniqueId}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export type MorphingDialogContentProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function MorphingDialogContent({
  children,
  className,
  style,
}: MorphingDialogContentProps) {
  const { uniqueId } = useMorphingDialog();
  const containerRef = useRef<HTMLDivElement>(null);

  // showModal() ran while the dialog was empty, so focus moves in once there is content.
  useEffect(() => {
    containerRef.current
      ?.querySelector<HTMLElement>('button, [href], input, select, textarea')
      ?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.div
      ref={containerRef}
      layoutId={`dialog-${uniqueId}`}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export type MorphingDialogContainerProps = {
  children: React.ReactNode;
  className?: string;
  scrimClassName?: string;
  testId?: string;
};

function MorphingDialogContainer({
  children,
  className,
  scrimClassName,
  testId,
}: MorphingDialogContainerProps) {
  const { isOpen, close, finishClosing, uniqueId, dialogRef } =
    useMorphingDialog();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      id={`morphing-dialog-${uniqueId}`}
      className={className}
      aria-labelledby={`morphing-dialog-title-${uniqueId}`}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <AnimatePresence initial={false} mode='sync' onExitComplete={finishClosing}>
        {isOpen && (
          <>
            <motion.div
              key={`backdrop-${uniqueId}`}
              className={scrimClassName}
              aria-hidden='true'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            {children}
          </>
        )}
      </AnimatePresence>
    </dialog>,
    document.body
  );
}

export type MorphingDialogTitleProps = {
  children: React.ReactNode;
  className?: string;
};

/** The dialog's name. */
function MorphingDialogTitle({ children, className }: MorphingDialogTitleProps) {
  const { uniqueId } = useMorphingDialog();
  return (
    <h2 id={`morphing-dialog-title-${uniqueId}`} className={className}>
      {children}
    </h2>
  );
}

export type MorphingDialogCloseProps = {
  children: React.ReactNode;
  className?: string;
  label: string;
  testId?: string;
};

function MorphingDialogClose({
  children,
  className,
  label,
  testId,
}: MorphingDialogCloseProps) {
  const { close } = useMorphingDialog();
  return (
    <button
      type='button'
      onClick={close}
      aria-label={label}
      className={cn(className)}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export {
  MorphingDialog,
  MorphingDialogCard,
  MorphingDialogTrigger,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogTitle,
};
